/* ==========================================================================
   JIKKLO — js/animations.js
   Révélation au scroll (IntersectionObserver) + animation d'entrée du logo.
   Respecte prefers-reduced-motion : si activé, tout apparaît directement,
   sans animation.

   IMPORTANT (V002) : certaines pages injectent du contenu APRÈS le
   chargement initial (cartes produits sur shop.html/index.html, lignes du
   panier sur cart.html, etc. — voir js/shop.js, js/cart.js). Le système de
   révélation doit donc pouvoir observer de nouveaux éléments à tout moment,
   pas seulement ceux présents au chargement de la page. C'est le rôle de
   window.JIKKLO_ANIM.observeReveal(), appelée par ces scripts après avoir
   injecté leur contenu.
   ========================================================================== */

(function () {
  "use strict";

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const REVEAL_SELECTOR = ".reveal, .reveal-left, .reveal-scale";
  let observer = null;

  if (!prefersReducedMotion && "IntersectionObserver" in window) {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
  }

  /**
   * Observe tous les éléments .reveal (etc.) présents dans `scope` qui ne
   * sont pas déjà observés. À appeler une première fois au chargement, puis
   * à nouveau par tout script qui injecte dynamiquement du contenu animé
   * (ex: js/shop.js après avoir rendu une grille de produits).
   */
  function observeReveal(scope) {
    const root = scope || document;
    const targets = root.querySelectorAll
      ? root.querySelectorAll(REVEAL_SELECTOR)
      : [];

    if (!observer) {
      // Mouvement réduit demandé, ou IntersectionObserver indisponible :
      // tout est visible immédiatement, sans animation.
      Array.prototype.forEach.call(targets, (el) => el.classList.add("in-view"));
      return;
    }

    Array.prototype.forEach.call(targets, (el) => {
      if (el.dataset.revealWired) return;
      el.dataset.revealWired = "1";
      observer.observe(el);
    });
  }

  window.JIKKLO_ANIM = { observeReveal };

  document.addEventListener("DOMContentLoaded", () => {
    observeReveal(document);
  });

  /* -------------------------------------------------------------------
     2. Animation d'entrée du logo (apparition + léger mouvement +
     dessin progressif du tracé SVG), une seule fois au chargement.
     Sur mobile, l'animation de dessin est désactivée (plus légère).
  ------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    const logoMark = document.querySelector(".navbar-brand .logo-draw");
    if (logoMark && !prefersReducedMotion) {
      const isMobile = window.matchMedia("(max-width: 640px)").matches;
      if (!isMobile) {
        requestAnimationFrame(() => {
          logoMark.closest(".navbar-brand").classList.add("logo-animate-in");
        });
      }
    }

    /* -----------------------------------------------------------------
       3. Léger parallaxe sur le visuel du hero (desktop uniquement,
       très subtil, désactivé si mouvement réduit demandé)
    ----------------------------------------------------------------- */
    const heroVisual = document.querySelector("[data-parallax]");
    if (heroVisual && !prefersReducedMotion && window.innerWidth >= 1024) {
      window.addEventListener(
        "scroll",
        () => {
          const offset = Math.min(window.scrollY * 0.06, 40);
          heroVisual.style.transform = `translateY(${offset}px)`;
        },
        { passive: true }
      );
    }
  });
})();
