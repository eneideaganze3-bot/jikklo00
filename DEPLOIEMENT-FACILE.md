# JIKKLO V4.2.2 — Déploiement facile

Cette archive est préparée pour un déploiement Cloudflare en trois éléments :

1. **API Worker** : `jikklo-os-v3/api` → `jikklo-api`
2. **Site public** : `site/` → `jikklo-site`
3. **Jikklo OS Admin** : `jikklo-os-v3/os-frontend` → `jikklo-os`

> Aucun secret n'est inclus dans cette archive.

## 1. API — installation et vérification

Dans Codespaces :

```bash
cd /workspaces/jikklo/jikklo-os-v3/api
npm install
npm run typecheck
npm test
```

Si les trois commandes passent, appliquer les migrations distantes :

```bash
npm run db:migrate:remote
```

Puis configurer les secrets **une seule fois** :

```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put WHATSAPP_API_TOKEN
npx wrangler secret put WHATSAPP_PHONE_NUMBER_ID
```

`WHATSAPP_*` peut rester non configuré si WhatsApp n'est pas encore utilisé. **Ne mets jamais ces valeurs dans un fichier du ZIP.**

Déployer l'API :

```bash
npm run deploy
```

## 2. Site public

Dans un nouveau terminal :

```bash
cd /workspaces/jikklo/site
npx wrangler pages deploy . --project-name=jikklo-site
```

## 3. Jikklo OS

```bash
cd /workspaces/jikklo/jikklo-os-v3/os-frontend
npm install
npm run build
npx wrangler pages deploy dist --project-name=jikklo-os
```

## 4. Après déploiement

Vérifier :

- `https://jikklo-site.pages.dev`
- `https://jikklo-os.pages.dev`
- l'URL du Worker `jikklo-api`
- inscription/connexion client
- création d'une commande
- affichage de la commande dans l'OS
- détail du paiement
- confirmation d'un paiement depuis l'OS

## 5. Important

Le fichier `jikklo-os-v3/api/wrangler.toml` contient déjà l'identifiant D1 de `jikklo-db`. **Ne recrée pas une nouvelle base D1 et ne remplace pas cet identifiant sans raison.**

Les migrations `0001` à `0007` sont incluses et doivent être appliquées dans l'ordre par Wrangler.

Le suivi de stock est piloté explicitement par `products.track_stock`. Les services/recharges peuvent donc avoir `track_stock = 0` sans ligne d'inventaire.
