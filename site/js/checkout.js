/* ==========================================================================
   JIKKLO — js/checkout.js
   --------------------------------------------------------------------------
   - Affiche un récapitulatif de commande (lecture seule) basé sur le panier,
     avec les prix relus en direct depuis window.JIKKLO_CATALOG (API JIKKLO).
   - Valide le formulaire client (nom, téléphone, adresse, mode de réception).
   - Envoie la commande à JIKKLO OS via POST /api/orders/public/create
     (voir js/api.js) : le serveur recalcule TOUJOURS le prix, le stock, la
     livraison et le total. Le total affiché ici n'est qu'un aperçu — il
     n'est JAMAIS envoyé au serveur, qui l'ignorerait de toute façon
     (règle #13 du brief d'intégration).
   - Le numéro de commande affiché après validation est celui renvoyé par
     le serveur (ex: JKK-2026-000001) — plus jamais généré côté navigateur.
   - Si WhatsApp Cloud API n'est pas configuré côté serveur
     (`whatsappConfigured: false`), un bouton "Confirmer via WhatsApp" est
     affiché avec le message déjà préparé par le serveur (`whatsappMessage`).
     Aucun paiement en ligne réel n'est simulé ici (règle #56) : le bloc
     "Payment" du formulaire indique clairement que ce n'est pas encore
     disponible.
   ========================================================================== */

(function () {
  "use strict";

  function pick(field) {
    return window.JIKKLO_SHOP ? window.JIKKLO_SHOP.pick(field) : field.fr;
  }

  function t(key, fallback) {
    return window.JIKKLO_I18N ? window.JIKKLO_I18N.t(key) : fallback || key;
  }

  function escapeHtml(value) {
    return window.JIKKLO_SHOP ? window.JIKKLO_SHOP.escapeHtml(value) : String(value ?? "");
  }

  function renderSummary() {
    const summaryList = document.querySelector("[data-checkout-summary]");
    if (!summaryList) return; // pas sur checkout.html

    const emptyNote = document.querySelector("[data-checkout-empty]");
    const layout = document.querySelector("[data-checkout-layout]");

    if (window.JIKKLO_CATALOG && window.JIKKLO_CATALOG.isLoaded() && window.JIKKLO_CATALOG.hasError()) {
      summaryList.innerHTML = `<p class="empty-state">${t("shop.loadError", "Impossible de charger les informations actuellement. Veuillez réessayer.")}</p>`;
      if (layout) layout.hidden = false;
      if (emptyNote) emptyNote.hidden = true;
      return;
    }

    const items = window.JIKKLO_CART.getItems();

    if (items.length === 0) {
      summaryList.innerHTML = "";
      if (emptyNote) emptyNote.hidden = false;
      if (layout) layout.hidden = true;
      return;
    }
    if (emptyNote) emptyNote.hidden = true;
    if (layout) layout.hidden = false;

    summaryList.innerHTML = items
      .map((entry) => {
        const product = window.JIKKLO_CART.findProduct(entry.id);
        if (!product) return "";
        const isQuote = product.isQuote || product.price == null;
        const lineTotal = isQuote ? t("shop.priceOnRequest") : window.formatPrice(product.price * entry.qty, product.currency);
        return `<div class="checkout-line">
          <span>${escapeHtml(entry.qty)} × ${escapeHtml(pick(product.name))}</span>
          <span>${escapeHtml(lineTotal)}</span>
        </div>`;
      })
      .join("");

    const totals = window.JIKKLO_CART.getTotals();
    const totalEl = document.querySelector("[data-checkout-total]");
    if (totalEl) {
      totalEl.textContent = window.formatPrice(totals.pricedSubtotal, totals.currency);
    }
    const note = document.querySelector("[data-checkout-unpriced-note]");
    if (note) note.hidden = !totals.hasUnpriced;
  }

  function showError(input, show) {
    const wrapper = input.closest(".form-field");
    if (wrapper) wrapper.classList.toggle("has-error", show);
  }

  function validateForm(form) {
    let valid = true;
    ["name", "phone", "address", "city"].forEach((field) => {
      const input = form.querySelector(`[name="${field}"]`);
      if (!input) return;
      const isEmpty = input.value.trim().length < 2;
      showError(input, isEmpty);
      if (isEmpty) valid = false;
    });
    return valid;
  }

  function setSubmitError(message) {
    const errorEl = document.querySelector("[data-checkout-error]");
    if (!errorEl) return;
    if (!message) {
      errorEl.hidden = true;
      errorEl.textContent = "";
      return;
    }
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  function errorMessageFor(err) {
    if (err && err.code === "INSUFFICIENT_STOCK") return t("checkout.errorStock");
    if (err && err.code === "VALIDATION_ERROR") return t("checkout.errorValidation");
    if (err && err.message) return err.message;
    return t("checkout.errorGeneric");
  }

  function showConfirmation(response) {
    const layout = document.querySelector("[data-checkout-layout]");
    const emptyNote = document.querySelector("[data-checkout-empty]");
    const confirmationEl = document.querySelector("[data-checkout-confirmation]");
    const confirmationTextEl = document.querySelector("[data-checkout-confirmation-text]");
    const orderIdEl = document.querySelector("[data-checkout-order-id]");
    const whatsappCta = document.querySelector("[data-checkout-whatsapp-cta]");

    if (layout) layout.hidden = true;
    if (emptyNote) emptyNote.hidden = true;
    if (!confirmationEl) return;

    confirmationEl.hidden = false;
    if (orderIdEl) orderIdEl.textContent = response.orderNumber;

    if (response.whatsappConfigured) {
      if (confirmationTextEl) confirmationTextEl.textContent = t("checkout.confirmationSent");
      if (whatsappCta) whatsappCta.hidden = true;
    } else {
      if (confirmationTextEl) confirmationTextEl.textContent = t("checkout.confirmationWhatsapp");
      if (whatsappCta && response.whatsappMessage) {
        const number = (typeof JIKKLO_WHATSAPP !== "undefined" && JIKKLO_WHATSAPP) || "";
        whatsappCta.href = `https://wa.me/${number}?text=${encodeURIComponent(response.whatsappMessage)}`;
        whatsappCta.hidden = !number;
      }
    }

    renderPaymentRecap(response, confirmationTextEl);

    // Le panier a été consommé par une commande réelle côté serveur : on le
    // vide pour éviter une double commande accidentelle si l'utilisateur
    // revient en arrière.
    window.JIKKLO_CART.clearCart();
  }

  // Rappel du paiement à effectuer, affiché sur l'écran de confirmation :
  // montant, moyen choisi et instructions (numéro agent…). Sans ce rappel,
  // un client qui commande avant de payer perdait ces informations.
  // Libellés propres à cet écran (français par défaut, anglais si la langue
  // du site est l'anglais) ; les instructions viennent de l'Admin.
  const RECAP_LABELS = {
    fr: {
      amount: "Montant à payer",
      method: "Moyen de paiement",
      after: "Une fois le paiement effectué, notre équipe le vérifie puis confirme votre commande. Gardez le message de confirmation de l'opérateur : il peut vous être demandé.",
    },
    en: {
      amount: "Amount to pay",
      method: "Payment method",
      after: "Once you have paid, our team checks the payment and confirms your order. Keep the confirmation message from your mobile money operator: we may ask for it.",
    },
  };

  function renderPaymentRecap(response, anchorEl) {
    let recapEl = document.querySelector("[data-checkout-payment-recap]");
    if (!recapEl) {
      if (!anchorEl || !anchorEl.parentNode) return;
      recapEl = document.createElement("div");
      recapEl.setAttribute("data-checkout-payment-recap", "");
      recapEl.style.cssText =
        "margin:16px auto 0;max-width:520px;padding:14px 16px;border:1px solid var(--turquoise);border-radius:var(--radius-md);text-align:left;font-size:0.9rem;display:grid;gap:8px;";
      anchorEl.parentNode.insertBefore(recapEl, anchorEl.nextSibling);
    }
    recapEl.textContent = "";

    const payment = response && response.payment;
    if (!payment || payment.kind !== "manual") {
      recapEl.hidden = true;
      return;
    }
    recapEl.hidden = false;

    const lang = document.documentElement.getAttribute("lang") === "en" ? "en" : "fr";
    const labels = RECAP_LABELS[lang];
    const total = Number(response.total);
    const amountText = Number.isFinite(total)
      ? total.toLocaleString(lang === "en" ? "en-US" : "fr-FR") + " " + (response.currency || "")
      : "";

    function addLine(label, value, strong) {
      if (!value) return;
      const line = document.createElement("div");
      if (label) {
        const labelEl = document.createElement("span");
        labelEl.textContent = label + " : ";
        line.appendChild(labelEl);
      }
      const valueEl = document.createElement(strong ? "strong" : "span");
      valueEl.textContent = value; // textContent : aucune injection HTML possible
      line.appendChild(valueEl);
      recapEl.appendChild(line);
    }

    addLine(labels.amount, amountText.trim(), true);
    addLine(labels.method, payment.methodName, true);
    addLine("", payment.instructions, false);
    addLine("", labels.after, false);
  }

  var loadedPaymentMethods = [];
  var selectedPaymentMethodId = null;

  function renderPaymentMethods() {
    var container = document.querySelector("[data-checkout-payment-methods]");
    var fallback = document.querySelector("[data-checkout-payment-fallback]");
    var instructionsEl = document.querySelector("[data-checkout-payment-instructions]");
    var referenceField = document.querySelector("[data-checkout-payment-reference-field]");
    if (!container || !window.JIKKLO_API) return;

    window.JIKKLO_API.getPaymentMethods()
      .then(function (methods) {
        loadedPaymentMethods = methods || [];
        if (loadedPaymentMethods.length === 0) {
          // Aucun moyen activé côté Admin : on retombe sur le message
          // historique (confirmation via WhatsApp), sans rien casser.
          if (fallback) fallback.hidden = false;
          return;
        }
        if (fallback) fallback.hidden = true;

        container.innerHTML = loadedPaymentMethods
          .map(function (m, idx) {
            var checked = idx === 0 ? "checked" : "";
            if (idx === 0) selectedPaymentMethodId = m.id;
            return (
              '<label class="radio-option" style="display:flex;align-items:center;gap:8px;">' +
              '<input type="radio" name="paymentMethodId" value="' + m.id + '" ' + checked + ' />' +
              "<span>" + m.name + (m.kind === "manual" ? "" : " (" + t("checkout.paymentApi", "en ligne") + ")") + "</span>" +
              "</label>"
            );
          })
          .join("");

        container.querySelectorAll('input[name="paymentMethodId"]').forEach(function (input) {
          input.addEventListener("change", function () {
            selectedPaymentMethodId = input.value;
            updateInstructions();
          });
        });

        updateInstructions();
      })
      .catch(function () {
        // Si l'API des moyens de paiement échoue, ne bloque jamais la
        // commande : on retombe sur le comportement historique.
        if (fallback) fallback.hidden = false;
      });

    function updateInstructions() {
      var method = loadedPaymentMethods.find(function (m) {
        return m.id === selectedPaymentMethodId;
      });
      if (!method) {
        if (instructionsEl) instructionsEl.hidden = true;
        if (referenceField) referenceField.hidden = true;
        return;
      }
      if (instructionsEl) {
        if (method.instructions) {
          instructionsEl.hidden = false;
          instructionsEl.textContent = method.instructions;
        } else {
          instructionsEl.hidden = true;
        }
      }
      // La référence de transaction n'a de sens que pour un paiement manuel
      // (le client paie d'abord hors-ligne, puis indique la référence).
      if (referenceField) referenceField.hidden = method.kind !== "manual";
    }
  }

  function wireForm() {
    const form = document.querySelector("[data-checkout-form]");
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      setSubmitError(null);
      if (!validateForm(form)) return;
      if (!window.JIKKLO_API) {
        setSubmitError(t("checkout.errorGeneric"));
        return;
      }

      const deliveryInput = form.querySelector('[name="delivery"]:checked');
      if (!deliveryInput) return;
      const deliveryMode = deliveryInput.value === "delivery" ? "delivery" : "pickup";

      const phone = form.querySelector('[name="phone"]').value.trim();
      const altWhatsapp = form.querySelector('[name="whatsapp"]') ? form.querySelector('[name="whatsapp"]').value.trim() : "";
      const address = form.querySelector('[name="address"]').value.trim();
      const city = form.querySelector('[name="city"]').value.trim();
      const comment = form.querySelector('[name="comment"]') ? form.querySelector('[name="comment"]').value.trim() : "";

      const notesParts = [];
      if (city) notesParts.push(`Ville: ${city}`);
      if (altWhatsapp && altWhatsapp !== phone) notesParts.push(`WhatsApp: ${altWhatsapp}`);
      if (comment) notesParts.push(comment);

      // Règle #11/#13 du brief : uniquement productId + quantity envoyés au
      // serveur, JAMAIS de prix ni de total — le serveur relit tout depuis D1.
      const items = window.JIKKLO_CART.getItems().map((entry) => ({
        productId: entry.id,
        quantity: entry.qty,
      }));

      if (items.length === 0) return;

      const payload = {
        customerName: form.querySelector('[name="name"]').value.trim(),
        customerPhone: phone,
        items: items,
        deliveryMode: deliveryMode,
        deliveryAddress: address || undefined,
        notes: notesParts.length ? notesParts.join(" — ") : undefined,
        paymentMethodId: selectedPaymentMethodId || undefined,
        paymentReference: (function () {
          const refInput = form.querySelector('[name="paymentReference"]');
          const val = refInput ? refInput.value.trim() : "";
          return val || undefined;
        })(),
      };

      const submitBtn = document.getElementById("checkout-submit");
      const originalLabel = submitBtn ? submitBtn.textContent : "";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = t("checkout.submitting");
      }

      window.JIKKLO_API
        .createOrder(payload)
        .then((response) => {
          showConfirmation(response);
        })
        .catch((err) => {
          console.error("JIKKLO checkout: échec de la création de commande.", err);
          setSubmitError(errorMessageFor(err));
        })
        .finally(() => {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalLabel;
          }
        });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderSummary();
    renderPaymentMethods();
    wireForm();
  });
  document.addEventListener("jikklo:langchange", renderSummary);
  document.addEventListener("jikklo:cartchange", renderSummary);
  document.addEventListener("jikklo:catalogready", renderSummary);
  document.addEventListener("jikklo:catalogerror", renderSummary);
})();
