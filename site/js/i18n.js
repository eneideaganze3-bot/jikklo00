/* ==========================================================================
   JIKKLO — js/i18n.js
   --------------------------------------------------------------------------
   Moteur de traduction du site. Fonctionne avec js/translations.js
   (variable globale I18N) chargé juste avant ce fichier.

   Ce que fait ce fichier :
   1. Détermine la langue active (choix sauvegardé > langue du navigateur
      si supportée > français par défaut).
   2. Applique les traductions à tous les éléments marqués avec :
        data-i18n="cle"            -> remplace le texte de l'élément
        data-i18n-html="cle"       -> remplace le HTML interne (pour les
                                       textes contenant un <br> ou un <span>)
        data-i18n-placeholder="cle"-> remplace l'attribut placeholder
        data-i18n-aria="cle"       -> remplace aria-label
        data-i18n-title="cle"      -> remplace le contenu de <title>
        data-i18n-content="cle"    -> remplace l'attribut content (meta)
   3. Met à jour l'attribut lang de <html>.
   4. Branche les boutons du sélecteur de langue (data-lang="xx").

   Aucune dépendance, aucun fetch : tout fonctionne même en ouvrant les
   fichiers HTML directement depuis le disque (file://).
   ========================================================================== */

(function () {
  "use strict";

  const SUPPORTED_LANGS = ["fr", "en", "sw", "ln", "es", "pt"];
  const DEFAULT_LANG = "fr";
  const STORAGE_KEY = "jikklo_lang";

  const LANG_NAMES = {
    fr: "Français",
    en: "English",
    sw: "Kiswahili",
    ln: "Lingála",
    es: "Español",
    pt: "Português",
  };

  /* --- Détection de la langue active --- */
  function detectInitialLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
    } catch (e) {
      /* localStorage indisponible (mode privé strict, etc.) — on continue */
    }

    // Repli sur la langue du navigateur si elle correspond à une langue supportée
    const nav = (navigator.language || "").slice(0, 2).toLowerCase();
    if (SUPPORTED_LANGS.includes(nav)) return nav;

    return DEFAULT_LANG;
  }

  let currentLang = detectInitialLang();

  /* --- Recherche d'une clé, avec repli sur le français puis sur la clé elle-même --- */
  function t(key) {
    const dict = window.I18N && window.I18N[currentLang];
    if (dict && Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];

    const fallbackDict = window.I18N && window.I18N[DEFAULT_LANG];
    if (fallbackDict && Object.prototype.hasOwnProperty.call(fallbackDict, key)) {
      return fallbackDict[key];
    }
    return key; // dernier recours : affiche la clé plutôt que de casser la page
  }

  /* --- Applique les traductions à tout le document --- */
  function applyTranslations() {
    document.documentElement.setAttribute("lang", currentLang);

    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n]"), (el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n-html]"), (el) => {
      el.innerHTML = t(el.getAttribute("data-i18n-html"));
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n-placeholder]"), (el) => {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n-aria]"), (el) => {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n-title]"), (el) => {
      el.textContent = t(el.getAttribute("data-i18n-title"));
      if (el.tagName === "TITLE") document.title = el.textContent;
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n-content]"), (el) => {
      el.setAttribute("content", t(el.getAttribute("data-i18n-content")));
    });

    updateSwitcherUI();
  }

  /* --- Coche/active visuellement la langue en cours dans les sélecteurs --- */
  function updateSwitcherUI() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-lang]"), (btn) => {
      const isActive = btn.getAttribute("data-lang") === currentLang;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-current", isActive ? "true" : "false");
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-lang-label]"), (el) => {
      el.textContent = currentLang.toUpperCase();
    });
  }

  /* --- Change la langue active, sauvegarde, ré-applique --- */
  function setLang(lang) {
    if (!SUPPORTED_LANGS.includes(lang)) return;
    currentLang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      /* pas grave si le stockage échoue : la langue reste active pour la session */
    }
    applyTranslations();
    document.dispatchEvent(new CustomEvent("jikklo:langchange", { detail: { lang } }));
    // Ferme tout menu de langue ouvert après sélection
    Array.prototype.forEach.call(document.querySelectorAll(".lang-dropdown.is-open"), (d) => d.classList.remove("is-open"));
  }

  /* --- Branche les clics sur les boutons de langue + le bouton d'ouverture --- */
  function wireLangSwitcher() {
    document.addEventListener("click", (e) => {
      const langBtn = e.target.closest("[data-lang]");
      if (langBtn) {
        e.preventDefault();
        setLang(langBtn.getAttribute("data-lang"));
        return;
      }

      const toggle = e.target.closest("[data-lang-toggle]");
      if (toggle) {
        e.preventDefault();
        const dropdown = toggle.closest(".lang-dropdown");
        if (dropdown) dropdown.classList.toggle("is-open");
        return;
      }

      // Clic en dehors : ferme les menus de langue ouverts
      if (!e.target.closest(".lang-dropdown")) {
        Array.prototype.forEach.call(document.querySelectorAll(".lang-dropdown.is-open"), (d) => d.classList.remove("is-open"));
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        Array.prototype.forEach.call(document.querySelectorAll(".lang-dropdown.is-open"), (d) => d.classList.remove("is-open"));
      }
    });
  }

  // Expose une API minimale utilisée par main.js / contact.js / shop.js si besoin
  window.JIKKLO_I18N = {
    t,
    setLang,
    getLang: () => currentLang,
    langNames: LANG_NAMES,
    supportedLangs: SUPPORTED_LANGS,
    // Permet à du contenu injecté dynamiquement (ex: cartes produits générées
    // par js/shop.js) de se faire traduire sans attendre un changement de langue.
    applyNow: applyTranslations,
  };

  document.addEventListener("DOMContentLoaded", () => {
    wireLangSwitcher();
    applyTranslations();
  });
})();
