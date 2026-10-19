/* ==========================================================================
   JIKKLO — js/contact.js
   --------------------------------------------------------------------------
   Gère le formulaire de contact.

   Envoie désormais réellement le message à JIKKLO OS via
   POST /api/public/contact (voir js/api.js). Le backend crée une
   notification interne visible par l'équipe JIKKLO dans JIKKLO OS —
   AUCUN email n'est envoyé automatiquement pour l'instant (pas de service
   d'emailing configuré côté serveur, voir docs/REAL_SITE_INTEGRATION.md).
   Le message affiché à l'utilisateur reste donc honnête : le message est
   bien reçu par l'équipe, mais aucune confirmation par email n'est promise.
   ========================================================================== */

(function () {
  "use strict";

  const form = document.getElementById("contact-form");
  if (!form) return;

  const statusBox = document.getElementById("form-status");

  const fields = {
    name: form.querySelector("#field-name"),
    email: form.querySelector("#field-email"),
    subject: form.querySelector("#field-subject"),
    message: form.querySelector("#field-message"),
  };

  function showFieldError(fieldWrapper, show) {
    if (!fieldWrapper) return;
    fieldWrapper.classList.toggle("has-error", show);
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function validate() {
    let valid = true;

    const nameWrapper = fields.name?.closest(".form-field");
    if (!fields.name || fields.name.value.trim().length < 2) {
      showFieldError(nameWrapper, true);
      valid = false;
    } else {
      showFieldError(nameWrapper, false);
    }

    const emailWrapper = fields.email?.closest(".form-field");
    if (!fields.email || !isValidEmail(fields.email.value.trim())) {
      showFieldError(emailWrapper, true);
      valid = false;
    } else {
      showFieldError(emailWrapper, false);
    }

    const messageWrapper = fields.message?.closest(".form-field");
    if (!fields.message || fields.message.value.trim().length < 10) {
      showFieldError(messageWrapper, true);
      valid = false;
    } else {
      showFieldError(messageWrapper, false);
    }

    return valid;
  }

  // Traduit une clé via le moteur i18n si présent, sinon retombe sur le texte fourni
  function tr(key, fallback) {
    return window.JIKKLO_I18N ? window.JIKKLO_I18N.t(key) : fallback;
  }

  function setStatus(kind, text) {
    statusBox.className = "form-status is-visible" + (kind === "success" ? " success" : "");
    if (kind === "error") {
      statusBox.style.background = "rgba(255, 107, 107, 0.08)";
      statusBox.style.border = "1px solid rgba(255, 107, 107, 0.3)";
    } else {
      statusBox.style.background = "";
      statusBox.style.border = "";
    }
    statusBox.textContent = text;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (!validate()) {
      setStatus("error", tr("form.errorGeneric", "Please fill in all required fields correctly before sending."));
      return;
    }

    if (!window.JIKKLO_API) {
      setStatus("error", tr("form.errorGeneric", "Please fill in all required fields correctly before sending."));
      return;
    }

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    window.JIKKLO_API
      .submitContact({
        name: fields.name.value.trim(),
        email: fields.email.value.trim(),
        message: (fields.subject && fields.subject.value.trim() ? fields.subject.value.trim() + " — " : "") + fields.message.value.trim(),
      })
      .then(function () {
        setStatus(
          "success",
          tr(
            "form.successNote",
            "Your message has been sent to the JIKKLO team. We don't send an automatic email confirmation yet — " +
              "for anything urgent, please reach out via WhatsApp or phone below."
          )
        );
        form.reset();
      })
      .catch(function (err) {
        setStatus(
          "error",
          (err && err.message) ||
            tr("form.errorNetwork", "We couldn't send your message right now. Please try again, or reach out via WhatsApp or email below.")
        );
      })
      .finally(function () {
        if (submitBtn) submitBtn.disabled = false;
      });
  });

  /* -------------------------------------------------------------------
     Bouton WhatsApp : construit le lien à partir de config.js
  ------------------------------------------------------------------- */
  const whatsappLink = document.querySelector("[data-whatsapp-link]");
  if (whatsappLink) {
    const number = typeof JIKKLO_WHATSAPP !== "undefined" ? JIKKLO_WHATSAPP : "";
    if (number) {
      whatsappLink.setAttribute("href", "https://wa.me/" + number);
      whatsappLink.removeAttribute("hidden");
    } else {
      whatsappLink.setAttribute("hidden", "true");
    }
  }

  /* -------------------------------------------------------------------
     Si l'utilisateur change de langue après avoir vu un message de
     statut (erreur ou succès), on le retraduit pour rester cohérent.
  ------------------------------------------------------------------- */
  document.addEventListener("jikklo:langchange", function () {
    if (!statusBox.classList.contains("is-visible")) return;
    const key = statusBox.classList.contains("success") ? "form.successNote" : "form.errorGeneric";
    statusBox.textContent = tr(key, statusBox.textContent);
  });
})();
