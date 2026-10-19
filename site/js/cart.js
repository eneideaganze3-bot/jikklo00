/* ==========================================================================
   JIKKLO — js/cart.js
   --------------------------------------------------------------------------
   Gère le panier : ajout, suppression, quantités, totaux, persistance via
   localStorage (le panier survit à la fermeture du navigateur). Chargé sur
   TOUTES les pages afin que le badge du panier dans la navbar soit toujours
   à jour, même si l'utilisateur n'a jamais ouvert cart.html.

   Contient aussi le rendu de la page cart.html (fonctions en bas de
   fichier), qui ne s'active que si les conteneurs [data-cart-*] existent.

   --------------------------------------------------------------------------
   INTÉGRATION JIKKLO OS : le panier reste stocké en localStorage, MAIS ne
   contient plus JAMAIS de prix (règle #11 du brief d'intégration) — juste
   { id, qty }. Le prix affiché est relu à chaque rendu depuis
   window.JIKKLO_CATALOG (js/catalog-data.js), qui vient lui-même de l'API
   JIKKLO. Ce fichier dépend de js/catalog-data.js (doit être chargé avant).
   ========================================================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "jikklo_cart";

  function readCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function writeCart(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      /* stockage indisponible : le panier reste actif pour la session en mémoire */
    }
    renderBadge();
    document.dispatchEvent(new CustomEvent("jikklo:cartchange", { detail: { items } }));
  }

  function findProduct(id) {
    return window.JIKKLO_CATALOG ? window.JIKKLO_CATALOG.getById(id) : null;
  }

  function getItems() {
    // Tant que le catalogue n'a pas fini de charger depuis l'API, on ne
    // filtre rien : mieux vaut afficher temporairement une ligne dont le
    // produit n'est pas encore résolu (voir renderCartPage) que de faire
    // disparaître silencieusement des articles pendant le chargement.
    if (window.JIKKLO_CATALOG && !window.JIKKLO_CATALOG.isLoaded()) {
      return readCart();
    }
    // Ne garde que les entrées dont le produit existe encore dans le catalogue
    return readCart().filter((entry) => !!findProduct(entry.id));
  }

  function addItem(id, qty) {
    const product = findProduct(id);
    // Filet de sécurité : empêche l'ajout d'un produit en rupture de stock
    // même si la fonction est appelée directement (pas seulement via un
    // bouton désactivé dans l'interface). Voir js/catalog.js et js/product.js.
    if (product && product.stock === "out-of-stock") return false;

    const quantity = Math.max(1, parseInt(qty, 10) || 1);
    const items = readCart();
    const existing = items.find((it) => it.id === id);
    if (existing) {
      existing.qty += quantity;
    } else {
      items.push({ id, qty: quantity });
    }
    writeCart(items);
    return true;
  }

  function removeItem(id) {
    const items = readCart().filter((it) => it.id !== id);
    writeCart(items);
  }

  function setQty(id, qty) {
    const quantity = Math.max(1, parseInt(qty, 10) || 1);
    const items = readCart();
    const existing = items.find((it) => it.id === id);
    if (existing) {
      existing.qty = quantity;
      writeCart(items);
    }
  }

  function clearCart() {
    writeCart([]);
  }

  function getItemCount() {
    return getItems().reduce((sum, it) => sum + it.qty, 0);
  }

  /**
   * Calcule les totaux. Les produits sans prix (`price: null`) sont exclus
   * du calcul monétaire et comptabilisés à part : le total réel n'est
   * connu qu'une fois JIKKLO confirmé (voir checkout.html).
   */
  function getTotals() {
    const items = getItems();
    let priced = 0;
    let unpricedCount = 0;
    let currency = "USD";

    items.forEach((entry) => {
      const product = findProduct(entry.id);
      if (!product) return;
      if (typeof product.price === "number" && !product.isQuote) {
        priced += product.price * entry.qty;
        currency = product.currency || currency;
      } else {
        unpricedCount += entry.qty;
      }
    });

    return {
      itemCount: items.reduce((sum, it) => sum + it.qty, 0),
      pricedSubtotal: priced,
      hasUnpriced: unpricedCount > 0,
      unpricedCount,
      currency,
      allUnpriced: priced === 0 && unpricedCount > 0,
    };
  }

  function renderBadge() {
    const count = getItemCount();
    Array.prototype.forEach.call(document.querySelectorAll("[data-cart-count]"), (el) => {
      el.textContent = String(count);
      el.hidden = count === 0;
    });
  }

  window.JIKKLO_CART = {
    getItems,
    addItem,
    removeItem,
    setQty,
    clearCart,
    getItemCount,
    getTotals,
    findProduct,
    renderBadge,
  };

  document.addEventListener("DOMContentLoaded", renderBadge);

  /* ------------------------------------------------------------------
     Rendu de la page cart.html (ne s'exécute que si le conteneur existe)
  ------------------------------------------------------------------ */
  function pick(field) {
    return window.JIKKLO_SHOP ? window.JIKKLO_SHOP.pick(field) : field.fr;
  }

  function escapeHtml(value) {
    return window.JIKKLO_SHOP ? window.JIKKLO_SHOP.escapeHtml(value) : String(value ?? "");
  }

  function safeImageUrl(value) {
    return window.JIKKLO_SHOP ? window.JIKKLO_SHOP.safeImageUrl(value) : "";
  }

  function renderCartPage() {
    const listEl = document.querySelector("[data-cart-list]");
    const summaryEl = document.querySelector("[data-cart-summary]");
    const emptyEl = document.querySelector("[data-cart-empty]");
    const errorEl = document.querySelector("[data-cart-error]");
    if (!listEl) return; // pas sur cart.html

    const t = window.JIKKLO_I18N ? window.JIKKLO_I18N.t : (k) => k;

    // Règle #45 : si l'API est injoignable, on ne prétend jamais afficher
    // des prix à jour — on l'indique clairement plutôt que de retomber sur
    // d'anciennes données.
    if (window.JIKKLO_CATALOG && window.JIKKLO_CATALOG.isLoaded() && window.JIKKLO_CATALOG.hasError()) {
      if (errorEl) errorEl.hidden = false;
      listEl.hidden = true;
      if (summaryEl) summaryEl.hidden = true;
      if (emptyEl) emptyEl.hidden = true;
      return;
    }
    if (errorEl) errorEl.hidden = true;

    const items = getItems();

    if (items.length === 0) {
      listEl.innerHTML = "";
      listEl.hidden = true;
      if (summaryEl) summaryEl.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
      return;
    }

    listEl.hidden = false;
    if (emptyEl) emptyEl.hidden = true;

    listEl.innerHTML = items
      .map((entry) => {
        const product = findProduct(entry.id);
        if (!product) return "";
        const isQuote = product.isQuote || product.price == null;
        const lineTotal = isQuote ? t("shop.priceOnRequest") : window.formatPrice(product.price * entry.qty, product.currency);
        const unitText = isQuote
          ? t("shop.priceOnRequest")
          : `${window.formatPrice(product.price, product.currency)} / ${pick(product.unit)}`;
        const name = escapeHtml(pick(product.name));
        const imageUrl = safeImageUrl(product.image);
        const media = imageUrl
          ? `<img src="${imageUrl}" alt="${name}" data-icon-key="${escapeHtml(product.subcategory)}" data-icon-size="product-icon-fallback product-icon-fallback-sm" />`
          : `<div class="product-icon-fallback product-icon-fallback-sm">${window.JIKKLO_SHOP && window.JIKKLO_SHOP.CATEGORY_ICONS[product.subcategory] || ""}</div>`;
        return `
        <div class="cart-line" data-cart-line="${escapeHtml(product.id)}">
          ${media}
          <div class="cart-line-info">
            <a href="product.html?id=${encodeURIComponent(product.id)}" class="cart-line-title">${name}</a>
            <span class="cart-line-unit">${escapeHtml(unitText)}</span>
          </div>
          <div class="qty-selector qty-selector-sm">
            <button type="button" data-cart-decrease="${product.id}" aria-label="Decrease quantity">−</button>
            <input type="number" min="1" value="${entry.qty}" data-cart-qty="${product.id}" aria-label="Quantity" />
            <button type="button" data-cart-increase="${product.id}" aria-label="Increase quantity">+</button>
          </div>
          <span class="cart-line-total">${escapeHtml(lineTotal)}</span>
          <button type="button" class="cart-line-remove" data-cart-remove="${product.id}" aria-label="Remove item">
            <svg class="icon-16" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/></svg>
          </button>
        </div>`;
      })
      .join("");

    if (summaryEl) {
      const totals = getTotals();
      summaryEl.hidden = false;
      const subtotalText =
        totals.pricedSubtotal > 0 ? window.formatPrice(totals.pricedSubtotal, totals.currency) : t("shop.priceOnRequest");
      summaryEl.querySelector("[data-cart-subtotal]").textContent = subtotalText;
      const note = summaryEl.querySelector("[data-cart-unpriced-note]");
      if (note) note.hidden = !totals.hasUnpriced;
    }

    if (window.JIKKLO_I18N) window.JIKKLO_I18N.applyNow();
    if (window.JIKKLO_SHOP) window.JIKKLO_SHOP.attachImageFallback(listEl);
    wireCartPageEvents();
  }

  function wireCartPageEvents() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-cart-remove]"), (btn) => {
      btn.addEventListener("click", () => {
        removeItem(btn.getAttribute("data-cart-remove"));
        renderCartPage();
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-cart-decrease]"), (btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-cart-decrease");
        const item = getItems().find((it) => it.id === id);
        if (item) setQty(id, item.qty - 1 <= 0 ? 1 : item.qty - 1);
        renderCartPage();
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-cart-increase]"), (btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-cart-increase");
        const item = getItems().find((it) => it.id === id);
        if (item) setQty(id, item.qty + 1);
        renderCartPage();
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-cart-qty]"), (input) => {
      input.addEventListener("change", () => {
        setQty(input.getAttribute("data-cart-qty"), input.value);
        renderCartPage();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", renderCartPage);
  document.addEventListener("jikklo:langchange", renderCartPage);
  document.addEventListener("jikklo:catalogready", () => {
    renderBadge();
    renderCartPage();
  });
  document.addEventListener("jikklo:catalogerror", () => {
    renderCartPage();
  });
})();
