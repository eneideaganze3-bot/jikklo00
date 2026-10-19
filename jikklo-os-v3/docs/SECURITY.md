# SECURITY.md — État de la sécurité (audité en V3)

## Authentification

- Mots de passe : hachés PBKDF2-SHA256, 100 000 itérations, sel aléatoire par
  utilisateur (`api/src/lib/password.ts`). Jamais stockés en clair, jamais
  loggés.
- Sessions : JWT signé HMAC-SHA256, expiration 7 jours (staff) / 30 jours
  (clients), posé en cookie `HttpOnly` + `Secure` (en production) +
  `SameSite=Strict`. **Aucun token n'est accessible en JavaScript côté
  navigateur** (protection XSS).
- Deux cookies strictement séparés : `jikklo_session` (staff) et
  `jikklo_customer_session` (clients) — jamais interchangeables, vérifié par
  deux middlewares distincts (`middleware/auth.ts` vs
  `requireCustomerAuth` dans `routes/customerAccount.ts`).

## Autorisation (RBAC)

- Chaque route sensible passe par `requirePermission(code)`, qui vérifie les
  permissions **côté serveur** en interrogeant la base (jamais fait confiance
  à un rôle envoyé par le client). Vérifié route par route en V3 — voir
  liste complète dans `docs/API.md`.
- Un `roleId` envoyé à la création d'un utilisateur staff est désormais
  vérifié contre la table `roles` avant d'être accepté (corrigé en V3 —
  auparavant accepté tel quel).
- Un administrateur ne peut plus suspendre son propre compte (corrigé en V3,
  évite un verrouillage accidentel).

## Protection des données commerciales

- Le frontend (site public et JIKKLO OS) n'envoie jamais de prix — seulement
  `productId` + `quantity`. Le serveur relit systématiquement le prix, le
  stock et la disponibilité réels avant de créer une commande
  (`routes/orders.ts`, `/public/create`).
- Le prix appliqué à une commande est copié dans `order_items.unit_price` au
  moment de la création et n'est jamais recalculé après coup — une commande
  passée conserve le prix historique même si le prix catalogue change
  ensuite.

## Intégrité du stock (concurrence)

- Contrainte SQL `CHECK (quantity >= 0)` sur `inventory` — la base elle-même
  refuse toute écriture qui ferait passer un stock sous zéro, quelle que
  soit la couche applicative qui l'a demandée.
- Écritures via `env.DB.batch()` (transaction atomique D1) — une commande
  échoue entièrement ou réussit entièrement, jamais d'état partiel.
- Vérifié avec un vrai moteur SQLite dans l'environnement de génération (voir
  `AUDIT-V3.md`) et avec des tests `@cloudflare/vitest-pool-workers` contre
  un vrai D1 en mémoire (`tests/concurrency.test.ts`).

## Validation des entrées

- Librairie centralisée `api/src/lib/validate.ts` : téléphone, email, texte
  (longueur bornée), prix (positif, borné), quantité (positive, finie,
  décimales autorisées seulement pour L/kg), statut de commande (contre une
  liste fermée), pagination (limite plafonnée à 200).
- Appliquée aux points d'entrée publics les plus exposés en priorité :
  création de commande, inscription/connexion client, formulaire de contact,
  création produit, modification de prix, création d'utilisateur staff,
  changement de statut.

## En-têtes de sécurité HTTP (`api/src/index.ts`)

| Header | Valeur |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `Permissions-Policy` | `geolocation=(), camera=(), microphone=()` |
| `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'` |

La CSP est volontairement stricte : l'API ne sert que du JSON, jamais de
HTML, donc il n'y a aucun script/style à autoriser. **Cette CSP ne s'applique
qu'aux réponses de l'API**, pas au site public ni à JIKKLO OS (qui sont des
projets Cloudflare Pages séparés, sans CSP restrictive configurée pour
l'instant — à ajouter dans `public-site/_headers` et l'équivalent pour
`os-frontend` si tu veux durcir davantage).

## CORS

Restreint explicitement à `jikklo.com`, `www.jikklo.com`, `app.jikklo.com` et
aux ports localhost de dev — avec `credentials: true` (nécessaire pour que
les cookies de session passent en cross-subdomain).

## Rate limiting — LIMITATION CONNUE

Le compteur actuel (`api/src/index.ts`) vit en mémoire dans l'instance du
Worker. **Ce n'est pas une protection de production fiable** : Cloudflare
peut faire tourner plusieurs instances de ton Worker en parallèle à travers
le monde, chacune avec son propre compteur — un attaquant distribué peut
donc dépasser largement la limite affichée.

**Avant un vrai lancement**, active les règles natives : Dashboard
Cloudflare → Security → WAF → Rate limiting rules. Elles sont appliquées au
niveau du edge, de façon globale et fiable, et ont un palier gratuit.

## Audit log

Chaque action sensible (connexion, création/modification produit, prix,
stock, commande, utilisateur, paramètres) est enregistrée dans `audit_logs`
avec l'utilisateur, l'action, l'entité concernée et un horodatage. Ne
contient jamais de mot de passe, token ou secret — vérifié : aucun appel à
`writeAuditLog()` ne passe de champ sensible dans `details`.

## Ce qui reste à faire avant un vrai lancement public

- Activer les Rate Limiting Rules Cloudflare natives (voir ci-dessus).
- Envisager un CSP restrictif aussi sur `public-site` et `os-frontend` via
  `_headers` (fichier Cloudflare Pages).
- Ajouter une politique de rotation de `JWT_SECRET` si un incident de
  sécurité survenait un jour (actuellement : changer le secret invalide
  immédiatement toutes les sessions actives, ce qui est le comportement
  voulu, mais aucune procédure documentée pour le faire proprement en
  production sans interrompre le staff en plein travail).
