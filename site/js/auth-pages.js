/* ==========================================================================
   JIKKLO — js/auth-pages.js
   Logique des pages login.html et register.html. Le compte reste facultatif
   pour commander (voir js/checkout.js) — ceci ne sert qu'aux clients qui
   veulent suivre leurs commandes dans le temps.
   ========================================================================== */
(function () {
  "use strict";

  function showError(el, message) {
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
  }

  function wireLogin() {
    const form = document.getElementById("login-form");
    if (!form || !window.JIKKLO_API) return;
    const errorEl = form.querySelector("[data-login-error]");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      errorEl.hidden = true;
      const phone = form.querySelector("#login-phone").value.trim();
      const password = form.querySelector("#login-password").value;

      window.JIKKLO_API.customer
        .login({ phone: phone, password: password })
        .then(function () {
          window.location.href = "account.html";
        })
        .catch(function (err) {
          showError(errorEl, (err && err.message) || "Téléphone ou mot de passe incorrect.");
        });
    });
  }

  function wireRegister() {
    const form = document.getElementById("register-form");
    if (!form || !window.JIKKLO_API) return;
    const errorEl = form.querySelector("[data-register-error]");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      errorEl.hidden = true;
      const payload = {
        fullName: form.querySelector("#reg-name").value.trim(),
        phone: form.querySelector("#reg-phone").value.trim(),
        email: form.querySelector("#reg-email").value.trim() || undefined,
        password: form.querySelector("#reg-password").value,
      };

      window.JIKKLO_API.customer
        .register(payload)
        .then(function () {
          window.location.href = "account.html";
        })
        .catch(function (err) {
          showError(errorEl, (err && err.message) || "Impossible de créer le compte.");
        });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    wireLogin();
    wireRegister();
  });
})();
