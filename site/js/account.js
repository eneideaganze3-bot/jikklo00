/* ==========================================================================
   JIKKLO — js/account.js
   Logique de account.html : profil + historique de commandes du client
   connecté. Redirige silencieusement vers l'état "invité" si aucune session
   client valide n'existe (cookie jikklo_customer_session absent/expiré) —
   ne jamais deviner ou mettre en cache l'identité du client côté JS.
   ========================================================================== */
(function () {
  "use strict";

  const STATUS_LABELS = {
    new: "Nouvelle", confirmed: "Confirmée", preparing: "En préparation",
    ready: "Prête", delivering: "En livraison", delivered: "Livrée",
    completed: "Terminée", cancelled: "Annulée",
  };
  const PAYMENT_STATUS_LABELS = {
    pending: "Paiement en attente", confirmed: "Paiement confirmé",
    failed: "Paiement échoué", cancelled: "Paiement annulé",
  };

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function renderOrders(orders) {
    const list = document.querySelector("[data-orders-list]");
    const empty = document.querySelector("[data-orders-empty]");
    if (!list) return;
    if (!orders || orders.length === 0) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    list.innerHTML = orders
      .map(function (o) {
        const paymentLine = o.payment_method_name
          ? '<p style="font-size:0.85rem;color:var(--text-secondary);">' +
            escapeHtml(o.payment_method_name) + " — " + (PAYMENT_STATUS_LABELS[o.payment_status] || o.payment_status) +
            "</p>"
          : "";
        return (
          '<div class="card" style="padding:16px;">' +
          '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">' +
          "<strong>" + escapeHtml(o.order_number) + "</strong>" +
          '<span style="color:var(--turquoise);font-weight:600;">' + Number(o.total).toLocaleString() + " " + escapeHtml(o.currency) + "</span>" +
          "</div>" +
          '<p style="font-size:0.85rem;color:var(--text-secondary);margin-top:6px;">' +
          (STATUS_LABELS[o.status] || o.status) + " · " + new Date(o.created_at).toLocaleDateString("fr-FR") +
          "</p>" +
          paymentLine +
          "</div>"
        );
      })
      .join("");
  }

  function renderProfile(customer) {
    const nameEl = document.querySelector("[data-account-name]");
    const phoneEl = document.querySelector("[data-account-phone]");
    const emailEl = document.querySelector("[data-account-email]");
    if (nameEl) nameEl.textContent = customer.full_name || "";
    if (phoneEl) phoneEl.textContent = customer.phone ? "Téléphone : " + customer.phone : "";
    if (emailEl) emailEl.textContent = customer.email ? "Email : " + customer.email : "";
  }

  function showGuestState() {
    const loading = document.querySelector("[data-account-loading]");
    const content = document.querySelector("[data-account-content]");
    const guest = document.querySelector("[data-account-guest]");
    if (loading) loading.hidden = true;
    if (content) content.hidden = true;
    if (guest) guest.hidden = false;
  }

  function showLoggedInState() {
    const loading = document.querySelector("[data-account-loading]");
    const content = document.querySelector("[data-account-content]");
    if (loading) loading.hidden = true;
    if (content) content.hidden = false;
  }

  function init() {
    if (!window.JIKKLO_API) {
      showGuestState();
      return;
    }

    window.JIKKLO_API.customer
      .me()
      .then(function (customer) {
        if (!customer) {
          showGuestState();
          return;
        }
        showLoggedInState();
        renderProfile(customer);
        return window.JIKKLO_API.customer.orders().then(renderOrders);
      })
      .catch(function () {
        // 401/session expirée : jamais afficher de profil, redonner l'état invité.
        showGuestState();
      });

    const logoutBtn = document.querySelector("[data-logout-btn]");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        window.JIKKLO_API.customer.logout().finally(function () {
          window.location.href = "login.html";
        });
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
