# R2_SETUP.md — Stockage des images produits

## État actuel

Le code d'upload/suppression d'images (`api/src/routes/media.ts`) est
complet et fonctionnel, mais **le binding R2 n'est pas activé** dans
`api/wrangler.toml` — je n'ai pas accès à ton compte Cloudflare pour créer le
bucket. Sans lui, `/api/admin/media/upload` répond honnêtement :

```json
{ "success": false, "error": { "code": "NOT_CONFIGURED", "message": "Le stockage d'images (R2) n'est pas configuré sur ce déploiement." } }
```

Ce n'est PAS une erreur cachée — c'est volontaire (règle #93 des cahiers des
charges précédents : jamais de fausse fonctionnalité qui semble marcher).

## Ce que tu dois faire

### 1. Créer le bucket
```bash
cd api
npx wrangler r2 bucket create jikklo-assets
```

### 2. Activer le binding
Dans `api/wrangler.toml`, décommente :
```toml
[[r2_buckets]]
binding = "ASSETS"
bucket_name = "jikklo-assets"
```

### 3. Redéployer
```bash
npm run deploy
```

C'est tout — aucune autre configuration n'est nécessaire, le code gère déjà :
- validation stricte du type MIME (JPEG/PNG/WEBP uniquement) ;
- limite de taille (5 Mo) ;
- noms de fichiers générés aléatoirement (jamais le nom fourni par l'utilisateur, pour éviter tout risque de traversée de chemin) ;
- association automatique à la fiche produit (`product_images`) ;
- suppression propre (retire à la fois le fichier R2 et la ligne en base).

## Rendre les images publiquement accessibles

Par défaut, un bucket R2 n'est pas accessible via une URL publique. Deux options :

**Option simple (recommandée pour démarrer) — domaine R2.dev public :**
Dashboard Cloudflare → R2 → ton bucket `jikklo-assets` → Settings → "Public
access" → active l'URL `r2.dev`. Les URLs stockées en base
(`product_images.url`, ex: `products/prod_xxx/uuid.jpg`) devront alors être
préfixées par cette URL publique côté frontend.

**Option avancée — domaine personnalisé (ex: `cdn.jikklo.com`) :**
Dashboard Cloudflare → R2 → ton bucket → Settings → Custom Domains. Nécessite
que `jikklo.com` soit déjà géré par ce compte Cloudflare.

## Coût

R2 a un palier gratuit généreux (10 Go de stockage, 1 million de requêtes
Classe A/mois, 10 millions Classe B/mois au moment de la rédaction — vérifie
les tarifs actuels sur cloudflare.com/r2, ils peuvent évoluer). Pour des
photos de produits d'une petite entreprise, il est très probable que tu
restes dans le palier gratuit longtemps.
