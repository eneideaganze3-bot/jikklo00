# AUDIT-V2.md — Rapport de fin de génération JIKKLO OS V2

Ce document résume, en toute transparence, l'état réel du projet livré.
Aucune fonctionnalité n'est présentée comme opérationnelle si elle nécessite
encore une configuration externe non faite.

---

## 1. Ce qui était déjà fonctionnel (V1, conservé)

- Authentification staff (email/mot de passe), RBAC à 4 rôles
- Produits, catégories, stock, commandes, clients — CRUD de base
- Prix avec historique
- Message WhatsApp détaillé généré depuis les données réelles
- Dashboard avec données réelles (pas de faux chiffres)
- Journal d'audit
- Base D1 avec schéma complet

## 2. Ce qui a été corrigé en V2

| Problème V1 | Correction V2 |
|---|---|
| Stock pouvait devenir négatif en cas de commandes simultanées | Contrainte `CHECK (quantity >= 0)` sur `inventory` + écritures via `D1.batch()` (transaction atomique). Une décrémentation qui ferait passer sous 0 fait échouer **tout** le batch. **Vérifié avec un vrai moteur SQLite** dans cet environnement (voir section 5). |
| Numéro de commande `COUNT(*)+1` sujet aux collisions | Compteur dédié `order_counters` avec `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, opération atomique unique. **Vérifié** : 10 appels concurrents simulés → 10 valeurs uniques, 1 à 10. |
| Création de commande non transactionnelle (risque de données partielles) | Toute la création (commande + lignes + stock + mouvements) est un seul `D1.batch()` ; échec = rollback complet. |
| Quantités non validées (0, négatif, NaN, Infinity acceptés) | `validateQuantity()` centralisée, appliquée sur `/orders/public/create`. Décimales autorisées uniquement pour les produits en L/kg. |
| `deliveryFee = 0` codé en dur | `computeDeliveryFee()` configurable depuis `settings` (mode fixe / gratuit / seuil de gratuité). Architecture prête pour "par zone" plus tard (non implémenté). |
| Token JWT dans `localStorage` (exposé au XSS) | Cookie `HttpOnly` + `Secure` (en prod) + `SameSite=Strict`, posé par l'API. Le frontend envoie `credentials: "include"`. Un second cookie séparé (`jikklo_customer_session`) gère les clients, jamais mélangé avec la session staff. |
| Seed contenant des placeholders de hash à remplacer manuellement (`REPLACE_WITH_...`) | Supprimé. Script `scripts/create-admin.mjs` : génère la commande `wrangler d1 execute` avec un hash calculé localement, sans jamais écrire le mot de passe sur disque. |
| Mouvement de stock manuel = lire-puis-écrire (racy) | Réécrit en écriture atomique conditionnelle, même protection que les commandes. |

## 3. Ce qui a été ajouté en V2

- **Site public `public-site/`** : HTML/JS sans étape de build (déploiement simple), intégralement connecté à l'API — catalogue dynamique, fiche produit, panier (localStorage, ne contient que `{productId, quantity}` — jamais de prix), checkout (le serveur recalcule tout), espace client (inscription/connexion/commandes), suivi de commande public, formulaire de contact connecté au backend, pages About/FAQ/Privacy/Terms, sitemap.xml + robots.txt.
- **Modules JIKKLO OS** : Jikklo Digital (services activables/désactivables, désactivés par défaut), Fournisseurs, Finance (première couche, explicitement non-certifiée), upload d'images produits vers R2 (avec repli honnête en 501 si R2 n'est pas configuré).
- **Sécurité API** : CORS avec `credentials`, CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.
- **Tests de concurrence réels** (`tests/concurrency.test.ts`), utilisant `@cloudflare/vitest-pool-workers` pour tester contre un vrai D1 en mémoire — pas des mocks.

## 4. Ce qui reste volontairement à configurer

- **WhatsApp Business Cloud API** : le code fonctionne, mais nécessite `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` et le numéro business dans les paramètres JIKKLO OS. Sans ça, le système répond honnêtement `whatsappConfigured: false` et affiche un bouton de secours (wa.me générique) au client.
- **R2 (images produits)** : binding commenté dans `wrangler.toml`. Sans lui, l'upload répond `501` au lieu de simuler un succès.
- **Paiement en ligne** : non implémenté (le cahier des charges le précise explicitement — architecture prête à l'accueillir plus tard).
- **Livraison par zone** : seuls les modes "frais fixes" et "gratuit" sont implémentés ; "par zone" nécessite un modèle de données géographique non encore défini.
- **Multi-devises, multilingue, multi-points de vente, PWA** : non implémentés dans cette V2. Le schéma DB et l'architecture n'empêchent pas de les ajouter plus tard, mais rien n'est câblé.
- **Rate limiting robuste** : le compteur en mémoire de Worker (`api/src/index.ts`) est documenté comme un filet basique, pas une protection de production. **Recommandé avant mise en production réelle** : activer les Rate Limiting Rules natives de Cloudflare (Dashboard → Security → WAF).

## 5. Limitations connues de cette génération

- **Aucun accès réseau dans cet environnement** : je n'ai pas pu exécuter `npm install` ni lancer `vitest` réellement. La logique critique a donc été vérifiée par deux moyens indépendants plutôt que par la suite de tests complète :
  1. Réimplémentation isolée en JavaScript pur des fonctions (`calculateOrderTotals`, `validateQuantity`, `computeDeliveryFee`) et exécution directe avec `node`.
  2. Pour la contrainte anti-concurrence et le compteur atomique — les points les plus sensibles de cette V2 — **exécution contre un vrai moteur SQLite** (`node:sqlite`) reproduisant exactement le schéma D1, avec la contrainte `CHECK (quantity >= 0)` et la requête `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`. Les deux scénarios exigés par le cahier des charges (Test 1 : stock=1, deux décrémentations simultanées ; numéro de commande sans collision) ont été effectivement observés, pas seulement raisonnés.
  - Le fichier `tests/concurrency.test.ts` reproduit ces mêmes vérifications avec `@cloudflare/vitest-pool-workers`, l'outillage standard pour tester un Worker+D1 réel — à exécuter avec `npm run test` une fois les dépendances installées, pour couvrir aussi les chemins qui passent par l'API HTTP elle-même (pas seulement la couche SQL).
- **Le site public n'est pas un fork du code réel de jikklo.com.** Je n'ai accès qu'au rendu HTML public de jikklo.com (vu via un fetch web), pas à son code source ni à son repository. Le site livré dans `public-site/` reconstruit la structure et le contenu observés (Home, About, Energy, Digital, Contact, ton et palette navy) mais c'est un nouveau code, pas une modification du fichier existant. **Si tu as le code source original, il vaut mieux me le fournir pour que j'y intègre les appels API plutôt que de partir de cette reconstruction.**
- **Migrations D1** : elles restent des fichiers SQL numérotés exécutés manuellement via `wrangler d1 execute`, pas un système de migration versionné automatique (D1 n'a pas d'outil de migration officiel équivalent à Prisma Migrate au moment de cette génération). C'est documenté comme limitation plutôt que présenté comme un vrai système de versioning automatisé.
- **Digital, Fournisseurs, Finance** sont des modules réels et fonctionnels mais volontairement simples (CRUD de base) — pas la profondeur complète décrite au cahier des charges (pas de catégories de services, pas d'historique d'achat fournisseur détaillé, pas de caisse). Une base solide pour itérer, pas un module fini.

## 6. Variables d'environnement nécessaires

**API** (`wrangler secret put ...` en production, `.dev.vars` en local) :
- `JWT_SECRET` (obligatoire)
- `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` (optionnels)

**Frontend OS** (`.env` / `.env.production`) :
- `VITE_API_URL`

## 7. Configuration Cloudflare nécessaire

- Base D1 `jikklo-db` + `database_id` dans `api/wrangler.toml`
- (Optionnel) Bucket R2 `jikklo-assets`, binding à décommenter
- Routes : `api.jikklo.com` → Worker API, `app.jikklo.com` → Pages (JIKKLO OS), `jikklo.com` → Pages (public-site)
- CORS déjà restreint à ces trois domaines + `localhost` en dev dans `api/src/index.ts`

## 8. Étapes de déploiement

Voir `README.md`, section 4 — mise à jour pour inclure la création admin via script, les migrations 0003/0004, et le déploiement du site public.

---

*Ce rapport doit être relu et mis à jour à chaque évolution majeure du système.*
