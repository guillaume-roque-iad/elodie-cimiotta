# Vérification SEO Team Lucky — 29 octobre 2026

Source : dépôt guillaume-roque-iad/elodie-cimiotta, branche team-lucky.
La page d’accueil en production a été comparée à cette branche avant modification : seule la suppression des commentaires Cloudflare email_off différait.

## Changements

| Fichier | Modification | Raison SEO |
| --- | --- | --- |
| index.html, es/index.html, ca/index.html, pt/index.html, it/index.html, de/index.html, en/index.html | Groupe complet de 7 langues + x-default, Català au sélecteur, Organization et Person, 4 articles liés ; sessions expirées archivées dans le HTML | Cohérence internationale, découverte des pages et contenu à jour |
| mentions-legales.html, es/aviso-legal.html, ca/avis-legal.html | Canonique sans .html, hreflang fr/es/ca + x-default | Éliminer les signaux contradictoires et viser les équivalents réels |
| Tous les HTML modifiés | Liens internes .html remplacés par leurs URL finales | Éviter les redirections internes |
| conseils/index.html et ses 5 traductions | Hreflang réciproques et BreadcrumbList | Relier les index de conseils et expliciter leur position |
| conseils/*/index.html et leurs 5 traductions (24 articles) | Article enrichi/conservé, dateModified réelle, BreadcrumbList, liens vers 3 articles et accueil local | Découverte des articles, métadonnées cohérentes |
| simulateur.html | 466 mots statiques, 4 FAQ visibles + FAQPage, BreadcrumbList, iframe sur URL propre | Contenu lisible sans JavaScript ; expliciter limites et fonctionnement |
| preparer-mon-projet.html | Liens légaux propres, aucun hreflang | Ne pas inventer de traductions |
| sitemap.xml | 42 URL canoniques, lastmod documentés, annotations issues des heads | Une source cohérente pour les moteurs |
| scripts/generate_sitemap.py, seo/content-dates.json | Générateur Python standard ; empreinte de contenu + date éditoriale explicite | lastmod stable entre builds, refus d’une date inventée |
| scripts/check_seo.py | Contrôles de liens, formulaires, styles, JSON-LD, FAQ, sessions, langues et sitemap | Détecter les régressions |
| seo/liens-tribu-immo.html, seo/liens-elodie-cimiotta.html | Deux blocs intégrables, FR/ES | Liens externes descriptifs ; intégration hors dépôt non effectuée |

Les feuilles CSS, les blocs style, les formulaires et robots.txt sont conservés. Le noindex préexistant de simulateur-outil.html reste intact : c’est l’outil embarqué, pas la page publique /simulateur. Il est exclu du sitemap, ainsi que 404.html. Aucun nouveau noindex ajouté. Les profils sociaux inconnus sont signalés [À COMPLÉTER] dans un commentaire HTML, jamais dans sameAs.

Le groupe catalan n’a pas de faux articles : son bloc de conseils renvoie explicitement aux articles FR avec lang/hreflang fr. Les 6 autres accueils renvoient à leurs 4 articles locaux.

Les dates visibles EN/DE et une date CA étaient décalées d’un jour par rapport aux attributs datetime existants ; elles ont été alignées. Aucun nouveau rendez-vous créé. Les sessions de septembre et d’octobre restent archivées comme texte, sans lien Meet ni inscription pour une session expirée. Le script existant team-lucky-v7.js continue d’archiver les futures sessions après expiration ; le HTML est correct à la date de cette publication.

## Commandes locales

```sh
# Générateur sans dépendance externe
python3 scripts/generate_sitemap.py --check
# Lors d’une vraie modification éditoriale, utiliser sa date réelle :
python3 scripts/generate_sitemap.py --modified YYYY-MM-DD
# Validation locale (nécessite lxml)
python3 scripts/check_seo.py
python3 -c 'import xml.etree.ElementTree as E; E.parse("sitemap.xml"); print("XML valide")'
node --check team-lucky-v7.js
```

Le générateur échoue si une page a changé sans date éditoriale fournie. Ne pas utiliser la date de build comme dernière modification systématique. Régénérer après les changements des HTML. Les annexes seo/*.html sont des fragments à intégrer, exclus du sitemap.

## Contrôles après déploiement

```sh
curl -sI https://team-lucky.com/mentions-legales
# 200 direct
curl -sI https://team-lucky.com/mentions-legales.html
# 308 permanent vers /mentions-legales
curl -sI https://team-lucky.com/es/aviso-legal
curl -sI https://team-lucky.com/ca/avis-legal
curl -sI https://team-lucky.com/es
# 308 permanent vers /es/
curl -sI https://team-lucky.com/es/
# 200 direct
curl -sI https://team-lucky.com/en/simulateur
# 404 ; aucun lien interne n’y mène
curl -s https://team-lucky.com/ca/ | grep -o '<link[^>]*hreflang[^>]*>'
# fr, es, ca, pt, it, de, en, x-default
curl -s https://team-lucky.com/simulateur | grep -o 'Comment fonctionne ce simulateur'
curl -s https://team-lucky.com/sitemap.xml -o /tmp/team-lucky-sitemap.xml
python3 -c 'import xml.etree.ElementTree as E; E.parse("/tmp/team-lucky-sitemap.xml"); print("XML valide")'
# Vérification réseau de chaque URL du sitemap (200 sans redirection) :
python3 scripts/check_live.py
```

Valider les types et propriétés dans https://validator.schema.org/ ; tester /simulateur et un article dans https://search.google.com/test/rich-results. Un JSON-LD valide ne garantit pas l’affichage d’un résultat enrichi. Ces services ne sont pas remplacés par le simple contrôle JSON local.

## Procédure Search Console après publication

1. Choisir la propriété de domaine team-lucky.com. Identifier l’ancienne entrée de sitemap ganbanyoku et la retirer des sitemaps soumis si elle est bien héritée. Cela ne supprime pas à lui seul une URL de l’index.
2. Envoyer https://team-lucky.com/sitemap.xml et vérifier sa lecture ainsi que les 42 URL attendues.
3. Inspection d’URL : accueil FR, test en direct, puis Demander l’indexation.
4. Répéter pour les 4 articles FR : reconversion-immobilier-sans-experience-commerciale, changer-reseau-immobilier-criteres-verifier, organiser-30-premiers-jours-conseiller-immobilier, demarrer-conseiller-immobilier-temps-partiel (tous sous /conseils/ avec slash final).
5. Sur chaque motif corrigé, utiliser « Valider la correction » uniquement si Search Console propose cette action. Les motifs « Détectée, actuellement non indexée » ou « Explorée, actuellement non indexée » n’offrent pas nécessairement ce bouton ; utiliser l’inspection, le sitemap et le suivi du rapport.
6. Suivre les visites Googlebot et l’indexation. Ni le sitemap, ni les données structurées, ni une demande d’indexation ne garantissent l’indexation. Un volume de mots n’est pas un seuil technique d’admission dans Google.

Aucune action Search Console effectuée par ces scripts ; procédure à exécuter dans la propriété après mise en ligne.

## Résultats observés après mise en ligne

- Les 42 URL du sitemap renvoient un 200 direct, sans redirection.
- Le sitemap servi par le domaine correspond exactement au fichier généré.
- Les anciennes URL légales .html et /es sans slash renvoient une redirection permanente 308 native de Cloudflare, vers la destination propre en une étape. Le diagnostic initial mentionnait 301 ; aucun changement d’infrastructure ajouté pour remplacer ce 308.
- /en/simulateur renvoie 404 ; aucun lien interne ne mène à cette URL.
- Le navigateur affiche le simulateur embarqué fonctionnel et le bloc éditorial statique sous l’outil, avec les quatre FAQ.
- Vérification locale : 44 pages, 42 URL dans le sitemap, JSON-LD valides, annotations réciproques, FAQ conforme au texte visible, tous les formulaires et styles préservés.
- Sept ancres de contact rompues préexistantes corrigées : #contacto en ES et #contacte en CA, sans modifier les formulaires.
- Rich Results Test et validateur schema.org : procédure fournie, pas de validation distante exécutée. Aucun affichage enrichi promis.
- Search Console : procédure fournie ; aucune soumission ou demande d’indexation effectuée.
