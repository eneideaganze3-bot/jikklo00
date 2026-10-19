/* ==========================================================================
   JIKKLO — js/products.js
   --------------------------------------------------------------------------
   ⚠️ DONNÉES DE DÉMONSTRATION — PLUS UTILISÉES EN PRODUCTION ⚠️
   --------------------------------------------------------------------------
   Depuis l'intégration avec JIKKLO OS (API + Cloudflare D1), ce fichier
   N'EST PLUS la source de vérité. La source de vérité est désormais
   l'API JIKKLO (voir js/api.js et js/catalog-data.js), qui lit les vrais
   produits, prix et stocks depuis Cloudflare D1.

   Ce tableau est conservé UNIQUEMENT :
   - comme référence de la forme de données attendue par le HTML/CSS ;
   - pour des tests hors-ligne ponctuels, si besoin (ex: ouvrir une page
     dans un navigateur sans connexion à l'API) — mais aucune page ne le lit
     automatiquement en production.

   Aucun de ces prix, unités ou niveaux de stock ne reflète une réalité
   commerciale de JIKKLO. Ne JAMAIS réactiver ce fichier comme source de
   données pour products.html, product.html, energy.html, le panier, le
   checkout ou la page d'accueil : ces pages chargent désormais leurs
   données via window.JIKKLO_CATALOG (js/catalog-data.js), qui interroge
   l'API à chaque affichage.

   CHAMPS :
   id            identifiant unique (utilisé dans product.html?id=...)
   category      "energy" | "lubricants" | "automotive" | "digital"
   subcategory   sous-catégorie libre (ex: "fuel", "engine-oil", "grease")
   name          { fr, en } — nom du produit
   description   { fr, en } — description courte (carte produit)
   details       { fr, en } — description longue (page produit)
   characteristics { fr: [...], en: [...] } — liste de caractéristiques
   price         nombre — ⚠️ PRIX DE DÉMONSTRATION, à remplacer
   currency      "FC" (franc congolais)
   unit          { fr, en } — ex: "litre" / "liter", "unité" / "unit"
   stock         "in-stock" | "low-stock" | "out-of-stock"
   featured      true = mis en avant sur la page d'accueil
   brand         "JIKKLO"
   sku           référence interne
   image         chemin vers la photo produit (peut ne pas encore exister)
   lastUpdated   ISO 8601 — date/heure de dernière mise à jour du prix
   ========================================================================== */

const PRODUCTS = [
  // ---------------------------------------------------------------- ENERGY
  {
    id: "fuel-essence",
    category: "energy",
    subcategory: "fuel",
    name: { fr: "Essence", en: "Petrol" },
    description: {
      fr: "Carburant de qualité, distribué de façon fiable pour vos besoins quotidiens.",
      en: "Quality fuel, reliably supplied for your everyday needs.",
    },
    details: {
      fr: "Essence de qualité standard, adaptée à la majorité des véhicules essence. Quantité personnalisable au litre.",
      en: "Standard-quality petrol, suited to most petrol vehicles. Quantity customizable by the liter.",
    },
    characteristics: {
      fr: ["Vendu au litre", "Quantité personnalisable", "Disponible en station JIKKLO Energy"],
      en: ["Sold by the liter", "Customizable quantity", "Available at JIKKLO Energy stations"],
    },
    price: 5500, // ⚠️ PRIX DE DÉMONSTRATION
    currency: "FC",
    unit: { fr: "litre", en: "liter" },
    stock: "in-stock",
    featured: true,
    brand: "JIKKLO",
    sku: "JK-ENG-FUEL-001",
    image: "assets/images/products/fuel-essence.jpg",
    lastUpdated: "2026-08-20T09:00:00",
  },
  {
    id: "fuel-diesel",
    category: "energy",
    subcategory: "fuel",
    name: { fr: "Diesel", en: "Diesel" },
    description: {
      fr: "Gasoil fiable pour véhicules diesel et groupes électrogènes.",
      en: "Reliable diesel fuel for diesel vehicles and generators.",
    },
    details: {
      fr: "Diesel de qualité standard, adapté aux véhicules diesel et générateurs. Quantité personnalisable au litre.",
      en: "Standard-quality diesel, suited to diesel vehicles and generators. Quantity customizable by the liter.",
    },
    characteristics: {
      fr: ["Vendu au litre", "Quantité personnalisable", "Adapté aux groupes électrogènes"],
      en: ["Sold by the liter", "Customizable quantity", "Suited for generators"],
    },
    price: 5800, // ⚠️ PRIX DE DÉMONSTRATION
    currency: "FC",
    unit: { fr: "litre", en: "liter" },
    stock: "in-stock",
    featured: true,
    brand: "JIKKLO",
    sku: "JK-ENG-FUEL-002",
    image: "assets/images/products/fuel-diesel.jpg",
    lastUpdated: "2026-08-20T09:00:00",
  },

  // ------------------------------------------------------------ LUBRICANTS
  {
    id: "engine-oil-20w50",
    category: "lubricants",
    subcategory: "engine-oil",
    name: { fr: "Huile moteur 20W-50 — 1L", en: "Engine Oil 20W-50 — 1L" },
    description: {
      fr: "Huile moteur pour un usage courant, bidon d'un litre.",
      en: "Engine oil for everyday use, 1-liter can.",
    },
    details: {
      fr: "Huile moteur multigrade 20W-50, adaptée à un usage courant sur véhicules essence et diesel. Vendue en bidon d'1 litre.",
      en: "Multigrade 20W-50 engine oil, suited for everyday use on petrol and diesel vehicles. Sold in a 1-liter can.",
    },
    characteristics: {
      fr: ["Viscosité 20W-50", "Bidon de 1 litre", "Usage courant essence/diesel"],
      en: ["20W-50 viscosity", "1-liter can", "Everyday petrol/diesel use"],
    },
    price: 15000, // ⚠️ PRIX DE DÉMONSTRATION
    currency: "FC",
    unit: { fr: "unité", en: "unit" },
    stock: "in-stock",
    featured: true,
    brand: "JIKKLO",
    sku: "JK-LUB-OIL-001",
    image: "assets/images/products/engine-oil-20w50.jpg",
    lastUpdated: "2026-08-18T14:30:00",
  },
  {
    id: "engine-oil-15w40",
    category: "lubricants",
    subcategory: "engine-oil",
    name: { fr: "Huile moteur 15W-40 — 1L", en: "Engine Oil 15W-40 — 1L" },
    description: {
      fr: "Huile moteur pour véhicules diesel, bidon d'un litre.",
      en: "Engine oil for diesel vehicles, 1-liter can.",
    },
    details: {
      fr: "Huile moteur multigrade 15W-40, recommandée pour les véhicules diesel. Vendue en bidon d'1 litre.",
      en: "Multigrade 15W-40 engine oil, recommended for diesel vehicles. Sold in a 1-liter can.",
    },
    characteristics: {
      fr: ["Viscosité 15W-40", "Bidon de 1 litre", "Recommandée pour diesel"],
      en: ["15W-40 viscosity", "1-liter can", "Recommended for diesel"],
    },
    price: 16000, // ⚠️ PRIX DE DÉMONSTRATION
    currency: "FC",
    unit: { fr: "unité", en: "unit" },
    stock: "low-stock",
    featured: false,
    brand: "JIKKLO",
    sku: "JK-LUB-OIL-002",
    image: "assets/images/products/engine-oil-15w40.jpg",
    lastUpdated: "2026-08-18T14:30:00",
  },
  {
    id: "grease-multiuse",
    category: "lubricants",
    subcategory: "grease",
    name: { fr: "Graisse multi-usage — 500g", en: "Multi-purpose Grease — 500g" },
    description: {
      fr: "Graisse lubrifiante polyvalente pour l'entretien mécanique courant.",
      en: "Versatile lubricating grease for everyday mechanical maintenance.",
    },
    details: {
      fr: "Graisse polyvalente pour l'entretien de pièces mécaniques. Pot de 500 grammes.",
      en: "Multi-purpose grease for mechanical parts maintenance. 500-gram tub.",
    },
    characteristics: {
      fr: ["Pot de 500g", "Usage polyvalent", "Entretien mécanique courant"],
      en: ["500g tub", "Multi-purpose", "Everyday mechanical maintenance"],
    },
    price: 8000, // ⚠️ PRIX DE DÉMONSTRATION
    currency: "FC",
    unit: { fr: "unité", en: "unit" },
    stock: "in-stock",
    featured: false,
    brand: "JIKKLO",
    sku: "JK-LUB-GRS-001",
    image: "assets/images/products/grease-multiuse.jpg",
    lastUpdated: "2026-08-18T14:30:00",
  },

  // ------------------------------------------------------------- AUTOMOTIVE
  {
    id: "wiper-blades",
    category: "automotive",
    subcategory: "accessories",
    name: { fr: "Balais d'essuie-glace (paire)", en: "Wiper Blades (pair)" },
    description: {
      fr: "Paire de balais d'essuie-glace universels.",
      en: "Universal pair of wiper blades.",
    },
    details: {
      fr: "Paire de balais d'essuie-glace universels, faciles à installer sur la plupart des véhicules courants.",
      en: "Universal pair of wiper blades, easy to install on most common vehicles.",
    },
    characteristics: {
      fr: ["Vendu par paire", "Compatible véhicules courants", "Installation simple"],
      en: ["Sold as a pair", "Fits common vehicles", "Easy installation"],
    },
    price: 12000, // ⚠️ PRIX DE DÉMONSTRATION
    currency: "FC",
    unit: { fr: "paire", en: "pair" },
    stock: "in-stock",
    featured: false,
    brand: "JIKKLO",
    sku: "JK-AUTO-ACC-001",
    image: "assets/images/products/wiper-blades.jpg",
    lastUpdated: "2026-08-15T10:00:00",
  },
  {
    id: "car-shampoo",
    category: "automotive",
    subcategory: "care",
    name: { fr: "Shampoing carrosserie — 500ml", en: "Car Body Shampoo — 500ml" },
    description: {
      fr: "Shampoing pour l'entretien extérieur du véhicule.",
      en: "Shampoo for exterior vehicle care.",
    },
    details: {
      fr: "Shampoing pour carrosserie, flacon de 500ml, pour un entretien régulier de l'extérieur du véhicule.",
      en: "Car body shampoo, 500ml bottle, for regular exterior vehicle care.",
    },
    characteristics: {
      fr: ["Flacon de 500ml", "Entretien extérieur", "Usage régulier"],
      en: ["500ml bottle", "Exterior care", "Regular use"],
    },
    price: 9500, // ⚠️ PRIX DE DÉMONSTRATION
    currency: "FC",
    unit: { fr: "unité", en: "unit" },
    stock: "out-of-stock",
    featured: false,
    brand: "JIKKLO",
    sku: "JK-AUTO-CARE-001",
    image: "assets/images/products/car-shampoo.jpg",
    lastUpdated: "2026-08-10T10:00:00",
  },

  // ---------------------------------------------------------------- DIGITAL
  {
    id: "digital-airtime",
    category: "digital",
    subcategory: "topup",
    name: { fr: "Recharge / Unités", en: "Airtime top-up" },
    description: {
      fr: "Recharge de crédit et d'unités pour rester connecté au quotidien.",
      en: "Airtime and data top-up to stay connected every day.",
    },
    details: {
      fr: "Service de recharge téléphonique et d'unités, disponible pour les réseaux pris en charge.",
      en: "Phone and data top-up service, available for supported networks.",
    },
    characteristics: {
      fr: ["Réseaux pris en charge selon disponibilité", "Montant personnalisable"],
      en: ["Supported networks depending on availability", "Customizable amount"],
    },
    price: null, // Prix confirmé par JIKKLO au moment de la commande
    currency: "FC",
    unit: { fr: "unité", en: "unit" },
    stock: "in-stock",
    featured: true,
    brand: "JIKKLO",
    sku: "JK-DIG-TOP-001",
    image: "assets/images/products/digital-airtime.jpg",
    lastUpdated: "2026-08-20T09:00:00",
  },
];

// Nom délibérément différent de "PRODUCTS"/"window.PRODUCTS" pour qu'aucun
// script de production ne puisse s'y raccrocher par erreur ou par habitude.
// Voir js/catalog-data.js pour la vraie source de données (API JIKKLO OS).
window.JIKKLO_DEV_FALLBACK_PRODUCTS = PRODUCTS;
