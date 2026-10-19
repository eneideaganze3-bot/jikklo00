/* ==========================================================================
   JIKKLO — js/energy.js
   --------------------------------------------------------------------------
   Rendu des cartes carburant sur energy.html : prix, disponibilité, sélecteur
   de quantité avec sous-total calculé en direct, ajout au panier, lien
   WhatsApp de prise de contact rapide pour ce carburant. Les prix viennent
   exclusivement de l'API JIKKLO (via js/catalog-data.js) — rien n'est écrit
   en dur ici, et si l'API est injoignable aucun prix n'est affiché.
   ========================================================================== */

(function () {
  "use strict";

  function pick(field) {
    return window.JIKKLO_SHOP ? window.JIKKLO_SHOP.pick(field) : field.fr;
  }

  function fuelIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14"/><path d="M3 22h10"/><path d="M15 8h2l3 3v7a1.5 1.5 0 0 1-3 0v-2h-2"/><path d="M7 6V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/></svg>';
  }

  function stockLabel(product) {
    return window.JIKKLO_SHOP ? window.JIKKLO_SHOP.stockBadge(product) : "";
  }

  function formatUpdated(product) {
    const t = window.JIKKLO_I18N ? window.JIKKLO_I18N.t : (k) => k;
    if (!product.lastUpdated) return "";
    const lang = window.JIKKLO_I18N ? window.JIKKLO_I18N.getLang() : "fr";
    const formatted = new Date(product.lastUpdated).toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" });
    return `${t("product.lastUpdated")}: ${formatted}`;
  }

  function renderFuelCard(product) {
    const disabled = product.stock === "out-of-stock";
    const unit = pick(product.unit);
    return `
    <div class="fuel-card reveal" data-fuel-card="${product.id}">
      <div class="fuel-card-top">
        <div>
          <div class="fuel-card-icon">${fuelIcon()}</div>
          <h3 class="fuel-card-name">${window.JIKKLO_SHOP.escapeHtml(pick(product.name))}</h3>
          <p class="fuel-card-price">${window.formatPrice(product.price, product.currency)} <span>/ ${unit}</span></p>
          <p class="fuel-card-updated">${formatUpdated(product)}</p>
        </div>
        ${stockLabel(product)}
      </div>

      <div class="fuel-card-controls">
        <div class="qty-selector">
          <button type="button" data-fuel-decrease="${product.id}" aria-label="Decrease quantity" ${disabled ? "disabled" : ""}>−</button>
          <input type="number" min="1" value="1" data-fuel-qty="${product.id}" aria-label="Quantity" ${disabled ? "disabled" : ""} />
          <button type="button" data-fuel-increase="${product.id}" aria-label="Increase quantity" ${disabled ? "disabled" : ""}>+</button>
        </div>
        <div class="fuel-card-subtotal">
          <span data-i18n="cart.subtotal">Subtotal</span>
          <span data-fuel-subtotal="${product.id}">${window.formatPrice(product.price, product.currency)}</span>
        </div>
        <div class="fuel-card-actions">
          <button type="button" class="btn btn-primary btn-sm" data-fuel-add="${product.id}" ${disabled ? "disabled" : ""}>
            <span data-i18n="shop.addToCart">Add to Cart</span>
          </button>
          <a href="#" class="btn btn-whatsapp" data-fuel-whatsapp="${product.id}" target="_blank" rel="noopener noreferrer" hidden>
            <svg class="icon-16" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20Z"/></svg>
            <span data-i18n="product.orderQuickWhatsapp">Order via WhatsApp</span>
          </a>
        </div>
      </div>
    </div>`;
  }

  function currentQty(id) {
    const input = document.querySelector(`[data-fuel-qty="${id}"]`);
    return input ? Math.max(1, parseInt(input.value, 10) || 1) : 1;
  }

  function refreshFuelCard(product) {
    const qty = currentQty(product.id);
    const subtotalEl = document.querySelector(`[data-fuel-subtotal="${product.id}"]`);
    if (subtotalEl) subtotalEl.textContent = window.formatPrice(product.price * qty, product.currency);

    const waLink = document.querySelector(`[data-fuel-whatsapp="${product.id}"]`);
    if (waLink && window.JIKKLO_WA) {
      const orderId = window.JIKKLO_WA.generateOrderId();
      const message = window.JIKKLO_WA.buildOrderMessage([{ product, qty }], null, orderId);
      const url = window.JIKKLO_WA.buildWhatsAppUrl(message);
      waLink.hidden = !url;
      if (url) waLink.href = url;
    }
  }

  function render() {
    const grid = document.querySelector("[data-fuel-grid]");
    if (!grid) return;

    const t = window.JIKKLO_I18N ? window.JIKKLO_I18N.t : (k, fb) => fb || k;

    if (window.JIKKLO_CATALOG && !window.JIKKLO_CATALOG.isLoaded()) {
      grid.innerHTML = `<p class="empty-state">${t("shop.loading", "Chargement des carburants...")}</p>`;
      return;
    }
    if (window.JIKKLO_CATALOG && window.JIKKLO_CATALOG.hasError()) {
      grid.innerHTML = `<p class="empty-state">${t("shop.loadError", "Impossible de charger les informations actuellement. Veuillez réessayer.")}</p>`;
      return;
    }

    const source = window.JIKKLO_CATALOG ? window.JIKKLO_CATALOG.getAll() : [];
    const fuels = source.filter((p) => p.category === "energy" && p.subcategory === "fuel");
    if (fuels.length === 0) {
      grid.innerHTML = `<p class="empty-state" data-i18n="shop.noResults">No products match your search.</p>`;
      if (window.JIKKLO_I18N) window.JIKKLO_I18N.applyNow();
      return;
    }
    grid.innerHTML = fuels.map(renderFuelCard).join("");

    if (window.JIKKLO_I18N) window.JIKKLO_I18N.applyNow();
    if (window.JIKKLO_SHOP) window.JIKKLO_SHOP.attachImageFallback(grid);
    if (window.JIKKLO_ANIM) window.JIKKLO_ANIM.observeReveal(grid);

    fuels.forEach((product) => {
      refreshFuelCard(product);

      const qtyInput = grid.querySelector(`[data-fuel-qty="${product.id}"]`);
      const decreaseBtn = grid.querySelector(`[data-fuel-decrease="${product.id}"]`);
      const increaseBtn = grid.querySelector(`[data-fuel-increase="${product.id}"]`);
      const addBtn = grid.querySelector(`[data-fuel-add="${product.id}"]`);

      if (decreaseBtn) {
        decreaseBtn.addEventListener("click", () => {
          qtyInput.value = Math.max(1, currentQty(product.id) - 1);
          refreshFuelCard(product);
        });
      }
      if (increaseBtn) {
        increaseBtn.addEventListener("click", () => {
          qtyInput.value = currentQty(product.id) + 1;
          refreshFuelCard(product);
        });
      }
      if (qtyInput) {
        qtyInput.addEventListener("input", () => refreshFuelCard(product));
      }
      if (addBtn) {
        addBtn.addEventListener("click", () => {
          const added = window.JIKKLO_CART.addItem(product.id, currentQty(product.id));
          if (!added) return;
          const label = addBtn.querySelector("[data-i18n]");
          const original = label.textContent;
          label.textContent = window.JIKKLO_I18N ? window.JIKKLO_I18N.t("shop.added") : "Added ✓";
          setTimeout(() => {
            label.textContent = original;
          }, 1400);
        });
      }
    });
  }

  document.addEventListener("DOMContentLoaded", render);
  document.addEventListener("jikklo:langchange", render);
  document.addEventListener("jikklo:catalogready", render);
  document.addEventListener("jikklo:catalogerror", render);
})();
