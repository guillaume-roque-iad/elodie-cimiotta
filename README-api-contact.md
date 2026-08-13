# Raccordement du formulaire sécurisé — action requise côté Apps Script

## Contexte

Le nouveau point d'entrée `/api/contact` (Cloudflare Worker, `worker.js`) reçoit
maintenant les formulaires du site en **POST JSON**, valide et nettoie les
données côté serveur, puis relaie la demande vers le script Google Apps Script
existant :

```
https://script.google.com/macros/s/AKfycbxGm2u93FF7-Rdt2Pqbo8lKtHLc6NDC0NtAQHyA7wEnvFZ6hZHoz_OKnZfQFKfxxXMSKA/exec
```

**Blocage identifié** : cet endpoint n'était jusqu'ici appelé qu'en `GET` via
une balise `<script src="...">` (JSONP). Un script Apps Script Web App qui
n'implémente qu'une fonction `doGet(e)` renvoie, sur une requête `POST`, une
page d'erreur générique Google — pas de réponse JSON exploitable. Je n'ai pas
accès au code source de ce projet Apps Script (identifiants Google du compte
qui l'héberge), je ne peux donc pas confirmer ni compléter son implémentation.

Tant que ce point n'est pas réglé, `/api/contact` répond honnêtement par une
erreur 502 au visiteur (voir `worker.js`, testé avec `/tmp/test_worker.mjs`) —
**aucun faux message de succès n'est jamais affiché**.

## Ce qu'il faut ajouter dans le projet Apps Script

Ouvrir le projet Apps Script relié à cette URL (Extensions → Apps Script,
depuis le Google Sheet ou le projet qui reçoit déjà les emails), et ajouter
une fonction `doPost(e)` à côté de la fonction `doGet(e)` existante. Exemple
minimal, à adapter avec la logique d'envoi d'email déjà en place dans le
`doGet` actuel (je ne connais pas son contenu exact) :

```javascript
function doPost(e) {
  var data = JSON.parse(e.postData.contents);

  // Recopier ici la même logique d'envoi d'email que le doGet() existant,
  // en utilisant les champs : data.nom, data.email, data.telephone,
  // data.ville, data.pays, data.projet, data.message, data.page_origine,
  // data.destinataire.

  MailApp.sendEmail({
    to: data.destinataire,
    subject: "Nouvelle demande via elodie-cimiotta-iad.com",
    body: "Nom: " + data.nom + "\n" +
          "Email: " + data.email + "\n" +
          "Téléphone: " + data.telephone + "\n" +
          "Ville: " + data.ville + "\n" +
          "Pays: " + data.pays + "\n" +
          "Projet: " + data.projet + "\n" +
          "Message: " + data.message + "\n" +
          "Page d'origine: " + data.page_origine
  });

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

Points importants :

- La réponse **doit** être un JSON contenant `{"ok": true}` en cas de succès
  (c'est exactement ce que `worker.js` attend pour confirmer l'envoi réel).
- Le champ `destinataire` arrive maintenant depuis le Worker (jamais depuis le
  navigateur) — il vaut toujours `elodie.cimiotta@iadespana.es`.
- Le champ `site_web` (honeypot) n'est plus transmis à Apps Script du tout :
  le Worker l'intercepte et arrête la requête avant qu'elle n'atteigne Apps
  Script si un bot l'a rempli.
- Après modification, il faut redéployer le Web App (Déployer → Gérer les
  déploiements → modifier la version) pour que le nouveau `doPost` soit pris
  en compte par l'URL `/exec` déjà utilisée par le site.

## Ce qui est déjà prêt côté site

- `worker.js` : validation complète, honeypot serveur, anti-envoi-trop-rapide,
  limitation de débit par IP, aucune donnée personnelle dans les journaux,
  jamais de faux succès.
- `assets/site.js` : les formulaires (`index.html`, les 2 pages estimation)
  envoient maintenant `fetch('/api/contact', {method:'POST', ...})` — plus
  aucune donnée personnelle dans une URL, plus de callback global JSONP.
- Tests automatisés : `/tmp/test_worker.mjs` (22 assertions, toutes vertes),
  couvrant méthode refusée, origine refusée, honeypot, anti-rapid-submit,
  validation email, troncature de longueur, neutralisation de caractères
  dangereux, limitation de débit, et les deux scénarios d'upstream (échec
  actuel réel / succès une fois `doPost` ajouté).

Dès que `doPost` est en place et redéployé, aucune autre modification n'est
nécessaire côté site : `/api/contact` détectera automatiquement la réponse
JSON `{"ok":true}` et renverra un vrai succès aux visiteurs.
