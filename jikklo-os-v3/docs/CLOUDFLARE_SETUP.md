# CLOUDFLARE_SETUP.md — Connexion des domaines

Ce document explique exactement comment connecter `jikklo.com`,
`app.jikklo.com` et `api.jikklo.com` — étape par étape, sans supposer que tu
es développeur. **Rien de ceci n'est fait automatiquement** : je n'ai pas
accès à ton compte Cloudflare.

## Prérequis

- `jikklo.com` doit déjà être ajouté à ton compte Cloudflare (Dashboard →
  "Add a site") avec les nameservers pointés correctement (déjà fait
  normalement puisque le site actuel y est hébergé).
- `npx wrangler login` déjà exécuté (voir `docs/INSTALLATION.md`).

## 1. api.jikklo.com → Worker API

Après avoir déployé l'API (`cd api && npm run deploy`), dans
`api/wrangler.toml`, décommente :
```toml
routes = [
  { pattern = "api.jikklo.com/*", zone_name = "jikklo.com" }
]
```
Puis redéploie : `npm run deploy`. Wrangler crée automatiquement
l'enregistrement DNS nécessaire.

## 2. app.jikklo.com → JIKKLO OS (Cloudflare Pages)

```bash
cd os-frontend
npm run build
npx wrangler pages deploy dist --project-name=jikklo-os
```
Puis : Dashboard Cloudflare → Workers & Pages → `jikklo-os` → Custom domains
→ Add → `app.jikklo.com`.

## 3. jikklo.com → site public (Cloudflare Pages)

```bash
cd public-site
npx wrangler pages deploy . --project-name=jikklo-site
```
Puis : Dashboard → Workers & Pages → `jikklo-site` → Custom domains → Add →
`jikklo.com` (et `www.jikklo.com` si besoin).

**⚠️ Important** : ça ne remplace le site actuellement en ligne que lorsque
tu ajoutes explicitement le domaine personnalisé à ce nouveau projet Pages.
Teste d'abord sur l'URL `*.pages.dev` fournie automatiquement par Cloudflare
avant de basculer le vrai domaine.

## 4. Secrets de production

```bash
cd api
npx wrangler secret put JWT_SECRET
# Optionnel, voir docs/WHATSAPP_SETUP.md :
npx wrangler secret put WHATSAPP_API_TOKEN
npx wrangler secret put WHATSAPP_PHONE_NUMBER_ID
```

## 5. Vérifier que tout communique

1. `https://api.jikklo.com/health` doit répondre `{"status":"ok",...}`.
2. `https://app.jikklo.com` doit afficher la page de connexion JIKKLO OS.
3. `https://jikklo.com` doit afficher le catalogue (si des produits sont publiés).

Si une de ces URLs ne répond pas, vérifie dans le Dashboard Cloudflare que
le domaine personnalisé est bien listé sous le bon projet (Workers & Pages).
