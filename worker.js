/*
 * Elodie Cimiotta — Cloudflare Worker.
 * Sert les fichiers statiques (via le binding ASSETS) et expose /api/contact
 * en POST uniquement, pour remplacer l'ancien envoi JSONP/GET qui exposait
 * les données personnelles dans l'URL.
 *
 * Sécurité :
 *  - méthode POST uniquement (405 sinon, y compris GET et PUT) ;
 *  - aucune donnée personnelle dans l'URL ;
 *  - "destinataire" n'est jamais envoyé par le navigateur : il est fixé ici ;
 *  - Content-Type application/json exigé (400 sinon) ;
 *  - taille du corps limitée à 20 Ko (413 au-delà) ;
 *  - longueur maximale par champ : dépassement = rejet 400 (jamais de troncature silencieuse) ;
 *  - validation des champs obligatoires + format email ;
 *  - neutralisation des caractères dangereux (contrôle, < >) ;
 *  - vérification de l'origine autorisée (403 si origine explicitement différente) ;
 *  - honeypot vérifié côté serveur : rejet 400 générique ({error:"FORM_REJECTED"}),
 *    JAMAIS de faux succès, rien n'est enregistré ni relayé ;
 *  - anti-envoi-trop-rapide (le formulaire doit être resté affiché >= 3s) ;
 *  - limitation basique du débit par IP via la Cache API (30s) ;
 *  - aucune donnée personnelle écrite dans les journaux techniques ;
 *  - ne renvoie jamais un succès simulé : un échec d'envoi réel remonte une erreur.
 */

const ALLOWED_ORIGINS = new Set([
  'https://elodie-cimiotta-iad.com',
  'https://www.elodie-cimiotta-iad.com'
]);

const MAX_LEN = {
  nom: 120,
  email: 254,
  telephone: 40,
  ville: 120,
  pays: 80,
  projet: 120,
  message: 5000,
  page_origine: 500
};

const MAX_BODY_BYTES = 20 * 1024; // 20 Ko

const FIELD_LABELS = {
  nom: 'Le nom',
  email: 'L’email',
  telephone: 'Le téléphone',
  ville: 'La ville',
  pays: 'Le pays',
  projet: 'Le projet',
  message: 'Le message',
  page_origine: 'La page d’origine'
};

const RECIPIENT = 'elodie.cimiotta@iadespana.es'; // fixé côté serveur uniquement

// Backend actuel du formulaire (Google Apps Script). Voir README-api-contact.md :
// cet endpoint n'expose aujourd'hui qu'un doGet() (JSONP). Tant qu'un doPost(e)
// n'y est pas ajouté, cet appel échouera et l'utilisateur verra une erreur réelle
// (jamais un faux succès).
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxGm2u93FF7-Rdt2Pqbo8lKtHLc6NDC0NtAQHyA7wEnvFZ6hZHoz_OKnZfQFKfxxXMSKA/exec';

function jsonResponse(obj, status, extraHeaders) {
  return new Response(JSON.stringify(obj), {
    status: status,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, extraHeaders || {})
  });
}

function sanitize(value) {
  if (typeof value !== 'string') return '';
  // Retire les caracteres de controle et les chevrons (neutralise l'injection HTML basique).
  return value.replace(/[\u0000-\u001F\u007F<>]/g, '').trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= MAX_LEN.email;
}

async function handleContact(request, env, ctx) {
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Méthode non autorisée.' }, 405, { 'Allow': 'POST' });
  }

  // Vérification de l'origine (le navigateur envoie Origin sur une requête fetch cross-context ;
  // sur une navigation same-origin classique l'en-tête peut être absent, on ne bloque donc que
  // les origines explicitement différentes du site).
  const origin = request.headers.get('Origin');
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return jsonResponse({ success: false, error: 'Origine non autorisée.' }, 403);
  }

  // Content-Type : on n'accepte que du JSON explicite (rejette les tentatives de
  // contournement via un type de contenu différent, ex. text/plain ou multipart).
  const contentType = (request.headers.get('Content-Type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return jsonResponse({ success: false, error: 'Content-Type invalide, application/json attendu.' }, 400);
  }

  // Taille du corps : lue avant tout parsing pour éviter de traiter une charge excessive.
  const rawBody = await request.text();
  const bodyBytes = new TextEncoder().encode(rawBody).length;
  if (bodyBytes > MAX_BODY_BYTES) {
    return jsonResponse({ success: false, error: 'Requête trop volumineuse.' }, 413);
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch (e) {
    return jsonResponse({ success: false, error: 'Requête invalide.' }, 400);
  }
  if (!body || typeof body !== 'object') {
    return jsonResponse({ success: false, error: 'Requête invalide.' }, 400);
  }

  // Honeypot : vérifié réellement côté serveur. Un bot qui remplit ce champ reçoit un
  // rejet générique — jamais un faux succès — et le mécanisme antispam n'est jamais
  // révélé publiquement. Rien n'est enregistré ni transmis par email.
  if (sanitize(body.site_web)) {
    return jsonResponse({ success: false, error: 'FORM_REJECTED' }, 400);
  }

  // Anti-envoi-trop-rapide : le formulaire doit être resté affiché au moins 3 secondes.
  const renderedAt = Number(body.rendered_at);
  if (!renderedAt || !isFinite(renderedAt) || (Date.now() - renderedAt) < 3000) {
    return jsonResponse({ success: false, error: 'Merci de patienter quelques secondes avant d’envoyer le formulaire.' }, 429);
  }

  // Longueur des champs : on rejette explicitement (jamais de troncature silencieuse)
  // toute valeur dépassant la limite déclarée pour ce champ.
  const rawFields = {
    nom: sanitize(body.nom),
    email: sanitize(body.email),
    telephone: sanitize(body.telephone),
    ville: sanitize(body.ville),
    pays: sanitize(body.pays),
    projet: sanitize(body.projet),
    message: sanitize(body.message),
    page_origine: sanitize(body.page_origine)
  };
  for (const key of Object.keys(MAX_LEN)) {
    if (rawFields[key].length > MAX_LEN[key]) {
      return jsonResponse({ success: false, error: FIELD_LABELS[key] + ' dépasse la longueur maximale autorisée.' }, 400);
    }
  }

  const nom = rawFields.nom;
  const email = rawFields.email;
  const telephone = rawFields.telephone;
  const ville = rawFields.ville;
  const pays = rawFields.pays;
  const projet = rawFields.projet;
  const message = rawFields.message;
  const pageOrigine = rawFields.page_origine;

  if (!nom || !email) {
    return jsonResponse({ success: false, error: 'Le nom et l’email sont obligatoires.' }, 400);
  }
  if (!isValidEmail(email)) {
    return jsonResponse({ success: false, error: 'Adresse email invalide.' }, 400);
  }

  // Limitation basique du débit par IP (pas de binding KV/Durable Object disponible
  // dans ce projet : implémentation via la Cache API, fenêtre de 30s). Voir le rapport
  // pour la limite de cette approche par rapport à un vrai stockage partagé (KV).
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const cache = caches.default;
  const throttleKey = new Request('https://elodie-throttle.internal/contact/' + encodeURIComponent(ip));
  const cached = await cache.match(throttleKey);
  if (cached) {
    return jsonResponse({ success: false, error: 'Merci de patienter avant un nouvel envoi.' }, 429);
  }
  if (ctx && ctx.waitUntil) {
    ctx.waitUntil(cache.put(throttleKey, new Response('1', { headers: { 'Cache-Control': 'max-age=30' } })));
  } else {
    await cache.put(throttleKey, new Response('1', { headers: { 'Cache-Control': 'max-age=30' } }));
  }

  try {
    const upstream = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nom, email, telephone, ville, pays, projet, message,
        page_origine: pageOrigine,
        destinataire: RECIPIENT
      })
    });

    if (!upstream.ok) {
      throw new Error('upstream_http_' + upstream.status);
    }
    const text = await upstream.text();
    let upstreamData;
    try {
      upstreamData = JSON.parse(text);
    } catch (e) {
      throw new Error('upstream_not_json');
    }
    if (!upstreamData || upstreamData.ok !== true) {
      throw new Error('upstream_rejected');
    }
  } catch (err) {
    // Ne jamais simuler un succès : on remonte un échec réel et compréhensible.
    // Aucune donnée personnelle dans ce log (uniquement le type d'erreur technique).
    console.error('contact_upstream_failed', err && err.message);
    return jsonResponse({
      success: false,
      error: "L'envoi n'a pas pu être finalisé côté serveur. Merci de réessayer plus tard, ou de contacter Elodie directement par téléphone."
    }, 502);
  }

  return jsonResponse({ success: true }, 200);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/contact') {
      return handleContact(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  }
};
