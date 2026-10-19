# JIKKLO V4.2 — Corrections de préparation au déploiement

Cette archive a été préparée pour éviter les modifications manuelles de configuration avant le déploiement.

## Corrections effectuées

- Account ID Cloudflare renseigné dans `jikklo-os-v3/api/wrangler.toml`.
- D1 `jikklo-db` renseignée avec son `database_id` existant.
- `ENVIRONMENT` réglé sur `production`.
- Wrangler relevé vers la branche majeure v4 dans l'API et le frontend.
- URL de production `https://api.jikklo.com` ajoutée au build de JIKKLO OS via `.env.production`.
- Aucun token Cloudflare, JWT ou credential WhatsApp n'est inclus.
- Vérification syntaxique de tous les fichiers JavaScript réussie.
- Le code reste organisé avec `site/` comme site public, `jikklo-os-v3/api/` comme Worker et `jikklo-os-v3/os-frontend/` comme interface Admin.

## À faire après import GitHub

Les seuls éléments secrets restent à configurer avec Wrangler (`JWT_SECRET` et,
si nécessaire, les secrets WhatsApp). Les migrations D1 doivent ensuite être
appliquées sur la base existante avant les tests fonctionnels.

---

# Passe de correction complémentaire (V4.2.1)

## Bugs corrigés

- **Migration `0002` — erreur SQL bloquante sur base vierge** : un
  `INSERT ... SELECT ... ON CONFLICT DO NOTHING` sans `WHERE` provoque une erreur
  de syntaxe SQLite (`near "DO"`). Ajout de `WHERE true`. Les migrations
  `0001` à `0007` s'appliquent maintenant sans erreur sur une base vide.
  Sur ta base D1 existante, rien ne change (migration déjà enregistrée).
- **Tests inexécutables** : `npm test` dans `api/` ne trouvait aucun test (ils
  étaient hors du dossier), et la config racine dépendait d'un `node_modules`
  inexistant. Les tests sont déplacés dans `jikklo-os-v3/api/tests/`, la config
  vitest (pool Workers + D1 en mémoire) est dans `api/vitest.config.ts`.
  Tout se lance depuis `jikklo-os-v3/api` : `npm run typecheck && npm test`.
- **Guide de déploiement** : les commandes `wrangler` des étapes 3 à 5 étaient
  lancées depuis `os-frontend/` (sans `wrangler.toml`) et auraient échoué ;
  `wrangler login` ne marche pas dans un Codespace. Guide réécrit : chemins
  explicites, authentification par token API, secrets sans écrasement du
  `JWT_SECRET` existant, projets Pages créés explicitement.

## Ajouts

- `.gitignore` (évite de committer `node_modules`, `dist`, `.dev.vars`, `.env`).
- Favicon de JIKKLO OS (`os-frontend/public/favicon.svg`) : l'ancien lien
  pointait vers un `favicon.png` inexistant.
- Avertissement en tête de `database/schema.sql` : fichier de référence qui ne
  contient pas les tables de la migration `0006`.
- Nom de projet Pages unifié (`jikklo-site`) dans `docs/`.

## Vérifié ici

- Migrations `0001` à `0007` appliquées en mémoire (SQLite 3.51) : OK.
- Les 23 permissions utilisées par le code existent en base et sont
  attribuées au `super_admin`.
- Tests de logique pure (auth/JWT, totaux de commande, quantités, stock
  `track_stock`, message WhatsApp) : 35 / 35 passés avec un exécuteur minimal.
- `node --check` sur tous les JS du site et le script `create-admin.mjs`.
- Références `src` / `href` du site public : aucune ressource manquante.

## NON vérifié ici (pas de réseau, donc pas de `npm install`)

- `tsc --noEmit` / `npm run build` du frontend et de l'API.
- `concurrency.test.ts` (nécessite le pool Workers de vitest).
- Tout ce qui touche à ton compte Cloudflare : déploiement, droits du token,
  domaines personnalisés.
