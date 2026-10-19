# JIKKLO_PUBLIC_SITE_INTEGRATION.md

## Contexte

Je n'ai pas accès au code source réel actuellement en ligne sur jikklo.com —
seulement à son rendu HTML public. Le dossier `public-site/` de ce projet
est donc une **reconstruction**, pas une modification du vrai fichier
existant (voir `AUDIT-V3.md`, section 🔴).

**Quand tu me fourniras le vrai code source**, voici exactement ce qu'il
faudra y brancher pour qu'il fonctionne avec l'API JIKKLO — sans toucher au
backend, qui est déjà prêt à le recevoir.

## Variable de configuration

Le frontend doit connaître l'URL de l'API :
```
PUBLIC_API_URL=https://api.jikklo.com
```
(en dev : `http://localhost:8787`)

Dans `public-site/assets/js/api.js` (la reconstruction actuelle), c'est fait
via `window.JIKKLO_API_BASE`. Si le vrai site utilise un framework (Next.js,
Astro, etc.), utilise plutôt une vraie variable d'environnement de build
(`NEXT_PUBLIC_API_URL`, `PUBLIC_API_URL` selon le framework).

## Règle d'or

**Toutes les requêtes vers l'API doivent inclure `credentials: "include"`**
(fetch) pour que les cookies de session (client) soient envoyés/reçus. Sans
ça, la connexion client semblera fonctionner (200 OK) mais la session ne
persistera pas.

## Catalogue

```
GET /api/public/products?activity=energy|digital&category=slug
GET /api/public/products/:id
GET /api/public/categories
```
Aucune authentification requise. Ne retourne que les produits au statut
`published`. Le prix (`sale_price`), la devise (`currency`) et le stock
(`stock_quantity`) sont TOUJOURS à lire depuis cette réponse — ne jamais les
coder en dur côté frontend, même pour un produit "vedette" affiché en page
d'accueil.

## Panier

Le panier n'a pas besoin d'appeler l'API — c'est un état purement côté
client (localStorage ou équivalent), qui ne doit contenir QUE
`{ productId, quantity }`, jamais de prix. Le prix affiché dans le panier
doit être relu en direct via `GET /api/public/products` à chaque affichage,
pas mis en cache. Voir `public-site/assets/js/cart.js` pour un exemple
minimal.

## Créer une commande

```
POST /api/orders/public/create
Content-Type: application/json
credentials: include

{
  "customerName": "...",
  "customerPhone": "...",
  "items": [{ "productId": "...", "quantity": 2 }],
  "deliveryMode": "pickup" | "delivery",
  "deliveryAddress": "...",   // si delivery
  "notes": "..."              // optionnel
}
```
Le serveur recalcule TOUT (prix, stock, livraison, total) — n'envoie jamais
de prix ou de total depuis le frontend, ils seraient ignorés de toute façon.

Réponse (201) :
```json
{
  "orderId": "...",
  "orderNumber": "JKK-2026-000001",
  "total": 27000,
  "currency": "CDF",
  "whatsappMessage": "...",
  "whatsappSent": false,
  "whatsappConfigured": false
}
```
Si `whatsappConfigured` est `false`, affiche un bouton utilisant
`whatsappMessage` avec un lien `https://wa.me/?text=<encodeURIComponent(whatsappMessage)>`
comme solution de repli (c'est ce que fait la reconstruction actuelle).

Erreurs possibles : `409 INSUFFICIENT_STOCK` (stock devenu insuffisant,
possiblement à cause d'une commande concurrente — proposer au client de
réessayer), `400 VALIDATION_ERROR` (données invalides).

## Suivi de commande

```
GET /api/orders/public/track/:orderNumber
```
Public, pas d'authentification. Retourne uniquement statut/total/dates —
aucune donnée client sensible.

## Authentification client

```
POST /api/customer/register   { fullName, phone, email?, password }
POST /api/customer/login      { phone, password }
POST /api/customer/logout
GET  /api/customer/me
PATCH /api/customer/me        { fullName?, email?, address?, city? }
GET  /api/customer/orders
GET  /api/customer/orders/:id
```
Toutes avec `credentials: "include"`. Le cookie de session est posé/lu
automatiquement par le navigateur — pas besoin de gérer un token
manuellement.

## Gestion des erreurs

Toute réponse d'erreur suit le format :
```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```
Utilise `error.code` pour la logique (ex: afficher un message spécifique si
`INSUFFICIENT_STOCK`), et `error.message` (déjà en français) pour l'affichage
direct si tu n'as pas de traduction dédiée. Voir `docs/API.md` pour la liste
complète des codes.

## WhatsApp côté client

Voir `docs/WHATSAPP_SETUP.md`. Le bouton "Commander via WhatsApp" sur une
fiche produit n'a besoin d'aucun appel API — génère juste un lien `wa.me`
avec le texte pré-rempli, comme dans `public-site/product/index.html`.
