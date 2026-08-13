/*
 * Elodie Cimiotta — script central du site (consentement RGPD/CNIL, GA4, formulaires).
 * Remplace les blocs dupliqués sur les 30 pages (audit SEO+GEO round 13).
 *
 * Règles de consentement strictes :
 *  - aucun script Google n'est chargé tant que l'utilisateur n'a pas cliqué "Accepter" ;
 *  - un refus (ou une absence de choix) ne déclenche aucune requête vers Google Analytics ;
 *  - le choix expire au bout de 6 mois (RGPD/CNIL) ;
 *  - le retrait du consentement supprime les cookies GA4 accessibles et coupe le suivi immédiatement.
 */
(function () {
  'use strict';

  var GA_ID = 'G-3NJTVP8D34';
  var CONSENT_KEY = 'elodie_cookie_consent_v2';
  var SIX_MONTHS_MS = 182 * 24 * 60 * 60 * 1000;
  var gaLoaded = false;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  // Consent Mode v2 : état par défaut refusé tant qu'aucun choix n'est appliqué.
  gtag('consent', 'default', {
    'analytics_storage': 'denied',
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied',
    'wait_for_update': 500
  });

  function readConsent() {
    try {
      var raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.value || !obj.expiresAt) return null;
      if (Date.now() > obj.expiresAt) {
        localStorage.removeItem(CONSENT_KEY);
        return null;
      }
      return obj;
    } catch (e) { return null; }
  }

  function writeConsent(value) {
    var now = Date.now();
    var obj = { value: value, timestamp: now, expiresAt: now + SIX_MONTHS_MS };
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify(obj)); } catch (e) {}
    return obj;
  }

  function deleteGaCookies() {
    var parts = document.cookie ? document.cookie.split(';') : [];
    var names = parts.map(function (c) { return c.trim().split('=')[0]; });
    names.forEach(function (n) {
      if (n === '_ga' || n === '_gid' || n === '_gat' || /^_ga_/.test(n)) {
        document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
        document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=' + location.hostname;
      }
    });
  }

  // Le script GA4 n'est jamais présent dans le HTML statique : il n'est injecté
  // qu'après un clic explicite sur "Accepter" (ou un choix "accepté" déjà valide).
  function loadGA() {
    if (gaLoaded) return; // garde anti double-initialisation
    gaLoaded = true;
    gtag('consent', 'update', {
      'analytics_storage': 'granted',
      'ad_storage': 'denied',
      'ad_user_data': 'denied',
      'ad_personalization': 'denied'
    });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA_ID, { 'anonymize_ip': true });
  }

  function applyConsent(choice) {
    if (choice === 'accepted') {
      loadGA();
    } else {
      gtag('consent', 'update', { 'analytics_storage': 'denied' });
      deleteGaCookies();
    }
  }

  // Fonction centrale d'envoi d'événement : reste inactive sans consentement
  // ou tant que GA4 n'a pas été chargé.
  function trackEvent(name, params) {
    var c = readConsent();
    if (!c || c.value !== 'accepted' || !gaLoaded) return;
    gtag('event', name, params || {});
  }
  window.ElodieAnalytics = { trackEvent: trackEvent };

  function bindAutoTracking() {
    document.querySelectorAll('a[href^="tel:+33"]').forEach(function (a) {
      a.addEventListener('click', function () { trackEvent('click_phone_fr'); });
    });
    document.querySelectorAll('a[href^="tel:+34"]').forEach(function (a) {
      a.addEventListener('click', function () { trackEvent('click_phone_es'); });
    });
    document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
      a.addEventListener('click', function () { trackEvent('click_email'); });
    });
    document.querySelectorAll('a[href*="estimation-immobiliere-quarante-saint-chinian-elodie"]').forEach(function (a) {
      a.addEventListener('click', function () { trackEvent('click_estimation_fr'); });
    });
    document.querySelectorAll('a[href*="estimation-immobiliere-roses-costa-brava-elodie"]').forEach(function (a) {
      a.addEventListener('click', function () { trackEvent('click_estimation_es'); });
    });
  }

  // ---------- Bandeau de consentement ----------
  function initConsentBanner() {
    function hideBanner() {
      var b = document.getElementById('ccBanner');
      if (b) b.remove();
    }
    function showBanner() {
      if (document.getElementById('ccBanner')) return;
      var b = document.createElement('div');
      b.id = 'ccBanner';
      b.setAttribute('role', 'dialog');
      b.setAttribute('aria-label', 'Consentement aux cookies');
      b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#fff;border-top:1px solid #e5e5e5;box-shadow:0 -4px 20px rgba(0,0,0,.12);padding:16px 20px;display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:center;font-family:Montserrat,Helvetica,Arial,sans-serif';
      b.innerHTML =
        '<p style="margin:0;flex:1 1 260px;max-width:640px;font-size:13px;line-height:1.5;color:#333">' +
        'Ce site utilise Google Analytics pour mesurer l’audience, uniquement si vous l’acceptez. ' +
        'Aucun script Google Analytics n’est chargé tant que vous n’avez pas cliqué sur «Accepter», et vous pouvez changer d’avis à tout moment — voir notre ' +
        '<a href="/mentions-legales#rgpd" style="color:#0079A3;text-decoration:underline">politique de confidentialité</a>.</p>' +
        '<div style="display:flex;gap:10px;flex-shrink:0">' +
        '<button type="button" id="ccRefuse" style="padding:10px 22px;border-radius:999px;border:1.5px solid #3C4A5F;background:#fff;color:#3C4A5F;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer">Refuser</button>' +
        '<button type="button" id="ccAccept" style="padding:10px 22px;border-radius:999px;border:none;background:#00B4EC;color:#000;font-family:inherit;font-weight:700;font-style:italic;font-size:13px;cursor:pointer">Accepter</button>' +
        '</div>';
      document.body.appendChild(b);
      document.getElementById('ccAccept').addEventListener('click', function () {
        writeConsent('accepted');
        applyConsent('accepted');
        hideBanner();
      });
      document.getElementById('ccRefuse').addEventListener('click', function () {
        writeConsent('refused');
        applyConsent('refused');
        hideBanner();
      });
    }
    function ensureManageLink() {
      if (document.getElementById('ccManage')) return;
      var a = document.createElement('a');
      a.id = 'ccManage';
      a.href = '#';
      a.textContent = 'Cookies';
      a.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99998;background:rgba(60,74,95,.9);color:#fff;font-family:Montserrat,Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;padding:6px 12px;border-radius:999px;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,.15)';
      a.addEventListener('click', function (e) { e.preventDefault(); showBanner(); });
      document.body.appendChild(a);
    }
    var c = readConsent();
    if (c) { applyConsent(c.value); } else { showBanner(); }
    ensureManageLink();
  }

  // ---------- Formulaires de contact / estimation (sécurisés, POST) ----------
  var GENERIC_ERROR = "Votre demande n'a pas pu être envoyée. Vérifiez les informations saisies ou contactez directement Élodie.";
  // Codes machine renvoyés par le serveur pour lesquels on ne doit JAMAIS afficher le
  // détail brut (ex. FORM_REJECTED = antispam) : on retombe toujours sur un message
  // générique, sans jamais révéler le mécanisme de rejet.
  var SILENT_ERROR_CODES = { FORM_REJECTED: true };

  function showFormError(errBox, message) {
    if (!errBox) return;
    var p = errBox.querySelector('p') || errBox;
    if (message && p !== errBox) { p.textContent = message; }
    errBox.style.display = 'block';
  }

  function resolveErrorMessage(data) {
    var code = data && data.error;
    if (!code || SILENT_ERROR_CODES[code]) return GENERIC_ERROR;
    return code;
  }

  function initSecureForm(cfg) {
    var f = document.getElementById(cfg.formId);
    if (!f) return;
    var renderedAt = Date.now();
    var btn = f.querySelector('.fsub');
    var originalLabel = btn ? btn.textContent : '';
    var submitting = false;

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      // Garde anti-double-soumission : posée en tout premier, avant toute
      // autre logique, pour bloquer un double clic / double "submit" même si
      // le rendu du bouton désactivé n'a pas encore été peint par le navigateur.
      if (submitting) return;

      var errBox = document.getElementById(cfg.errorId);
      if (errBox) errBox.style.display = 'none';

      var get = function (name) {
        var el = f.querySelector('[name=' + name + ']');
        return el ? el.value : '';
      };

      var nom = (get('nom') || '').trim();
      var email = (get('email') || '').trim();
      if (!nom || !email) {
        showFormError(errBox, 'Merci de renseigner votre nom et votre email.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showFormError(errBox, 'Merci de saisir une adresse email valide.');
        return;
      }

      submitting = true;
      if (btn) { btn.textContent = 'Envoi en cours...'; btn.disabled = true; }

      var payload = {
        nom: nom,
        email: email,
        telephone: get('telephone'),
        ville: get('ville'),
        pays: get('pays'),
        projet: get('projet'),
        message: get('message'),
        page_origine: get('page_origine') || window.location.href,
        site_web: get('site_web'), // honeypot : transmis au serveur, jamais enregistré ni envoyé par email
        rendered_at: renderedAt
      };

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          return { ok: res.ok, data: data };
        });
      }).then(function (r) {
        submitting = false;
        if (r.ok && r.data && r.data.success) {
          f.style.display = 'none';
          var okBox = document.getElementById(cfg.successId);
          if (okBox) okBox.style.display = 'block';
          // GA4 : uniquement après un vrai succès serveur ET consentement accordé.
          trackEvent('generate_lead', { form_location: window.location.pathname, projet: payload.projet });
        } else {
          // Le bouton est toujours réactivé et une nouvelle tentative reste possible,
          // y compris après un rejet antispam silencieux (jamais révélé à l'utilisateur).
          if (btn) { btn.textContent = originalLabel; btn.disabled = false; }
          showFormError(errBox, resolveErrorMessage(r.data));
        }
      }).catch(function () {
        submitting = false;
        if (btn) { btn.textContent = originalLabel; btn.disabled = false; }
        showFormError(errBox, GENERIC_ERROR);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindAutoTracking();
    initConsentBanner();
    initSecureForm({ formId: 'fme', successId: 'fse', errorId: 'ferr' });
    initSecureForm({ formId: 'fme-estim', successId: 'fse-estim', errorId: 'ferr-estim' });

    var po = document.querySelector('#fme-estim [name=page_origine]');
    if (po) po.value = window.location.href;
  });
})();
