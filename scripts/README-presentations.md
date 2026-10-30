# Agenda des présentations

`editorial/presentations.json` est la source des dates, horaires, lieux, langues proposées et liens d’inscription. Les heures sont interprétées dans le fuseau `Europe/Paris` ; le générateur calcule les décalages hiver/été et les libellés des sept langues sans utiliser le fuseau du navigateur.

Le calendrier reprend les trois POA de Narbonne du 12 janvier, du 20 avril et du 29 juin 2027, de 18 h 30 à 19 h 30. La visio du 10 novembre 2026, de 18 h 30 à 19 h 15, reste proposée sur l’accueil français uniquement. Les liens français vers Tribu Immo et Billetweb, ainsi que les demandes via le formulaire dans les autres langues, sont conservés.

## Mise à jour avant publication

1. Vérifier les nouvelles dates et liens auprès de leur source, puis modifier le JSON. Conserver les anciennes dates dans `archivedDates` ou les événements passés dans `events`.
2. Régénérer les cartes, les choix du formulaire et les archives dans le HTML initial :

   ```sh
   python3 scripts/generate_presentations.py --as-of 2026-10-30T10:00:00+01:00
   ```

   Remplacer la date de référence par celle de la publication. Une valeur sans fuseau est interprétée en heure de Paris. Sans `--as-of`, le script utilise l’heure courante. Le même JSON et la même référence produisent le même contenu.

3. Contrôler le résultat sans écrire les fichiers, puis exécuter les régressions :

   ```sh
   python3 scripts/generate_presentations.py --as-of 2026-10-30T10:00:00+01:00 --check
   python3 scripts/test_presentations.py
   node --check team-lucky-v7.js
   ```

Le générateur ne modifie ni les métadonnées SEO, ni le sitemap, ni les autres champs du formulaire. Le contrôle `--check` signale un HTML à régénérer avec un code de sortie 1. Aucune inscription n’est envoyée par ces commandes.

## Entre deux publications

Le script du site retire les cartes et options à partir de l’heure de début de la présentation, puis conserve leur date dans l’archive. Il vérifie aussi une page rouverte et les choix avant envoi du formulaire ; un choix expiré demande une nouvelle sélection. Il ne recrée pas les options françaises et ne calcule aucun libellé de date à partir d’une autre source.

Ce garde-fou améliore le rendu d’une page restée ouverte. Pour actualiser également le HTML initial après le passage d’une date, relancer le générateur lors de la prochaine publication. Aucune tâche planifiée supplémentaire n’est créée.
