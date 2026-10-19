/* ==========================================================================
   JIKKLO — js/publications.js
   Affiche la section "Nouveautés Jikklo" sur la page d'accueil à partir de
   GET /api/public/publications. Une publication créée et publiée dans
   Admin apparaît ici automatiquement, sans modification de ce fichier.
   ========================================================================== */
(function () {
  "use strict";

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function renderPublications() {
    const section = document.querySelector("[data-publications-section]");
    const list = document.querySelector("[data-publications-list]");
    if (!section || !list || !window.JIKKLO_API) return;

    window.JIKKLO_API.getPublications(6)
      .then(function (publications) {
        if (!publications || publications.length === 0) {
          section.hidden = true;
          return;
        }
        section.hidden = false;
        list.innerHTML = publications
          .map(function (pub) {
            const image = pub.imageUrl
              ? '<img src="' + escapeHtml(pub.imageUrl) + '" alt="" style="width:100%;height:180px;object-fit:cover;border-radius:var(--radius-md);margin-bottom:16px;" />'
              : "";
            const price =
              pub.priceOverride != null && window.formatPrice
                ? '<p style="margin-top:8px;font-weight:700;color:var(--turquoise);">' + window.formatPrice(pub.priceOverride) + "</p>"
                : "";
            const cta = pub.cta
              ? '<a href="' + escapeHtml(pub.cta.url || "#") + '" style="display:inline-flex;align-items:center;gap:8px;margin-top:16px;font-weight:600;color:var(--turquoise);">' +
                escapeHtml(pub.cta.label) +
                "</a>"
              : "";
            return (
              '<div class="card reveal">' +
              image +
              '<h3 style="font-size:1.1rem;">' + escapeHtml(pub.title) + "</h3>" +
              (pub.body ? '<p style="margin-top:10px;color:var(--text-secondary);font-size:0.92rem;">' + escapeHtml(pub.body) + "</p>" : "") +
              price +
              cta +
              "</div>"
            );
          })
          .join("");
      })
      .catch(function () {
        // Une erreur réseau ne doit jamais casser la page d'accueil : la
        // section reste simplement masquée.
        section.hidden = true;
      });
  }

  document.addEventListener("DOMContentLoaded", renderPublications);
})();
