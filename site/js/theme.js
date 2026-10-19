/* ==========================================================================
   JIKKLO — js/theme.js
   Bascule de thème à 3 états, mémorisée par visiteur (localStorage) :
     - "dark"  : thème sombre JIKKLO d'origine
     - "light" : thème clair
     - "auto"  ("Miroir") : suit le réglage clair/sombre de l'appareil,
       comme le mode Automatique d'Apple — le site "reflète" le système.
   Le choix par défaut (première visite) est "dark" pour ne rien changer
   au rendu existant tant que le visiteur n'a pas choisi autre chose.
   ========================================================================== */
(function () {
  "use strict";

  var STORAGE_KEY = "jikklo_theme";
  var THEMES = ["dark", "light", "auto"];
  var LABELS = { dark: "Sombre", light: "Clair", auto: "Miroir" };
  var ICONS = {
    dark: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>',
    light: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M4.4 4.4l1.7 1.7M17.9 17.9l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.4 19.6l1.7-1.7M17.9 6.1l1.7-1.7"/></svg>',
    auto: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18 6.5 6.5 0 0 1 0-18Z"/></svg>',
  };

  function getStoredTheme() {
    try {
      var v = window.localStorage.getItem(STORAGE_KEY);
      return THEMES.indexOf(v) !== -1 ? v : "dark";
    } catch (e) {
      return "dark";
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      var isLightNow =
        theme === "light" ||
        (theme === "auto" &&
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: light)").matches);
      meta.setAttribute("content", isLightNow ? "#F5F8FA" : "#071A2B");
    }
  }

  // Appliqué immédiatement (ce fichier est aussi chargé tôt côté <head>
  // via un script inline équivalent, voir chaque page HTML) pour éviter
  // un flash de thème incorrect au chargement.
  var current = getStoredTheme();
  applyTheme(current);

  function setTheme(theme) {
    current = theme;
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      /* stockage indisponible (navigation privée) : le choix ne sera pas mémorisé */
    }
    applyTheme(theme);
    updateButtons();
  }
  window.jikkloSetTheme = setTheme;
  window.jikkloGetTheme = function () {
    return current;
  };

  function buildButton() {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-toggle";
    btn.setAttribute("aria-label", "Changer de thème");
    btn.setAttribute("title", "Thème : " + LABELS[current]);
    btn.innerHTML = ICONS[current] + '<span class="theme-toggle-label">' + LABELS[current] + "</span>";
    btn.addEventListener("click", function () {
      var idx = THEMES.indexOf(current);
      var next = THEMES[(idx + 1) % THEMES.length];
      setTheme(next);
    });
    return btn;
  }

  var buttons = [];

  function updateButtons() {
    buttons.forEach(function (btn) {
      btn.innerHTML = ICONS[current] + '<span class="theme-toggle-label">' + LABELS[current] + "</span>";
      btn.setAttribute("title", "Thème : " + LABELS[current]);
    });
  }

  function injectToggle() {
    // Emplacement desktop : juste avant le sélecteur de langue.
    var langDropdown = document.querySelector(".navbar-inner .lang-dropdown");
    if (langDropdown && langDropdown.parentNode) {
      var desktopBtn = buildButton();
      langDropdown.parentNode.insertBefore(desktopBtn, langDropdown);
      buttons.push(desktopBtn);
    }

    // Emplacement mobile : dans le panneau du menu mobile, à côté des langues.
    var mobileLangRow = document.querySelector(".mobile-menu .lang-row-mobile");
    if (mobileLangRow) {
      var mobileWrap = document.createElement("div");
      mobileWrap.className = "theme-row-mobile";
      var mobileBtn = buildButton();
      mobileWrap.appendChild(mobileBtn);
      mobileLangRow.parentNode.insertBefore(mobileWrap, mobileLangRow);
      buttons.push(mobileBtn);
    }

    // Si l'utilisateur change le réglage système en cours de visite pendant
    // qu'il est en mode "Miroir", on adapte la couleur de la barre d'adresse.
    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", function () {
        if (current === "auto") applyTheme("auto");
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectToggle);
  } else {
    injectToggle();
  }
})();
