/* ==========================================================================
   JIKKLO — js/product.js
   --------------------------------------------------------------------------
   Logique de la page product.html : lit l'identifiant produit dans l'URL
   (?id=...), affiche ses informations (prix, unité, stock, caractéristiques),
   gère le sélecteur de quantité, et génère un lien WhatsApp de PRISE DE
   CONTACT rapide via js/whatsapp.js (pas une commande officielle : la
   commande officielle passe par le panier + checkout.html + l'API, voir
   js/checkout.js).

   Dépend de js/catalog-data.js (données produits venant de l'API JIKKLO),
   js/i18n.js, js/cart.js, js/catalog.js (icônes), js/whatsapp.js.
   ========================================================================== */

(function () {
  "use strict";

  function getProductIdFromUrl() {
    if (typeof URLSearchParams !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("id");
    }
    // Repli manuel (navigateurs très anciens sans URLSearchParams)
    const match = window.location.search.match(/[?&]id=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function pick(field) {
    return window.JIKKLO_SHOP ? window.JIKKLO_SHOP.pick(field) : field.fr;
  }

  function updateWhatsAppLink(product, qty) {
    const link = document.querySelector("[data-whatsapp-order]");
    if (!link || !window.JIKKLO_WA) return;
    const orderId = window.JIKKLO_WA.generateOrderId();
    const message = window.JIKKLO_WA.buildOrderMessage([{ product, qty }], null, orderId);
    const url = window.JIKKLO_WA.buildWhatsAppUrl(message);
    if (!url) {
      link.hidden = true;
      return;
    }
    link.hidden = false;
    link.href = url;
  }

  function stockLabel(product) {
    const t = window.JIKKLO_I18N ? window.JIKKLO_I18N.t : (k) => k;
    if (window.JIKKLO_SHOP) return window.JIKKLO_SHOP.stockBadge(product);
    if (product.stock === "out-of-stock") return `🔴 ${t("stock.outOfStock")}`;
    if (product.stock === "low-stock") return `🟡 ${t("stock.lowStock")}`;
    return `🟢 ${t("stock.inStock")}`;
  }

  function render() {
    const root = document.querySelector("[data-product-detail]");
    if (!root) return;

    const t = window.JIKKLO_I18N ? window.JIKKLO_I18N.t : (k, fb) => fb || k;

    // Le catalogue est encore en cours de chargement depuis l'API : on
    // affiche un état de chargement plutôt qu'un "produit introuvable"
    // trompeur (règle #45 du brief d'intégration).
    if (window.JIKKLO_CATALOG && !window.JIKKLO_CATALOG.isLoaded()) {
      root.innerHTML = `<div class="empty-state" style="text-align:center;padding:60px 0;"><p>${t("shop.loading", "Chargement du produit...")}</p></div>`;
      return;
    }

    if (window.JIKKLO_CATALOG && window.JIKKLO_CATALOG.hasError()) {
      root.innerHTML = `
        <div class="empty-state" style="text-align:center;padding:60px 0;">
          <p>${t("shop.loadError", "Impossible de charger les informations actuellement. Veuillez réessayer.")}</p>
          <button type="button" class="btn btn-secondary" style="margin-top:20px;" onclick="window.location.reload()">${t("cart.loadErrorRetry", "Réessayer")}</button>
        </div>`;
      return;
    }

    const id = getProductIdFromUrl();
    const product = id && window.JIKKLO_CATALOG ? window.JIKKLO_CATALOG.getById(id) : null;

    if (!product) {
      root.innerHTML = `
        <div class="empty-state" style="text-align:center;padding:60px 0;">
          <p data-i18n="product.notFound">This product could not be found.</p>
          <a href="products.html" class="btn btn-secondary" style="margin-top:20px;" data-i18n="product.backToShop">Back to shop</a>
        </div>`;
      if (window.JIKKLO_I18N) window.JIKKLO_I18N.applyNow();
      return;
    }

    // Titre de page dynamique : "Nom du produit | JIKKLO"
    document.title = `${pick(product.name)} | JIKKLO`;

    const disabled = product.stock === "out-of-stock";
    const escapeHtml = window.JIKKLO_SHOP ? window.JIKKLO_SHOP.escapeHtml : (v) => String(v ?? "");
    const safeImageUrl = window.JIKKLO_SHOP ? window.JIKKLO_SHOP.safeImageUrl : () => "";
    const unit = escapeHtml(pick(product.unit));
    const name = escapeHtml(pick(product.name));
    const sku = escapeHtml(product.sku);
    const description = escapeHtml(pick(product.details || product.description));
    const imageUrl = safeImageUrl(product.image);
    const isQuote = product.isQuote || product.price == null;
    const priceHtml = isQuote
      ? `<span class="product-price-lg">${t("shop.orderCta")}</span>`
      : `<span class="product-price-lg">${window.formatPrice(product.price, product.currency)} <span style="font-size:1rem;font-weight:500;color:var(--text-secondary);">/ ${unit}</span></span>`;

    const characteristics = (product.characteristics && pick(product.characteristics)) || [];
    const characteristicsHtml = characteristics.length
      ? `<div style="margin-top:22px;">
           <h3 style="font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-secondary);" data-i18n="product.characteristics">Characteristics</h3>
           <ul style="margin-top:10px;display:flex;flex-direction:column;gap:6px;">
             ${characteristics.map((c) => `<li style="font-size:0.9rem;color:var(--text-secondary);display:flex;gap:8px;"><span style="color:var(--turquoise);">•</span>${window.JIKKLO_SHOP.escapeHtml(c)}</li>`).join("")}
           </ul>
         </div>`
      : "";

    const lastUpdated = product.lastUpdated
      ? new Date(product.lastUpdated).toLocaleString(window.JIKKLO_I18N ? window.JIKKLO_I18N.getLang() : "fr", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "";

    root.innerHTML = `
      <div class="product-detail-grid">
        <div class="product-detail-media">
          ${imageUrl
            ? `<img src="${imageUrl}" alt="${name}" data-icon-key="${escapeHtml(product.subcategory)}" data-icon-size="product-icon-fallback product-icon-fallback-lg" />`
            : `<div class="product-icon-fallback product-icon-fallback-lg">${(window.JIKKLO_SHOP && window.JIKKLO_SHOP.CATEGORY_ICONS[product.subcategory]) || ""}</div>`}
        </div>
        <div class="product-detail-info">
          ${stockLabel(product)}
          <h1 class="product-detail-title">${name}</h1>
          <p class="product-detail-sku">SKU: ${sku}</p>
          <p class="product-detail-desc">${description}</p>
          ${priceHtml}
          ${lastUpdated ? `<p class="product-detail-note" style="margin-top:6px;">${t("product.lastUpdated")}: ${lastUpdated}</p>` : ""}
          ${characteristicsHtml}

          <div class="product-detail-actions">
            <div class="qty-selector">
              <button type="button" data-qty-decrease aria-label="Decrease quantity">−</button>
              <input type="number" min="1" value="1" data-qty-input aria-label="Quantity" ${disabled ? "disabled" : ""} />
              <button type="button" data-qty-increase aria-label="Increase quantity">+</button>
            </div>
            <button type="button" class="btn btn-primary" data-add-to-cart-detail ${disabled ? "disabled" : ""}>
              <span data-i18n="shop.addToCart">Add to Cart</span>
            </button>
            <a href="#" class="btn btn-whatsapp" data-whatsapp-order target="_blank" rel="noopener noreferrer" hidden>
              <svg class="icon-18" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20Zm4.4-5.9c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.6.8-.8 1-.1.2-.3.2-.5.1-.2-.1-1-.4-2-1.2-.7-.7-1.2-1.5-1.4-1.7-.1-.2 0-.4.1-.5l.4-.4c.1-.2.2-.3.2-.5.1-.2 0-.3 0-.5l-.7-1.7c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.2-1 1-1 2.3 0 1.4 1 2.7 1.1 2.9.1.2 2 3 4.8 4.3.7.3 1.2.4 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.4-.6 1.6-1.1.2-.5.2-1 .2-1.1-.1-.1-.3-.2-.5-.3Z"/></svg>
              <span data-i18n="product.orderQuickWhatsapp">Order via WhatsApp</span>
            </a>
          </div>
        </div>
      </div>`;

    if (window.JIKKLO_I18N) window.JIKKLO_I18N.applyNow();
    if (window.JIKKLO_SHOP) window.JIKKLO_SHOP.attachImageFallback(root);
    if (window.JIKKLO_ANIM) window.JIKKLO_ANIM.observeReveal(root);

    const qtyInput = root.querySelector("[data-qty-input]");
    const decreaseBtn = root.querySelector("[data-qty-decrease]");
    const increaseBtn = root.querySelector("[data-qty-increase]");
    const addBtn = root.querySelector("[data-add-to-cart-detail]");

    function currentQty() {
      return Math.max(1, parseInt(qtyInput.value, 10) || 1);
    }
    function refreshWhatsApp() {
      updateWhatsAppLink(product, currentQty());
    }

    decreaseBtn.addEventListener("click", () => {
      qtyInput.value = Math.max(1, currentQty() - 1);
      refreshWhatsApp();
    });
    increaseBtn.addEventListener("click", () => {
      qtyInput.value = currentQty() + 1;
      refreshWhatsApp();
    });
    qtyInput.addEventListener("input", refreshWhatsApp);

    addBtn.addEventListener("click", () => {
      const added = window.JIKKLO_CART.addItem(product.id, currentQty());
      if (!added) return; // rupture de stock : rien à faire, bouton déjà désactivé
      const label = addBtn.querySelector("[data-i18n]");
      const original = label.textContent;
      label.textContent = window.JIKKLO_I18N ? window.JIKKLO_I18N.t("shop.added") : "Added ✓";
      setTimeout(() => {
        label.textContent = original;
      }, 1400);
    });

    refreshWhatsApp();
    document.addEventListener("jikklo:langchange", refreshWhatsApp);
  }

  document.addEventListener("DOMContentLoaded", render);
  document.addEventListener("jikklo:langchange", render);
  document.addEventListener("jikklo:catalogready", render);
  document.addEventListener("jikklo:catalogerror", render);
})();
