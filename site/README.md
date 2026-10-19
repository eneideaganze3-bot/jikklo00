# JIKKLO — Version 002 E-commerce (HTML / CSS / JS)

> ⚠️ **MISE À JOUR — Intégration JIKKLO OS (août 2026)** ⚠️
> Ce site est désormais **connecté à JIKKLO OS** (API + base de données Cloudflare D1).
> Les sections ci-dessous décrivent encore le fonctionnement d'origine (V002, 100% statique,
> `js/products.js` comme source de vérité) — **ce n'est plus le cas**. Voir
> **[`docs/REAL_SITE_INTEGRATION.md`](docs/REAL_SITE_INTEGRATION.md)** pour la documentation à jour :
> comment les prix/stocks sont désormais gérés depuis JIKKLO OS, comment fonctionne le panier/checkout
> réel, et ce qu'il reste à configurer côté Cloudflare. `js/products.js` est conservé uniquement comme
> jeu de données de secours pour le développement hors-ligne (voir l'en-tête de ce fichier) — il n'alimente
> plus aucune page en production.

Site multipage — **HTML5, CSS3, JavaScript vanilla**. Aucun framework, aucun build. Disponible en **6 langues** (français, anglais, swahili, lingala, espagnol, portugais).

Cette version fait évoluer le site JIKKLO existant vers une plateforme de commande : catalogue produits, prix en FC (franc congolais), panier, checkout, et commande transmise à JIKKLO OS (avec confirmation WhatsApp). **Aucune fonctionnalité existante n'a été supprimée** — identité visuelle, logo, navigation et pages institutionnelles (About, Vision, Contact, mentions légales) restent intactes.

---

## 1. Ouvrir le site en local

Il faut désormais **JIKKLO OS (API)** démarré en parallèle pour que le catalogue, le panier et le checkout fonctionnent (voir `docs/REAL_SITE_INTEGRATION.md`, section "Test local").

```bash
# Terminal 1 — API JIKKLO OS (depuis jikklo-os-v3/api)
npm install && npm run dev   # http://localhost:8787

# Terminal 2 — ce site
python3 -m http.server 4321
# puis ouvrez http://localhost:4321
```

Sans l'API démarrée, les pages catalogue/panier/checkout afficheront un message
"Impossible de charger les informations actuellement" plutôt que d'anciens prix — c'est voulu (voir règle #45 du brief d'intégration).

---

## 2. Où modifier le prix du carburant (et de tout produit)

**Ce n'est plus dans ce dossier.** Les prix, stocks et fiches produits se gèrent désormais
depuis **JIKKLO OS** (l'interface d'administration de `jikklo-os-v3/os-frontend`), qui écrit dans
Cloudflare D1. Ce site relit ces données à chaque affichage via l'API — modifier un prix dans
JIKKLO OS le met à jour ici automatiquement, sans toucher à aucun fichier de ce dossier.

`js/products.js` reste dans le dépôt uniquement comme **exemple de structure / secours pour
tests hors-ligne** — il n'est plus lu par aucune page en production. Voir
`docs/REAL_SITE_INTEGRATION.md` pour le détail.

---

## 3. Où modifier le numéro WhatsApp


**Un seul endroit : `js/config.js`, ligne `JIKKLO_WHATSAPP`.**

```js
const JIKKLO_WHATSAPP = "243904067863"; // numéro déjà configuré (voir CONFIGURATION-WHATSAPP.txt)
```

Le numéro WhatsApp Business JIKKLO est déjà renseigné. **Si ce champ est vide**, tous les boutons "Commander sur WhatsApp" du site restent masqués (fiches produits, page energy, checkout) — le site reste utilisable (le panier et le checkout fonctionnent, la commande est juste enregistrée avec un message expliquant que WhatsApp n'est pas encore configuré). Dès que le numéro est renseigné, tous ces boutons apparaissent automatiquement.

Ce numéro alimente aussi l'objet `JIKKLO_CONFIG` (présent dans `config.js`) utilisé par les scripts e-commerce.

---

## 4. Arborescence

```
jikklo-ecommerce/
├── index.html, about.html, products.html, product.html
├── cart.html, checkout.html, energy.html, digital.html
├── vision.html, contact.html, privacy.html, terms.html, 404.html
├── css/
│   ├── style.css        # variables, layout, composants, e-commerce
│   ├── animations.css
│   └── responsive.css
├── js/
│   ├── config.js          # numéro WhatsApp, devise, nom de l'entreprise
│   ├── api.js              # ⚠️ client API central vers JIKKLO OS (js/api.js — PUBLIC_API_URL ici)
│   ├── catalog-data.js     # ⚠️ va chercher les produits/prix/stocks sur l'API (source de vérité)
│   ├── products.js        # jeu de données de secours (dev hors-ligne uniquement, plus utilisé en prod)
│   ├── translations.js    # tout le texte du site, 6 langues
│   ├── i18n.js              # moteur de traduction
│   ├── main.js               # navbar, logo, formatPrice(), lien WhatsApp accueil
│   ├── animations.js          # révélation au scroll
│   ├── cart.js                  # panier : localStorage {id, qty} uniquement, prix relus via catalog-data.js
│   ├── catalog.js                # grille produits, filtres, recherche, tri
│   ├── product.js                 # fiche produit dynamique (product.html?id=...)
│   ├── energy.js                   # cartes carburant avec quantité/sous-total en direct
│   ├── checkout.js                  # envoie la commande à POST /api/orders/public/create
│   ├── whatsapp.js                   # liens WhatsApp de prise de contact rapide (pas de création de commande)
│   └── contact.js                     # formulaire de contact → POST /api/public/contact
├── assets/
│   ├── logo/                # déposez-y votre logo (logo.png ou .jpg)
│   ├── images/
│   │   ├── founder.jpg        # photo du fondateur
│   │   └── products/            # photos produits
│   └── icons/
├── favicon.svg
├── robots.txt
└── sitemap.xml
```

---

## 5. Nouvelles fonctionnalités de cette version

- **Catalogue produit centralisé** (`js/products.js`) : 8 produits de démonstration (2 carburants, 3 lubrifiants, 2 automobile, 1 digital), clairement marqués comme données d'exemple.
- **`products.html`** : catalogue complet avec recherche instantanée, filtres par catégorie (Énergie / Lubrifiants / Automobile / Télécom-Digital), et tri (prix croissant/décroissant, nom A-Z).
- **`energy.html`** devient une vraie page commerciale : cartes carburant avec prix en FC, disponibilité, sélecteur de quantité et sous-total calculés en direct, horodatage "Dernière mise à jour".
- **`product.html?id=...`** : fiche produit dynamique unique pour tous les produits (aucune page HTML par produit) — image, prix, unité, stock, caractéristiques, quantité, ajout au panier, commande WhatsApp immédiate.
- **Panier réel** (`cart.html`) : ajout/suppression/quantités, sous-totaux et total calculés automatiquement, persistant via `localStorage` (survit à l'actualisation et à la navigation).
- **Compteur panier synchronisé** sur toutes les pages (icône 🛒 dans la navbar, desktop et mobile).
- **`checkout.html`** : formulaire (nom, téléphone, adresse, mode de réception livraison/retrait, commentaire), validé, avec récapitulatif et total automatiques (aperçu — le total officiel est calculé par JIKKLO OS).
- **Commande envoyée à JIKKLO OS** : `POST /api/orders/public/create` recalcule prix/stock/total côté serveur et renvoie le vrai numéro de commande (ex: `JKK-2026-000001`). Si WhatsApp Cloud API n'est pas configuré côté serveur, un bouton "Confirmer via WhatsApp" pré-rempli est proposé ; sinon, le message est envoyé automatiquement par JIKKLO OS.
- **Stock à 3 niveaux** : 🟢 En stock / 🟡 Stock limité / 🔴 Rupture de stock. Un produit en rupture ne peut pas être ajouté au panier — le bouton est désactivé dans l'interface, ET un garde-fou existe dans le code (`cart.js`) même en cas d'appel direct.
- **Formatage des prix centralisé** (`formatPrice()` dans `main.js`) : `5500` → `"5 500 FC"`, utilisé partout (cartes, panier, checkout, message WhatsApp).
- **Page d'accueil** : nouvelle section "Explore JIKKLO" avec produits mis en avant, boutons "View Products" et "Order via WhatsApp".
- **SEO** : titres de page dynamiques (`Nom du produit | JIKKLO`), sitemap et robots.txt mis à jour (panier/checkout exclus de l'indexation).

---

## 6. Limites techniques actuelles (mises à jour après intégration JIKKLO OS)

- **Pas de paiement en ligne** — volontairement, comme demandé. La commande est enregistrée dans JIKKLO OS ; un vrai paiement (mobile money, carte) nécessitera une passerelle de paiement.
- **Numéro de commande garanti unique** — désormais généré côté serveur (JIKKLO OS, ex: `JKK-2026-000001`), plus côté navigateur.
- **Photos produits** — l'API renvoie une image si elle a été configurée dans JIKKLO OS (Cloudflare R2, à connecter — voir `docs/REAL_SITE_INTEGRATION.md`) ; sinon, une icône de catégorie s'affiche à la place, sans requête réseau inutile.
- **Catégorisation "haut niveau"** (Énergie / Lubrifiants / Automobile / Digital) — JIKKLO OS ne modélise que deux "activités" (energy/digital) + des catégories libres ; le pont entre les deux modèles se fait via le champ `subcategory` (voir la table de correspondance dans `js/catalog-data.js` et `docs/REAL_SITE_INTEGRATION.md`).
- **Contenu bilingue par produit** — une migration (`0005_bilingual_public_content.sql`) a été ajoutée côté JIKKLO OS pour stocker nom/description/caractéristiques en français ET anglais par produit ; tant qu'un produit n'a pas sa version anglaise saisie dans JIKKLO OS, le site affiche la version française en repli plutôt qu'un champ vide.
- **Traductions e-commerce (V002/V003)** : les nouvelles chaînes ajoutées pour le catalogue, le panier et le checkout sont complètes en français et anglais. Le swahili, lingala, espagnol et portugais basculent automatiquement sur le français pour ce contenu spécifique (mécanisme de repli déjà intégré), en attendant leur traduction complète.
- **Espace client (compte, historique de commandes)** — les routes API existent déjà côté JIKKLO OS (`js/api.js` → `customer.*`) mais ce site n'a pas encore de pages `login.html`/`account.html` : à construire avec vous si souhaité (voir "À faire avec vous" dans `INTEGRATION-AUDIT.md`).

---

## 7. Déployer sur Cloudflare Pages

Aucune commande de build, répertoire de sortie = `/` (la racine du dépôt).

```bash
npm install -g wrangler
npx wrangler pages deploy . --project-name=jikklo-website
```

Ou via le tableau de bord : **Workers & Pages → Créer une application → Pages → Connecter un dépôt Git**, laisser la commande de build vide.

---

## 8. Tests

Les scénarios manuels décrits ci-dessous (navigation, panier, checkout, WhatsApp, responsive) avaient été
validés sur la version 100% statique (V002 d'origine). Après l'intégration avec JIKKLO OS, ces mêmes
parcours doivent être rejoués avec l'API démarrée localement (voir section 1) — c'est documenté comme
non exécuté dans `INTEGRATION-AUDIT.md` faute d'accès réseau/Cloudflare dans cet environnement de travail.
Testé avant intégration avec un vrai moteur de navigateur (Chromium via Playwright), couvrant les 15 scénarios demandés : navigation Accueil → Produits → Fiche produit, ajout/modification/suppression au panier, persistance après actualisation, formulaire de checkout, calcul automatique du total, génération du numéro de commande, construction et encodage corrects du message WhatsApp, modification d'un prix se propageant partout, blocage de l'ajout d'un produit en rupture de stock, responsive mobile, et vérification de tous les liens internes (aucun lien mort détecté). Zéro erreur JavaScript sur les 13 pages testées.
