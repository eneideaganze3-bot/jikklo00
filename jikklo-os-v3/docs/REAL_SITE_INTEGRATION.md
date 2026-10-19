# Intégration du vrai site jikklo.com avec JIKKLO OS V3

Ce document remplace, pour ce qui concerne le site public, l'ancien
`docs/JIKKLO_PUBLIC_SITE_INTEGRATION.md` qui décrivait le dossier
`public-site/` (une reconstruction de démonstration). **Le vrai frontend
jikklo.com** (fourni séparément, dossier `site/` dans le livrable
`JIKKLO-INTEGRATED-V3.zip`, ou `Jikklo-Version-002-Ecommerce` dans son zip
d'origine) est maintenant celui à déployer sur jikklo.com — `public-site/`
reste dans le dépôt uniquement comme référence, il n'est plus destiné à être
mis en ligne.

## 1. Ce qui a été intégré

| Domaine | Avant | Après |
|---|---|---|
| Catalogue | `js/products.js`, données statiques | `GET /api/public/products`, `/products/:id`, `/categories` — Cloudflare D1 |
| Panier | `{id, qty, price}` en localStorage | `{id, qty}` uniquement — le prix est relu à l'affichage via l'API |
| Checkout | Construction du message WhatsApp côté navigateur, numéro de commande généré côté client | `POST /api/orders/public/create` — prix, stock, livraison, total et numéro de commande recalculés et générés côté serveur |
| Contact | Formulaire validé mais non envoyé (site statique) | `POST /api/public/contact` — crée une notification interne dans JIKKLO OS |
| WhatsApp | `js/whatsapp.js` construisait le message ET ouvrait WhatsApp pour "commander" | `js/whatsapp.js` ne sert plus qu'à des liens de **prise de contact rapide** (un produit, hors commande officielle). Le message d'une vraie commande est désormais généré par le serveur (`whatsappMessage` dans la réponse de création de commande) |
| CORS | Bug : une origine inconnue recevait quand même l'autorisation de la première origine de la liste | Corrigé : une origine hors de `ALLOWED_ORIGINS` est refusée |

## 2. Nouveau fichier central : `js/api.js`

Toutes les requêtes vers l'API passent par `window.JIKKLO_API` (défini dans
`js/api.js`). Un seul endroit connaît l'URL de l'API :

```js
// URL résolue automatiquement selon l'environnement :
// - localhost / 127.0.0.1  → http://localhost:8787
// - toute autre origine    → https://api.jikklo.com
// Surchargeable manuellement avant le chargement de api.js :
window.JIKKLO_API_BASE_OVERRIDE = "https://staging-api.jikklo.com";
```

## 3. Catalogue — `js/catalog-data.js`

Ce nouveau fichier interroge l'API au chargement de chaque page et normalise
la réponse dans la forme attendue par le code existant (`catalog.js`,
`cart.js`, `product.js`, `energy.js`). Il expose `window.JIKKLO_CATALOG` :

- `ready` — Promise résolue une fois le premier chargement terminé.
- `getAll()` / `getById(id)` — lecture synchrone des données déjà en mémoire.
- `hasError()` — **si l'API est injoignable, ce module ne retombe JAMAIS sur
  d'anciens prix statiques.** Les pages affichent alors un message
  "Impossible de charger les informations actuellement. Veuillez réessayer."
  (voir `shop.loadError` dans `translations.js`).

`js/products.js` est conservé uniquement comme jeu de données de secours
pour des tests hors-ligne ponctuels — sa variable globale a été renommée
`JIKKLO_DEV_FALLBACK_PRODUCTS` pour qu'aucun code de production ne puisse
s'y raccrocher par erreur.

### Catégories : le pont entre les deux modèles

JIKKLO OS modélise deux **activités** (`energy` / `digital`) + des
**catégories** libres en base (ex: "Carburant", "Huiles moteur"). Le vrai
site utilise 4 filtres "haut niveau" : Énergie / Lubrifiants / Automobile /
Digital. Le pont est la nouvelle colonne `products.subcategory`
(migration `0005_bilingual_public_content.sql`) :

```js
// js/catalog-data.js
{
  fuel: "energy",
  "engine-oil": "lubricants",
  grease: "lubricants",
  accessories: "automotive",
  care: "automotive",
  topup: "digital",
}
```

Un produit dont la sous-catégorie n'est pas listée retombe sur son
`activity` brute. **À terme, il serait plus propre que JIKKLO OS permette de
choisir directement cette catégorie "haut niveau" depuis l'interface
d'administration** plutôt que de la déduire — c'est une amélioration à
discuter ensemble, pas faite dans cette intégration pour ne pas modifier
l'interface de JIKKLO OS sans votre accord.

### Contenu bilingue par produit

Le schéma D1 (V1/V2/V3) ne stockait qu'une seule langue par produit. Le vrai
site est bilingue par produit (nom, description, description longue,
caractéristiques). La migration `0005_bilingual_public_content.sql` ajoute
des colonnes nullables : `name_en`, `description_en`, `details_fr/en`,
`characteristics_fr/en`. Convention retenue :

- `products.name` / `products.description` = version **française** (l'équipe
  JIKKLO opère en français).
- Les colonnes `*_en` = version anglaise, à saisir dans JIKKLO OS.
- Tant qu'un produit n'a pas de version anglaise saisie, l'API renvoie la
  version française en repli pour `en` — mieux vaut du français affiché que
  rien du tout, en attendant la traduction.

## 4. Panier — `js/cart.js`

Le panier reste en `localStorage`, mais chaque entrée ne contient plus que
`{ id, qty }`. Le prix est relu à chaque rendu depuis `window.JIKKLO_CATALOG`.
Un produit dont l'`id` n'existe plus dans le catalogue (supprimé/dépublié
côté JIKKLO OS) disparaît silencieusement du panier au prochain rendu.

## 5. Checkout — `js/checkout.js`

Le navigateur envoie uniquement :

```json
{
  "customerName": "...",
  "customerPhone": "...",
  "items": [{ "productId": "...", "quantity": 2 }],
  "deliveryMode": "pickup",
  "deliveryAddress": "",
  "notes": ""
}
```

à `POST /api/orders/public/create`. **Aucun prix ni total n'est envoyé** —
le serveur les recalcule systématiquement depuis D1, dans une transaction
atomique (`env.DB.batch()`) qui garantit qu'en cas de commandes simultanées
sur un dernier article, une seule réussit.

Réponse utilisée par le frontend :

```json
{
  "orderId": "...",
  "orderNumber": "JKK-2026-000001",
  "total": 11000,
  "currency": "CDF",
  "whatsappMessage": "...",
  "whatsappSent": false,
  "whatsappConfigured": false
}
```

- Si `whatsappConfigured` est `false` (pas de credentials Meta), le site
  affiche un bouton "Confirmer via WhatsApp" pré-rempli avec
  `whatsappMessage`, vers le numéro `JIKKLO_WHATSAPP` de `js/config.js`.
- Si `whatsappConfigured` est `true`, JIKKLO OS a déjà envoyé le message —
  le site affiche juste la confirmation.

Erreurs gérées explicitement : `INSUFFICIENT_STOCK`, `VALIDATION_ERROR`,
tout le reste retombe sur un message générique de réessai.

## 6. Contact — `js/contact.js`

Envoie réellement `POST /api/public/contact`. **Important : cet endpoint ne
déclenche aucun email** — il crée une notification interne visible dans
JIKKLO OS uniquement (pas de service d'emailing configuré côté serveur pour
rester sur le socle Cloudflare gratuit). Les textes de confirmation dans
`translations.js` (6 langues) ont été corrigés en conséquence : ils ne
promettent plus de confirmation par email, et n'affirment plus que "le site
est statique".

## 7. CORS

Bug corrigé dans `api/src/index.ts` : une origine absente de
`ALLOWED_ORIGINS` recevait auparavant la première origine autorisée de la
liste au lieu d'être refusée. Elle est maintenant refusée (le navigateur
bloque la lecture de la réponse côté client). `ALLOWED_ORIGINS` doit inclure
`https://jikklo.com`, `https://www.jikklo.com`, `https://app.jikklo.com`,
et vos environnements locaux — à vérifier dans `wrangler.toml` /
variables d'environnement lors du déploiement.

## 8. Ce qui n'a délibérément PAS été fait

- **Espace client (login/register/compte/historique de commandes)** — les
  routes API existent déjà (`/api/customer/*`, exposées dans `js/api.js` via
  `JIKKLO_API.customer.*`), mais le vrai site n'a pas de pages
  `login.html`/`account.html`. Les ajouter changerait la structure du site ;
  ce n'était pas listé comme prioritaire dans le brief et modifie le design
  existant, donc laissé à faire avec vous.
- **Images produits (Cloudflare R2)** — le binding est préparé côté API,
  mais aucun credential R2 n'est disponible ici. Tant qu'aucune image n'est
  configurée dans JIKKLO OS, le site affiche une icône de catégorie plutôt
  que de tenter de charger une image inexistante.
- **Interface JIKKLO OS pour saisir les champs bilingues** — la migration et
  l'API acceptent déjà `nameEn`, `descriptionEn`, etc., mais l'interface
  d'administration (`os-frontend/`) n'a pas été modifiée pour exposer ces
  champs dans ses formulaires — à faire si vous le souhaitez, pour l'instant
  ils sont modifiables via l'API directement (ex: Postman, ou un script).

## 9. Test local

```bash
# Terminal 1 — API
cd jikklo-os-v3/api
npm install
npm run dev          # http://localhost:8787

# Terminal 2 — site public réel
cd site
python3 -m http.server 4321   # http://localhost:4321

# Terminal 3 — JIKKLO OS (admin), optionnel pour ce test
cd jikklo-os-v3/os-frontend
npm install
npm run dev           # http://localhost:5173
```

## 10. Test de synchronisation (à rejouer une fois Cloudflare configuré)

1. Dans JIKKLO OS, fixez le prix de l'Essence à 5 500 FC.
2. Sur jikklo.com (ou `localhost:4321`), rechargez `energy.html` → 5 500 FC affiché.
3. Dans JIKKLO OS, changez le prix à 6 000 FC.
4. Rechargez `energy.html` → 6 000 FC affiché, **sans avoir modifié aucun fichier frontend.**

## 11. Variables à configurer avec vous (Cloudflare)

Voir `INTEGRATION-AUDIT.md` à la racine du livrable, section 🟡/🔵.
