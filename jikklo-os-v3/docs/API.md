# API.md — Référence complète de l'API JIKKLO

Base URL : `http://localhost:8787` (dev) ou `https://api.jikklo.com` (prod).

Toutes les réponses suivent ce format :
- Succès : `{ "success": true, ... }` (ou l'objet métier direct pour les routes historiques — voir note en fin de document)
- Erreur : `{ "success": false, "error": { "code": "...", "message": "..." } }`

L'authentification staff utilise un cookie `HttpOnly` (`jikklo_session`), et
l'espace client un cookie séparé (`jikklo_customer_session`). Les deux sont
posés automatiquement au login — le frontend doit appeler l'API avec
`credentials: "include"`.

---

## Authentification (staff)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | — | `{ email, password }` → pose le cookie de session |
| GET | `/api/auth/me` | staff | Retourne l'utilisateur connecté + ses permissions |
| POST | `/api/auth/logout` | staff | Invalide le cookie |

## Espace client public

| Méthode | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/customer/register` | — | `{ fullName, phone, email?, password }` |
| POST | `/api/customer/login` | — | `{ phone, password }` |
| POST | `/api/customer/logout` | client | — |
| GET | `/api/customer/me` | client | Profil du client connecté |
| PATCH | `/api/customer/me` | client | `{ fullName?, email?, address?, city? }` |
| GET | `/api/customer/orders` | client | Historique de commandes |
| GET | `/api/customer/orders/:id` | client | Détail d'une commande (uniquement les siennes) |

## Catalogue public (utilisé par jikklo.com)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/public/products?activity=&category=` | — | Produits publiés uniquement |
| GET | `/api/public/products/:id` | — | Détail d'un produit publié |
| GET | `/api/public/categories` | — | Liste des catégories |
| GET | `/api/settings/public` | — | Paramètres non-sensibles (nom entreprise, devise, whatsapp_enabled...) |
| POST | `/api/public/contact` | — | `{ name, email?, phone?, message }` |

## Commandes publiques

| Méthode | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/orders/public/create` | optionnel (cookie client si connecté) | `{ customerName, customerPhone, items:[{productId,quantity}], deliveryMode, deliveryAddress?, notes? }`. Le serveur revalide TOUT (prix, stock, quantité). Réponse : `{ orderId, orderNumber, total, currency, whatsappMessage, whatsappSent, whatsappConfigured }` |
| GET | `/api/orders/public/track/:orderNumber` | — | Statut et total d'une commande (sans données sensibles) |

## Admin — Produits (permission `products.view` / `products.edit`)

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/admin/products?status=&activity=&limit=&offset=` | Liste paginée |
| GET | `/api/admin/products/:id` | Détail + images |
| POST | `/api/admin/products` | Création (statut `draft` par défaut) |
| PATCH | `/api/admin/products/:id` | Modification des champs |
| DELETE | `/api/admin/products/:id` | Archivage (pas de suppression physique) |

## Admin — Prix (`pricing.view` / `pricing.edit`)

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/admin/pricing` | Prix actuels de tous les produits |
| GET | `/api/admin/pricing/:productId/history` | Historique complet |
| PATCH | `/api/admin/pricing/:productId` | `{ salePrice?, purchasePrice?, reason? }` — enregistre automatiquement l'historique |

## Admin — Stock (`inventory.view` / `inventory.edit`)

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/admin/inventory` | État du stock, avec statut (ok/low_stock/out_of_stock) |
| GET | `/api/admin/inventory/:productId/movements` | Historique des mouvements |
| POST | `/api/admin/inventory/movement` | `{ productId, type, quantity, reason?, reference? }` — atomique, protégé contre le stock négatif |

## Admin — Commandes (`orders.view` / `orders.edit`)

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/orders/admin?status=&limit=&offset=` | Liste paginée |
| GET | `/api/orders/admin/:id` | Détail + lignes + historique de statut |
| PATCH | `/api/orders/admin/:id/status` | `{ status }` — transitions validées (voir `api/src/lib/order.ts`) |

## Admin — Clients (`customers.view`)

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/admin/customers?limit=&offset=` | Liste avec statistiques d'achat |
| GET | `/api/admin/customers/:id` | Détail + commandes |

## Admin — Dashboard (`dashboard.view`)

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/admin/dashboard` | CA du jour, commandes en attente, stock faible, ventes par activité, activité récente — toutes données réelles |

## Admin — Utilisateurs staff (`users.manage`)

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/admin/users` | Liste du staff |
| GET | `/api/admin/users/roles` | Rôles disponibles |
| POST | `/api/admin/users` | `{ fullName, email, password, roleId, phone? }` |
| PATCH | `/api/admin/users/:id/status` | `{ status: "active" \| "suspended" }` |

## Admin — Digital / Fournisseurs / Finance

| Méthode | Route | Permission | Description |
|---|---|---|---|
| GET/POST | `/api/admin/digital/services` | `digital.view`/`digital.edit` | Services activables/désactivables (désactivés par défaut) |
| PATCH | `/api/admin/digital/services/:id/enabled` | `digital.edit` | `{ enabled }` |
| GET | `/api/admin/digital/transactions` | `digital.view` | — |
| GET/POST | `/api/admin/suppliers` | `suppliers.view`/`suppliers.edit` | — |
| PATCH | `/api/admin/suppliers/:id` | `suppliers.edit` | — |
| GET | `/api/admin/finance/entries` | `finance.view` | — |
| GET | `/api/admin/finance/summary` | `finance.view` | Estimation opérationnelle, pas une compta certifiée |
| POST | `/api/admin/finance/entries` | `finance.edit` | `{ type, category, amount, activity?, reference?, notes? }` |

## Admin — Médias (`media.upload`)

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/admin/media/upload` | `multipart/form-data` : `file`, `productId`. Répond `501` si R2 non configuré — voir `docs/R2_SETUP.md` |
| DELETE | `/api/admin/media/:imageId` | — |

## Admin — Notifications, Audit, Paramètres

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/admin/notifications?unread=&limit=&offset=` | (staff connecté, pas de permission dédiée) |
| PATCH | `/api/admin/notifications/:id/read` | — |
| GET | `/api/admin/audit-logs?limit=&offset=` | `audit.view` |
| GET | `/api/settings/admin` | `settings.manage` |
| PATCH | `/api/settings/admin/:key` | `settings.manage` — `{ value }` |

---

## Codes d'erreur

| Code | Signification typique |
|---|---|
| `VALIDATION_ERROR` | Donnée d'entrée manquante ou mal formée |
| `UNAUTHENTICATED` | Pas de session valide |
| `ACCOUNT_SUSPENDED` | Compte désactivé |
| `INVALID_CREDENTIALS` | Email/téléphone ou mot de passe incorrect |
| `UNAUTHORIZED` | Session valide mais permission manquante |
| `NOT_FOUND` | Ressource introuvable |
| `CONFLICT` | Doublon (ex: email déjà utilisé) |
| `INSUFFICIENT_STOCK` | Stock insuffisant au moment de la commande |
| `NOT_CONFIGURED` | Fonctionnalité nécessitant une config externe absente (WhatsApp, R2) |
| `RATE_LIMITED` | Trop de requêtes |
| `INTERNAL_ERROR` | Erreur inattendue — voir les logs serveur, jamais de détail exposé au client |

**Note sur le format de réponse** : les routes ajoutées ou révisées en V3
utilisent systématiquement `apiError()` (`api/src/lib/apiResponse.ts`), qui
produit `{ success: false, error: { code, message } }`. Les réponses de
succès n'ont, elles, pas toutes été uniformisées avec une enveloppe
`{ success: true, ... }` explicite — beaucoup renvoient directement l'objet
métier (ex: `{ orders: [...] }`). C'est documenté ici plutôt que présenté
comme entièrement uniforme : si tu veux une enveloppe de succès garantie
partout, dis-le et je termine cette passe.
