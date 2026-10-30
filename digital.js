/* ==========================================================================
   JIKKLO — js/digital.js
   Affiche, sur digital.html, les services Jikklo Digital ACTIVÉS dans
   l'Admin (GET /api/public/digital-services). Un service créé dans
   Admin → Jikklo Digital apparaît ici dès qu'il est activé, sans
   modification de ce fichier. La section reste masquée s'il n'y en a aucun.
   Un service se demande par WhatsApp (message prérempli) : les services
   Digital n'ont pas de panier ni de paiement en ligne.
   Tout le texte est inséré avec textContent : aucune injection HTML possible.
   ========================================================================== */
(function () {
  "use strict";

  // Libellés propres à cette section (français par défaut, anglais si la
  // langue du site est l'anglais) ; les noms et descriptions viennent de l'Admin.
  var LABELS = {
    fr: {
      title: "Nos services disponibles",
      request: "Demander ce service",
      onRequest: "Prix sur demande",
      message: function (name) { return "Bonjour JIKKLO, je souhaite le service « " + name + " »."; },
    },
    en: {
      title: "Available services",
      request: "Request this service",
      onRequest: "Price on request",
      message: function (name) { return "Hello JIKKLO, I would like to request the service \"" + name + "\"."; },
    },
  };

  var lastData = null;

  function labels() {
    return LABELS[document.documentElement.getAttribute("lang") === "en" ? "en" : "fr"];
  }

  function priceText(price, currency) {
    if (typeof window.formatPrice === "function") return window.formatPrice(price, currency);
    return price + " " + currency;
  }

  function whatsappNumber() {
    return (typeof JIKKLO_WHATSAPP !== "undefined" && JIKKLO_WHATSAPP) || "";
  }

  function render(data) {
    var section = document.querySelector("[data-digital-services-section]");
    var list = document.querySelector("[data-digital-services-list]");
    var titleEl = document.querySelector("[data-digital-services-title]");
    if (!section || !list) return;

    var services = (data && data.services) || [];
    if (services.length === 0) {
      section.hidden = true;
      return;
    }

    var l = labels();
    var number = whatsappNumber();
    if (titleEl) titleEl.textContent = l.title;
    list.textContent = "";

    services.forEach(function (svc) {
      var card = document.createElement("div");
      card.className = "card";

      var h3 = document.createElement("h3");
      h3.style.fontSize = "1.15rem";
      h3.textContent = svc.name;
      card.appendChild(h3);

      if (svc.description) {
        var desc = document.createElement("p");
        desc.style.cssText = "margin-top:10px;color:var(--text-secondary);font-size:0.92rem;";
        desc.textContent = svc.description;
        card.appendChild(desc);
      }

      var price = document.createElement("p");
      price.style.cssText = "margin-top:12px;font-weight:700;color:var(--turquoise);";
      price.textContent =
        typeof svc.price === "number" ? priceText(svc.price, data.currency) : l.onRequest;
      card.appendChild(price);

      if (number) {
        var link = document.createElement("a");
        link.className = "btn btn-whatsapp";
        link.style.marginTop = "16px";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.href = "https://wa.me/" + number + "?text=" + encodeURIComponent(l.message(svc.name));
        link.textContent = l.request;
        card.appendChild(link);
      }

      list.appendChild(card);
    });

    section.hidden = false;
  }

  function load() {
    if (!document.querySelector("[data-digital-services-section]") || !window.JIKKLO_API) return;
    window.JIKKLO_API.getDigitalServices()
      .then(function (data) {
        lastData = data;
        render(data);
      })
      .catch(function () {
        // Une erreur réseau ne doit jamais casser la page : la section reste masquée.
        var section = document.querySelector("[data-digital-services-section]");
        if (section) section.hidden = true;
      });
  }

  document.addEventListener("DOMContentLoaded", load);
  document.addEventListener("jikklo:langchange", function () {
    if (lastData) render(lastData);
  });
})();
