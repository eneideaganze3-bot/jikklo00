/* ==========================================================================
   JIKKLO — js/main.js
   Comportement global partagé par toutes les pages :
   navbar (scroll + menu mobile), injection des infos de config.js,
   lien actif dans la navigation, année du footer.
   ========================================================================== */

(function () {
  "use strict";

  /* -------------------------------------------------------------------
     0. Formatage des prix — fonction centralisée utilisée par tout le
     site (cartes produits, panier, checkout, messages WhatsApp).
     Exemple : formatPrice(5500) → "5 500 FC"
  ------------------------------------------------------------------- */
  // Certaines API/valeurs de settings utilisent le code ISO "CDF" (franc
  // congolais) ; le site affiche historiquement l'abréviation locale "FC".
  // Cette table ne change aucune donnée, seulement l'affichage.
  const CURRENCY_DISPLAY = { CDF: "FC" };

  function formatPrice(amount, currency) {
    const rawCur = currency || (typeof JIKKLO_CURRENCY !== "undefined" ? JIKKLO_CURRENCY : "FC");
    const cur = CURRENCY_DISPLAY[rawCur] || rawCur;
    if (typeof amount !== "number" || isNaN(amount)) return "";
    // Sépare les milliers par une espace (ex: 15000 -> "15 000")
    const formatted = Math.round(amount)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return `${formatted} ${cur}`;
  }
  window.formatPrice = formatPrice;

  /* -------------------------------------------------------------------
     1. Navbar : effet au scroll
  ------------------------------------------------------------------- */
  const navbar = document.querySelector(".navbar");

  function updateNavbarOnScroll() {
    if (!navbar) return;
    navbar.classList.toggle("is-scrolled", window.scrollY > 12);
  }
  updateNavbarOnScroll();
  window.addEventListener("scroll", updateNavbarOnScroll, { passive: true });

  /* -------------------------------------------------------------------
     2. Menu mobile : ouverture / fermeture animée
  ------------------------------------------------------------------- */
  const toggleBtn = document.querySelector(".navbar-toggle");
  const mobileMenu = document.querySelector(".mobile-menu");
  const iconMenu = document.querySelector(".icon-menu");
  const iconClose = document.querySelector(".icon-close");

  function setMenuOpen(isOpen) {
    if (!mobileMenu || !toggleBtn) return;
    mobileMenu.classList.toggle("is-open", isOpen);
    toggleBtn.setAttribute("aria-expanded", String(isOpen));
    document.body.style.overflow = isOpen ? "hidden" : "";
    if (iconMenu && iconClose) {
      iconMenu.style.display = isOpen ? "none" : "block";
      iconClose.style.display = isOpen ? "block" : "none";
    }
  }

  if (toggleBtn && mobileMenu) {
    toggleBtn.addEventListener("click", () => {
      const isOpen = mobileMenu.classList.contains("is-open");
      setMenuOpen(!isOpen);
    });

    // Ferme le menu quand on clique sur un lien
    // (Array.prototype.forEach.call plutôt que NodeList.forEach : compatible
    // avec un plus grand nombre de moteurs de navigateur, y compris anciens)
    Array.prototype.forEach.call(mobileMenu.querySelectorAll("a"), (link) => {
      link.addEventListener("click", () => setMenuOpen(false));
    });
  }

  /* -------------------------------------------------------------------
     3. Lien de navigation actif (marque la page courante)
  ------------------------------------------------------------------- */
  const currentPage = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();

  Array.prototype.forEach.call(document.querySelectorAll(".navbar-links a, .mobile-menu a"), (link) => {
    const href = (link.getAttribute("href") || "").toLowerCase();
    if (href === currentPage || (currentPage === "" && href === "index.html")) {
      link.setAttribute("aria-current", "page");
    }
  });

  /* -------------------------------------------------------------------
     4. Injection des informations de config.js dans le DOM
     Tout élément avec [data-config="EMAIL"] reçoit la valeur correspondante.
     Les blocs [data-config-optional="..."] sont masqués si la valeur est vide,
     pour ne jamais afficher d'information non disponible.
  ------------------------------------------------------------------- */
  const CONFIG_MAP = {
    NAME: typeof JIKKLO_NAME !== "undefined" ? JIKKLO_NAME : "",
    EMAIL: typeof JIKKLO_EMAIL !== "undefined" ? JIKKLO_EMAIL : "",
    PHONE: typeof JIKKLO_PHONE !== "undefined" ? JIKKLO_PHONE : "",
    LOCATION: typeof JIKKLO_LOCATION !== "undefined" ? JIKKLO_LOCATION : "",
    WHATSAPP: typeof JIKKLO_WHATSAPP !== "undefined" ? JIKKLO_WHATSAPP : "",
    VERSION: typeof JIKKLO_VERSION !== "undefined" ? JIKKLO_VERSION : "v0.01",
  };

  Array.prototype.forEach.call(document.querySelectorAll("[data-config]"), (el) => {
    const key = el.getAttribute("data-config");
    if (CONFIG_MAP[key]) {
      el.textContent = CONFIG_MAP[key];
    }
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-config-href]"), (el) => {
    const key = el.getAttribute("data-config-href");
    if (key === "EMAIL" && CONFIG_MAP.EMAIL) {
      el.setAttribute("href", "mailto:" + CONFIG_MAP.EMAIL);
    } else if (key === "PHONE" && CONFIG_MAP.PHONE) {
      el.setAttribute("href", "tel:" + CONFIG_MAP.PHONE.replace(/\s+/g, ""));
    }
  });

  // Masque tout bloc lié à une info de contact non encore configurée
  Array.prototype.forEach.call(document.querySelectorAll("[data-config-optional]"), (el) => {
    const key = el.getAttribute("data-config-optional");
    if (!CONFIG_MAP[key]) {
      el.style.display = "none";
    }
  });

  // Réseaux sociaux : construit les liens et masque ceux non configurés
  const SOCIAL_MAP = {
    facebook: typeof JIKKLO_FACEBOOK !== "undefined" ? JIKKLO_FACEBOOK : "",
    instagram: typeof JIKKLO_INSTAGRAM !== "undefined" ? JIKKLO_INSTAGRAM : "",
    tiktok: typeof JIKKLO_TIKTOK !== "undefined" ? JIKKLO_TIKTOK : "",
    linkedin: typeof JIKKLO_LINKEDIN !== "undefined" ? JIKKLO_LINKEDIN : "",
  };
  Array.prototype.forEach.call(document.querySelectorAll("[data-social]"), (el) => {
    const key = el.getAttribute("data-social");
    const url = SOCIAL_MAP[key];
    if (url) {
      el.setAttribute("href", url);
      el.removeAttribute("hidden");
    } else {
      el.setAttribute("hidden", "true");
    }
  });

  /* -------------------------------------------------------------------
     5. Année du copyright, mise à jour automatique
  ------------------------------------------------------------------- */
  Array.prototype.forEach.call(document.querySelectorAll("[data-current-year]"), (el) => {
    el.textContent = new Date().getFullYear();
  });

  /* -------------------------------------------------------------------
     6. Localisation : si JIKKLO_LOCATION n'a pas été personnalisée dans
     config.js, on affiche la version traduite (dépend de la langue active).
     Si l'utilisateur a renseigné sa propre valeur, elle est affichée telle
     quelle dans toutes les langues (on ne peut pas la traduire automatiquement).
  ------------------------------------------------------------------- */
  function applyLocation() {
    const custom = CONFIG_MAP.LOCATION;
    const text =
      custom && custom.trim() !== ""
        ? custom
        : window.JIKKLO_I18N
        ? window.JIKKLO_I18N.t("common.location")
        : "Bukavu, Democratic Republic of the Congo";
    Array.prototype.forEach.call(document.querySelectorAll('[data-config="LOCATION"]'), (el) => {
      el.textContent = text;
    });
  }
  applyLocation();
  document.addEventListener("jikklo:langchange", applyLocation);

  /* -------------------------------------------------------------------
     7. Logo personnalisé (PNG/JPG ajouté par l'utilisateur)
     Cherche assets/logo/logo.png, puis .jpg, puis .jpeg. Si aucun fichier
     n'est trouvé, le monogramme SVG dessiné à la main (déjà présent dans
     le HTML) reste affiché tel quel — aucune erreur, aucune image cassée.
  ------------------------------------------------------------------- */
  function loadCustomLogo() {
    const candidates = ["assets/logo/logo.png", "assets/logo/logo.jpg", "assets/logo/logo.jpeg"];
    let i = 0;

    function tryNext() {
      if (i >= candidates.length) return; // garde le SVG + texte par défaut
      const testImg = new Image();
      testImg.onload = () => {
        Array.prototype.forEach.call(document.querySelectorAll("[data-logo-swap]"), (el) => {
          el.innerHTML = "";
          const img = document.createElement("img");
          img.src = candidates[i];
          img.alt = "JIKKLO";
          img.className = "brand-logo-img";
          el.appendChild(img);
        });
      };
      testImg.onerror = () => {
        i += 1;
        tryNext();
      };
      testImg.src = candidates[i];
    }
    tryNext();
  }
  loadCustomLogo();

  /* -------------------------------------------------------------------
     8. Photo du fondateur (V002) — même mécanisme que le logo : essaie de
     charger assets/images/founder.jpg (puis .jpeg, .png). Si aucun fichier
     n'est trouvé, le placeholder déjà présent dans le HTML reste affiché.
  ------------------------------------------------------------------- */
  function loadFounderPhoto() {
    const targets = document.querySelectorAll("[data-founder-photo]");
    if (targets.length === 0) return;
    const candidates = ["assets/images/founder.jpg", "assets/images/founder.jpeg", "assets/images/founder.png"];
    let i = 0;

    function tryNext() {
      if (i >= candidates.length) return; // garde le placeholder par défaut
      const testImg = new Image();
      testImg.onload = () => {
        Array.prototype.forEach.call(targets, (el) => {
          el.innerHTML = "";
          el.classList.remove("founder-photo-placeholder");
          const img = document.createElement("img");
          img.src = candidates[i];
          img.alt = (typeof JIKKLO_NAME !== "undefined" ? JIKKLO_NAME : "JIKKLO") + " — Founder";
          el.appendChild(img);
        });
      };
      testImg.onerror = () => {
        i += 1;
        tryNext();
      };
      testImg.src = candidates[i];
    }
    tryNext();
  }
  loadFounderPhoto();

  /* -------------------------------------------------------------------
     9. Lien WhatsApp générique "Order via WhatsApp" sur la page d'accueil
     (section Explore JIKKLO). Envoie une prise de contact générale, pas
     liée à un produit précis — pour ça, voir energy.html / product.html /
     checkout.html qui utilisent js/whatsapp.js avec le détail de commande.
  ------------------------------------------------------------------- */
  function wireHomeWhatsApp() {
    const link = document.querySelector("[data-home-whatsapp]");
    if (!link) return;
    const number = (typeof JIKKLO_WHATSAPP !== "undefined" && JIKKLO_WHATSAPP) || "";
    if (!number) return; // reste masqué (hidden déjà posé dans le HTML)
    const greeting = window.JIKKLO_I18N ? window.JIKKLO_I18N.t("wa.greeting") : "Hello JIKKLO";
    const message = `${greeting} 👋\n\n${
      window.JIKKLO_I18N ? window.JIKKLO_I18N.t("wa.intro") : "I would like to place an order."
    }`;
    link.href = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
    link.hidden = false;
  }
  document.addEventListener("DOMContentLoaded", wireHomeWhatsApp);
  document.addEventListener("jikklo:langchange", wireHomeWhatsApp);
})();
