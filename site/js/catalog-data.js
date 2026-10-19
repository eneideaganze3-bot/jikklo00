/* ==========================================================================
   JIKKLO — js/catalog-data.js
   --------------------------------------------------------------------------
   Couche de données du catalogue — REMPLACE l’ancien catalogue statique. Le fichier historique products.js est
   archivé et n’est plus chargé par le frontend de production.

   Va chercher les produits sur JIKKLO API (via js/api.js) au chargement de
   chaque page, puis normalise la réponse dans la même forme que l'ancien
   tableau PRODUCTS pour ne pas avoir à réécrire tout catalog.js / cart.js /
   product.js / energy.js. C'est le SEUL endroit qui fait cette conversion.

   Expose window.JIKKLO_CATALOG :
     - ready            → Promise résolue une fois le premier chargement
                           terminé (avec succès ou en erreur)
     - getAll()         → tableau des produits actuellement en mémoire
     - getById(id)       → un produit ou null
     - hasError()        → true si le dernier chargement a échoué
     - reload()          → relance un chargement (ex: bouton "Réessayer")

   IMPORTANT (règle #45 du brief d'intégration) : si l'API est injoignable,
   ce module ne retombe JAMAIS sur des prix statiques. `getAll()` renverra
   un tableau vide et `hasError()` retournera true ; c'est aux pages
   d'afficher un message "Impossible de charger les informations
   actuellement. Veuillez réessayer." plutôt que d'inventer des données.

   Doit être chargé APRÈS js/api.js et AVANT js/cart.js,
   js/catalog.js, js/product.js, js/energy.js.
   ========================================================================== */

(function () {
  "use strict";

  /* --------------------------------------------------------------------
     Table de correspondance sous-catégorie → catégorie "haut niveau"
     utilisée par les filtres de products.html (energy / lubricants /
     automotive / digital). JIKKLO OS ne modélise que deux "activités"
     (energy / digital) + des catégories libres en base — cette table est
     le pont documenté entre les deux modèles (voir
     docs/REAL_SITE_INTEGRATION.md, section "Catégories").
     Un produit dont la sous-catégorie n'est pas listée ici retombe sur son
     `activity` telle que renvoyée par l'API.
  -------------------------------------------------------------------- */
  var SUBCATEGORY_TO_TOP_CATEGORY = {
    fuel: "energy",
    "engine-oil": "lubricants",
    grease: "lubricants",
    accessories: "automotive",
    care: "automotive",
    topup: "digital",
  };

  /* Libellés bilingues pour les codes d'unité stockés en base (L, kg, unit...). */
  var UNIT_LABELS = {
    L: { fr: "litre", en: "liter" },
    l: { fr: "litre", en: "liter" },
    kg: { fr: "kilogramme", en: "kilogram" },
    unit: { fr: "unité", en: "unit" },
    unite: { fr: "unité", en: "unit" },
    pair: { fr: "paire", en: "pair" },
    service: { fr: "service", en: "service" },
  };

  function unitLabel(code) {
    return UNIT_LABELS[code] || { fr: code, en: code };
  }

  function topCategory(product) {
    return SUBCATEGORY_TO_TOP_CATEGORY[product.subcategory] || product.activity || "energy";
  }

  /**
   * Convertit un produit tel que renvoyé par GET /api/public/products
   * (voir api/src/routes/misc.ts → toPublicProduct) dans la forme attendue
   * par catalog.js / cart.js / product.js / energy.js.
   */
  function normalize(apiProduct) {
    return {
      id: apiProduct.id,
      category: topCategory(apiProduct),
      subcategory: apiProduct.subcategory || "",
      name: apiProduct.name,
      description: apiProduct.description,
      details: apiProduct.details,
      characteristics: apiProduct.characteristics,
      price: typeof apiProduct.salePrice === "number" ? apiProduct.salePrice : null,
      currency: apiProduct.currency,
      unit: unitLabel(apiProduct.unit),
      stock: apiProduct.stockStatus, // déjà "in-stock" | "low-stock" | "out-of-stock" (calculé côté serveur)
      featured: !!apiProduct.featured,
      brand: apiProduct.brand || "JIKKLO",
      sku: apiProduct.sku || "",
      // "unité de compte" spéciale héritée de la V002 : les recharges/télécom
      // sont affichées comme "sur devis" (bouton "Commander") plutôt qu'avec
      // un prix, quelle que soit la valeur numérique renvoyée par l'API.
      isQuote: apiProduct.subcategory === "topup",
      image: apiProduct.image || "",
      lastUpdated: apiProduct.lastUpdated || null,
    };
  }

  var state = {
    items: [],
    loaded: false,
    error: false,
  };

  function load() {
    if (!window.JIKKLO_API) {
      // js/api.js absent ou pas encore chargé : rien à faire, on reste en erreur.
      state.error = true;
      state.loaded = true;
      return Promise.resolve([]);
    }
    return window.JIKKLO_API.getProducts()
      .then(function (products) {
        state.items = products.map(normalize);
        state.loaded = true;
        state.error = false;
        document.dispatchEvent(new CustomEvent("jikklo:catalogready", { detail: { items: state.items } }));
        return state.items;
      })
      .catch(function (err) {
        console.error("JIKKLO catalog: échec du chargement depuis l'API.", err);
        state.items = [];
        state.loaded = true;
        state.error = true;
        document.dispatchEvent(new CustomEvent("jikklo:catalogerror", { detail: { error: err } }));
        return [];
      });
  }

  var readyPromise = load();

  window.JIKKLO_CATALOG = {
    ready: readyPromise,
    getAll: function () {
      return state.items.slice();
    },
    getById: function (id) {
      for (var i = 0; i < state.items.length; i += 1) {
        if (state.items[i].id === id) return state.items[i];
      }
      return null;
    },
    hasError: function () {
      return state.error;
    },
    isLoaded: function () {
      return state.loaded;
    },
    reload: function () {
      readyPromise = load();
      window.JIKKLO_CATALOG.ready = readyPromise;
      return readyPromise;
    },
  };
})();
