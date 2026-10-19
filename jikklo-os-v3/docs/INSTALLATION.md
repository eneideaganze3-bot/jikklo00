# INSTALLATION.md — Installation locale, étape par étape

## 1. Prérequis (une seule fois)

- **Node.js** 18+ : https://nodejs.org (version "LTS")
- **Compte Cloudflare** gratuit : https://dash.cloudflare.com/sign-up

Vérifie :
```bash
node --version
npm --version
```

## 2. Dépendances

```bash
cd api && npm install
cd ../os-frontend && npm install
```
(`public-site/` n'a besoin d'aucune installation — c'est du HTML/JS pur.)

## 3. Connexion Cloudflare

```bash
npx wrangler login
```
Une page web s'ouvre — connecte-toi avec ton compte Cloudflare.

## 4. Base de données

Voir `docs/D1_SETUP.md` pour le détail. En résumé :
```bash
cd api
npx wrangler d1 create jikklo-db
# copier le database_id dans api/wrangler.toml
npm run db:migrate:local
node ../scripts/create-admin.mjs "Ton Nom" "admin@jikklo.com" "MotDePasse123!"
# exécuter la commande affichée par le script
```

## 5. Secrets locaux

```bash
cd api
cp .env.example .dev.vars
```
Remplis au moins `JWT_SECRET` (valeur aléatoire longue, ex:
`openssl rand -base64 48`).

## 6. Lancer l'API

```bash
cd api
npm run dev
```
→ `http://localhost:8787`

## 7. Lancer JIKKLO OS

Nouveau terminal :
```bash
cd os-frontend
cp .env.example .env
npm run dev
```
→ `http://localhost:5173`

## 8. Lancer le site public

Nouveau terminal :
```bash
cd public-site
npx serve . -p 4321
```
→ `http://localhost:4321`

## Vérifier que tout fonctionne

1. `http://localhost:8787/health` → `{"status":"ok",...}`
2. `http://localhost:5173` → page de connexion JIKKLO OS, connecte-toi avec ton admin
3. `http://localhost:4321` → catalogue (vide tant qu'aucun produit n'est publié dans JIKKLO OS)

Pour le déploiement en production, voir `docs/DEPLOYMENT.md`.
