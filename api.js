/* ==========================================================================
   JIKKLO — js/api.js
   --------------------------------------------------------------------------
   Client API centralisé pour jikklo.com → JIKKLO OS (Cloudflare Workers +
   D1). C'est le SEUL fichier qui connaît l'URL de l'API et la forme brute
   des réponses. Tous les autres scripts (catalog.js, cart.js, product.js,
   energy.js, checkout.js, contact.js) passent par window.JIKKLO_API.

   RÈGLE D'OR (voir docs/REAL_SITE_INTEGRATION.md) : les données commerciales
   (prix, stock, disponibilité) ne sont JAMAIS lues depuis un fichier local.
   Ce fichier va les chercher sur l'API à chaque chargement de page.

   Doit être chargé APRÈS js/config.js et AVANT tout autre script qui utilise
   window.JIKKLO_API (products-data.js, catalog.js, cart.js, product.js,
   energy.js, checkout.js, contact.js).
   ========================================================================== */

(function () {
  "use strict";

  /* --------------------------------------------------------------------
     1. URL DE L'API — un seul endroit à modifier (règle #7 du brief).
     - En local (localhost / 127.0.0.1) : l'API tourne sur :8787 (wrangler dev).
     - Sur jikklo.com / www.jikklo.com / toute autre origine : api.jikklo.com.
     Peut être surchargée manuellement avant le chargement de ce script avec :
       <script>window.JIKKLO_API_BASE_OVERRIDE = "http://localhost:8787";</script>
  -------------------------------------------------------------------- */
  function resolveApiBase() {
    if (typeof window.JIKKLO_API_BASE_OVERRIDE === "string" && window.JIKKLO_API_BASE_OVERRIDE) {
      return window.JIKKLO_API_BASE_OVERRIDE;
    }
    var host = window.location.hostname;
    var isLocal = host === "localhost" || host === "127.0.0.1" || host === "";
    return isLocal ? "http://localhost:8787" : "https://jikklo00.eneideaganze3.workers.dev";
  }

  var API_BASE = resolveApiBase();
  window.JIKKLO_API_BASE = API_BASE;

  /* --------------------------------------------------------------------
     2. Coeur des requêtes. `credentials: "include"` sur CHAQUE appel :
     indispensable pour que le cookie de session client (jikklo_customer_session,
     HttpOnly) parte et revienne correctement en cross-subdomain
     (jikklo.com ⇄ api.jikklo.com). Voir règle #19/#20/#54 du brief.
  -------------------------------------------------------------------- */
  function apiFetch(path, options) {
    options = options || {};
    return fetch(API_BASE + path, Object.assign({}, options, {
      credentials: "include",
      headers: Object.assign({ "Content-Type": "application/json" }, options.headers || {}),
    })).then(function (res) {
      return res.json().catch(function () {
        return null;
      }).then(function (body) {
        if (!res.ok) {
          var err = new Error((body && body.error && body.error.message) || "Erreur réseau JIKKLO API.");
          err.status = res.status;
          err.code = body && body.error && body.error.code;
          err.body = body;
          throw err;
        }
        return body;
      });
    });
  }

  /* --------------------------------------------------------------------
     3. Catalogue public — GET /api/public/*
     Ces routes ne nécessitent aucune authentification.
  -------------------------------------------------------------------- */
  function getProducts(params) {
    var qs = "";
    if (params) {
      var pairs = [];
      if (params.activity) pairs.push("activity=" + encodeURIComponent(params.activity));
      if (params.category) pairs.push("category=" + encodeURIComponent(params.category));
      if (pairs.length) qs = "?" + pairs.join("&");
    }
    return apiFetch("/api/public/products" + qs).then(function (r) {
      return (r && r.products) || [];
    });
  }

  function getProduct(id) {
    return apiFetch("/api/public/products/" + encodeURIComponent(id)).then(function (r) {
      return r ? { product: r.product, images: r.images || [] } : null;
    });
  }

  function getCategories() {
    return apiFetch("/api/public/categories").then(function (r) {
      return (r && r.categories) || [];
    });
  }

  function getPublicSettings() {
    return apiFetch("/api/settings/public").then(function (r) {
      return (r && r.settings) || {};
    });
  }

  function getPaymentMethods() {
    return apiFetch("/api/public/payment-methods").then(function (r) {
      return (r && r.paymentMethods) || [];
    });
  }

  function getPublications(limit) {
    var qs = limit ? "?limit=" + encodeURIComponent(limit) : "";
    return apiFetch("/api/public/publications" + qs).then(function (r) {
      return (r && r.publications) || [];
    });
  }

  function getDigitalServices() {
    return apiFetch("/api/public/digital-services").then(function (r) {
      return { currency: (r && r.currency) || "CDF", services: (r && r.services) || [] };
    });
  }

  function submitContact(payload) {
    return apiFetch("/api/public/contact", { method: "POST", body: JSON.stringify(payload) });
  }

  /* --------------------------------------------------------------------
     4. Commandes — POST /api/orders/public/create, suivi
     Le total et les prix envoyés par le navigateur ne sont JAMAIS pris en
     compte par le serveur (règle #13) : on n'envoie donc que productId +
     quantity, jamais de prix ni de total.
  -------------------------------------------------------------------- */
  function createOrder(payload) {
    return apiFetch("/api/orders/public/create", { method: "POST", body: JSON.stringify(payload) });
  }

  function trackOrder(orderNumber) {
    return apiFetch("/api/orders/public/track/" + encodeURIComponent(orderNumber)).then(function (r) {
      return r && r.order;
    });
  }

  /* --------------------------------------------------------------------
     5. Espace client — /api/customer/* (cookie HttpOnly, jamais de JWT en
     localStorage côté frontend — règle #20).
  -------------------------------------------------------------------- */
  var customer = {
    register: function (payload) {
      return apiFetch("/api/customer/register", { method: "POST", body: JSON.stringify(payload) });
    },
    login: function (payload) {
      return apiFetch("/api/customer/login", { method: "POST", body: JSON.stringify(payload) });
    },
    logout: function () {
      return apiFetch("/api/customer/logout", { method: "POST" });
    },
    me: function () {
      return apiFetch("/api/customer/me").then(function (r) {
        return r && r.customer;
      });
    },
    updateMe: function (payload) {
      return apiFetch("/api/customer/me", { method: "PATCH", body: JSON.stringify(payload) });
    },
    orders: function () {
      return apiFetch("/api/customer/orders").then(function (r) {
        return (r && r.orders) || [];
      });
    },
    orderDetail: function (id) {
      return apiFetch("/api/customer/orders/" + encodeURIComponent(id));
    },
  };

  window.JIKKLO_API = {
    base: API_BASE,
    apiFetch: apiFetch,
    getProducts: getProducts,
    getProduct: getProduct,
    getCategories: getCategories,
    getPublicSettings: getPublicSettings,
    getPaymentMethods: getPaymentMethods,
    getPublications: getPublications,
    getDigitalServices: getDigitalServices,
    submitContact: submitContact,
    createOrder: createOrder,
    trackOrder: trackOrder,
    customer: customer,
  };
})();
