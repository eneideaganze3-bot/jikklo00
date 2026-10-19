/* ==========================================================================
   JIKKLO — js/catalog.js
   --------------------------------------------------------------------------
   Rendu des cartes produits, réutilisé par :
   - products.html : catalogue complet avec recherche, filtres et tri
   - index.html : section "Explore JIKKLO" (produits mis en avant)
   - energy.html : les cartes carburant utilisent le même moteur d'icônes/
     de formatage, via renderFuelCard() (voir plus bas)

   Dépend de js/catalog-data.js (données produits venant de l'API JIKKLO —
   voir js/api.js), js/i18n.js, js/cart.js, js/main.js (formatPrice),
   js/whatsapp.js (chargés avant).
   ========================================================================== */

(function () {
  "use strict";

  function currentLang() {
    return window.JIKKLO_I18N ? window.JIKKLO_I18N.getLang() : "fr";
  }

  function pick(field) {
    const lang = currentLang();
    return field[lang] || field.fr || field.en || "";
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  // Only allow image sources that are safe to put in an HTML src attribute.
  // Product media is admin-controlled data, so never trust it as a URL.
  function safeImageUrl(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    const raw = value.trim();
    try {
      const url = new URL(raw, window.location.origin);
      if (url.protocol !== "https:" && url.protocol !== "http:") return "";
      return escapeHtml(url.href);
    } catch (_) {
      return "";
    }
  }

  /* Icônes de repli par sous-catégorie (utilisées tant qu'aucune vraie photo
     produit n'est présente dans assets/images/products/). */
  const CATEGORY_ICONS = {
    fuel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14"/><path d="M3 22h10"/><path d="M15 8h2l3 3v7a1.5 1.5 0 0 1-3 0v-2h-2"/><path d="M7 6V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/></svg>',
    "engine-oil": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z"/></svg>',
    grease: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="7"/><path d="M9 4h6l-1 4h-4z"/></svg>',
    accessories: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13l1.5-4.5A2 2 0 0 1 6.4 7h11.2a2 2 0 0 1 1.9 1.5L21 13"/><rect x="2" y="13" width="20" height="6" rx="1.5"/><circle cx="7" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/></svg>',
    care: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13l1.5-4.5A2 2 0 0 1 6.4 7h11.2a2 2 0 0 1 1.9 1.5L21 13"/><rect x="2" y="13" width="20" height="6" rx="1.5"/><circle cx="7" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/></svg>',
    topup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 18h6"/></svg>',
  };
  const DEFAULT_ICON = CATEGORY_ICONS.fuel;

  /**
   * Remplace une image cassée (photo produit absente) par une icône de
   * catégorie. Fait via addEventListener plutôt qu'un attribut onerror
   * inline (évite les bugs de guillemets non échappés en HTML).
   */
  function attachImageFallback(scope) {
    Array.prototype.forEach.call((scope || document).querySelectorAll("img[data-icon-key]"), (img) => {
      if (img.dataset.fallbackWired) return;
      img.dataset.fallbackWired = "1";
      img.addEventListener("error", function handler() {
        const icon = CATEGORY_ICONS[img.getAttribute("data-icon-key")] || DEFAULT_ICON;
        const div = document.createElement("div");
        div.className = img.getAttribute("data-icon-size") || "product-icon-fallback";
        div.innerHTML = icon;
        img.replaceWith(div);
      });
    });
  }

  function stockBadge(product) {
    const t = window.JIKKLO_I18N ? window.JIKKLO_I18N.t : (k) => k;
    if (product.stock === "out-of-stock") {
      return `<span class="badge badge-out">🔴 <span data-i18n="stock.outOfStock">${t("stock.outOfStock")}</span></span>`;
    }
    if (product.stock === "low-stock") {
      return `<span class="badge badge-low">🟡 <span data-i18n="stock.lowStock">${t("stock.lowStock")}</span></span>`;
    }
    return `<span class="badge badge-live">🟢 <span data-i18n="stock.inStock">${t("stock.inStock")}</span></span>`;
  }

  function renderProductCard(product) {
    const name = escapeHtml(pick(product.name));
    const desc = escapeHtml(pick(product.description));
    const unit = escapeHtml(pick(product.unit));
    const disabled = product.stock === "out-of-stock";
    const isQuote = product.isQuote || product.price == null;
    const priceText = isQuote
      ? (window.JIKKLO_I18N ? window.JIKKLO_I18N.t("shop.orderCta") : "Commander")
      : (window.formatPrice ? window.formatPrice(product.price, product.currency) : `${product.price} ${product.currency}`);
    // Pas de photo produit fournie par l'API (R2 pas encore configuré, voir
    // docs/REAL_SITE_INTEGRATION.md) : on affiche directement l'icône de
    // repli plutôt que de laisser le navigateur tenter de charger une image
    // cassée (règle #32/#33 du brief).
    const imageUrl = safeImageUrl(product.image);
    const media = imageUrl
      ? `<img src="${imageUrl}" alt="${name}" loading="lazy" data-icon-key="${escapeHtml(product.subcategory)}" data-icon-size="product-icon-fallback" />`
      : `<div class="product-icon-fallback">${CATEGORY_ICONS[product.subcategory] || DEFAULT_ICON}</div>`;

    return `
    <article class="product-card reveal" data-product-id="${product.id}" data-category="${product.category}" data-subcategory="${product.subcategory}" data-stock="${product.stock}" data-price="${product.price}" data-name="${name}">
      <a href="product.html?id=${encodeURIComponent(product.id)}" class="product-card-media" aria-label="${name}">
        ${media}
      </a>
      <div class="product-card-body">
        ${stockBadge(product)}
        <a href="product.html?id=${encodeURIComponent(product.id)}" class="product-card-title">${name}</a>
        <p class="product-card-desc">${desc}</p>
        <div class="product-card-footer">
          <span class="product-price">${priceText}${isQuote ? "" : ` <span class="product-unit">/ ${unit}</span>`}</span>
          <div class="product-card-actions">
            <a href="product.html?id=${encodeURIComponent(product.id)}" class="btn-icon" data-i18n-aria="shop.viewProduct" aria-label="View product">
              <svg class="icon-16" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>
            </a>
            <button type="button" class="btn btn-primary btn-sm" data-add-to-cart="${product.id}" ${disabled ? "disabled" : ""}>
              <span data-i18n="shop.addToCart">Add to Cart</span>
            </button>
          </div>
        </div>
      </div>
    </article>`;
  }

  function renderProductGrid(container, products) {
    if (!container) return;
    if (window.JIKKLO_CATALOG && window.JIKKLO_CATALOG.isLoaded() && window.JIKKLO_CATALOG.hasError()) {
      const t = window.JIKKLO_I18N ? window.JIKKLO_I18N.t : (k, fb) => fb || k;
      container.innerHTML = `<p class="empty-state">${t("shop.loadError", "Impossible de charger les produits actuellement. Veuillez réessayer.")}</p>`;
      return;
    }
    if (products.length === 0) {
      container.innerHTML = `<p class="empty-state" data-i18n="shop.noResults">No products match your search.</p>`;
      return;
    }
    container.innerHTML = products.map(renderProductCard).join("");
    if (window.JIKKLO_I18N) window.JIKKLO_I18N.applyNow();
    attachImageFallback(container);
    wireAddToCartButtons(container);
    if (window.JIKKLO_ANIM) window.JIKKLO_ANIM.observeReveal(container);
  }

  function wireAddToCartButtons(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll("[data-add-to-cart]"), (btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-add-to-cart");
        window.JIKKLO_CART.addItem(id, 1);
        btn.classList.add("is-added");
        const label = btn.querySelector("[data-i18n]") || btn;
        const original = label.textContent;
        label.textContent = window.JIKKLO_I18N ? window.JIKKLO_I18N.t("shop.added") : "Added ✓";
        setTimeout(() => {
          label.textContent = original;
          btn.classList.remove("is-added");
        }, 1400);
      });
    });
  }

  window.JIKKLO_SHOP = {
    renderProductCard,
    renderProductGrid,
    wireAddToCartButtons,
    attachImageFallback,
    stockBadge,
    pick,
    escapeHtml,
    safeImageUrl,
    CATEGORY_ICONS,
  };

  /* --------------------------------------------------------------------
     Câblage spécifique à products.html : filtres + recherche + tri
  -------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    const grid = document.querySelector("[data-shop-grid]");
    if (!grid) return; // pas sur products.html, rien à faire ici

    const searchInput = document.querySelector("[data-shop-search]");
    const filterButtons = document.querySelectorAll("[data-shop-filter]");
    const sortSelect = document.querySelector("[data-shop-sort]");
    let activeFilter = "all";

    function applyFilters() {
      const query = (searchInput && searchInput.value.trim().toLowerCase()) || "";
      const source = window.JIKKLO_CATALOG ? window.JIKKLO_CATALOG.getAll() : [];
      let filtered = source.filter((p) => {
        const matchesFilter = activeFilter === "all" || p.category === activeFilter;
        if (!matchesFilter) return false;
        if (!query) return true;
        const haystack = (pick(p.name) + " " + pick(p.description)).toLowerCase();
        return haystack.indexOf(query) !== -1;
      });

      const sortValue = sortSelect ? sortSelect.value : "default";
      if (sortValue === "price-asc") {
        filtered = filtered.slice().sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
      } else if (sortValue === "price-desc") {
        filtered = filtered.slice().sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      } else if (sortValue === "name-asc") {
        filtered = filtered.slice().sort((a, b) => pick(a.name).localeCompare(pick(b.name)));
      }

      renderProductGrid(grid, filtered);
    }

    Array.prototype.forEach.call(filterButtons, (btn) => {
      btn.addEventListener("click", () => {
        Array.prototype.forEach.call(filterButtons, (b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        activeFilter = btn.getAttribute("data-shop-filter");
        applyFilters();
      });
    });

    if (searchInput) searchInput.addEventListener("input", applyFilters);
    if (sortSelect) sortSelect.addEventListener("change", applyFilters);

    document.addEventListener("jikklo:langchange", applyFilters);
    document.addEventListener("jikklo:catalogready", applyFilters);
    document.addEventListener("jikklo:catalogerror", applyFilters);

    // Affiche un état de chargement pendant le premier appel réseau plutôt
    // qu'une grille vide muette.
    if (window.JIKKLO_CATALOG && !window.JIKKLO_CATALOG.isLoaded()) {
      const t = window.JIKKLO_I18N ? window.JIKKLO_I18N.t : (k, fb) => fb || k;
      grid.innerHTML = `<p class="empty-state">${t("shop.loading", "Chargement des produits...")}</p>`;
    }
    applyFilters();
  });

  /* --------------------------------------------------------------------
     Section "Explore JIKKLO" sur index.html (produits mis en avant)
  -------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    const featuredGrid = document.querySelector("[data-featured-grid]");
    if (!featuredGrid) return;

    function renderFeatured() {
      const source = window.JIKKLO_CATALOG ? window.JIKKLO_CATALOG.getAll() : [];
      renderProductGrid(featuredGrid, source.filter((p) => p.featured));
    }

    if (window.JIKKLO_CATALOG && !window.JIKKLO_CATALOG.isLoaded()) {
      const t = window.JIKKLO_I18N ? window.JIKKLO_I18N.t : (k, fb) => fb || k;
      featuredGrid.innerHTML = `<p class="empty-state">${t("shop.loading", "Chargement des produits...")}</p>`;
    }
    renderFeatured();
    document.addEventListener("jikklo:langchange", renderFeatured);
    document.addEventListener("jikklo:catalogready", renderFeatured);
    document.addEventListener("jikklo:catalogerror", renderFeatured);
  });
})();
