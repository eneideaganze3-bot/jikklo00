/* ==========================================================================
   JIKKLO — js/whatsapp.js
   --------------------------------------------------------------------------
   Module centralisé pour tout ce qui concerne les commandes WhatsApp :
   - génération d'un numéro de commande (ex: JIK-20260823-4821)
   - construction du message de commande complet, dans un format clair et
     professionnel, avec émojis
   - construction de l'URL wa.me correctement encodée

   Utilisé par js/product.js et js/energy.js pour les liens "Commander via
   WhatsApp" de PRISE DE CONTACT RAPIDE (un seul produit, pas de création de
   commande officielle). Le numéro WhatsApp destinataire est lu UNE SEULE
   FOIS, depuis js/config.js (JIKKLO_WHATSAPP) — il n'est jamais répété
   ailleurs dans le code.

   IMPORTANT (intégration JIKKLO OS) : ce module ne crée plus de commande
   officielle. Le flux d'achat officiel est panier → checkout.html →
   POST /api/orders/public/create (voir js/checkout.js), qui recalcule
   toujours le prix, le stock et le total côté serveur et renvoie le vrai
   numéro de commande (ex: JKK-2026-000001). generateOrderId() ci-dessous ne
   sert plus qu'à donner une référence lisible à un message WhatsApp de
   simple prise de contact — ce N'EST PAS un numéro de commande officiel.
   ========================================================================== */

(function () {
  "use strict";

  /**
   * Génère un identifiant de commande du type JIK-20260823-4821.
   * Le suffixe est aléatoire (4 chiffres) : suffisant pour distinguer deux
   * commandes passées la même journée dans cette V002 sans backend. Un vrai
   * système de commandes (avec base de données) pourra plus tard générer un
   * identifiant garanti unique côté serveur.
   */
  function generateOrderId() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const suffix = String(Math.floor(1000 + Math.random() * 9000));
    return `JIK-${y}${m}${d}-${suffix}`;
  }

  function fmt(amount, currency) {
    return window.formatPrice ? window.formatPrice(amount, currency) : `${amount} ${currency || ""}`;
  }

  function pick(field) {
    return window.JIKKLO_SHOP ? window.JIKKLO_SHOP.pick(field) : field.fr;
  }

  /**
   * Construit le message WhatsApp complet pour une commande (un ou
   * plusieurs articles). `items` est un tableau de { product, qty }.
   * `customer` est optionnel : { name, phone, deliveryMethod, address, comment }.
   * Si `customer` est omis, la section "Informations client" est omise
   * (utile pour la commande rapide depuis une fiche produit).
   */
  function buildOrderMessage(items, customer, orderId) {
    const t = window.JIKKLO_I18N ? window.JIKKLO_I18N.t : (k) => k;
    const lines = [];

    lines.push(`${t("wa.greeting")} 👋`);
    lines.push("");
    lines.push(t("wa.intro"));
    lines.push("");
    lines.push("━━━━━━━━━━━━━━");
    lines.push(`🧾 ${t("wa.orderDetails")}`);
    lines.push("━━━━━━━━━━━━━━");
    lines.push("");

    let total = 0;
    items.forEach((entry, index) => {
      const p = entry.product;
      const qty = entry.qty;
      const unit = pick(p.unit);
      const isQuote = p.price == null || p.subcategory === "topup";
      const lineTotal = isQuote ? null : p.price * qty;
      if (lineTotal != null) total += lineTotal;

      lines.push(`${index + 1}. ${pick(p.name)}`);
      lines.push(`   ${t("wa.quantity")}: ${qty} ${unit}`);
      if (isQuote) {
        lines.push(`   ${t("wa.unitPrice")}: ${t("shop.priceOnRequest")}`);
        lines.push(`   ${t("wa.subtotal")}: ${t("shop.priceOnRequest")}`);
      } else {
        lines.push(`   ${t("wa.unitPrice")}: ${fmt(p.price, p.currency)}`);
        lines.push(`   ${t("wa.subtotal")}: ${fmt(lineTotal, p.currency)}`);
      }
      lines.push("");
    });

    lines.push("━━━━━━━━━━━━━━");
    const hasQuote = items.some((entry) => entry.product && (entry.product.price == null || entry.product.subcategory === "topup"));
    lines.push(`💰 ${t("wa.total")}: ${hasQuote ? t("shop.priceOnRequest") : fmt(total, items[0] ? items[0].product.currency : "FC")}`);
    lines.push("━━━━━━━━━━━━━━");

    if (customer) {
      lines.push("");
      lines.push(`👤 ${t("wa.customerInfo")}`);
      lines.push("");
      lines.push(`${t("wa.name")}: ${customer.name}`);
      lines.push(`${t("wa.phone")}: ${customer.phone}`);
      lines.push("");
      lines.push(`📍 ${t("wa.deliveryMethod")}:`);
      lines.push(customer.deliveryMethod);
      if (customer.address) {
        lines.push("");
        lines.push(`${t("wa.address")}:`);
        lines.push(customer.address);
      }
      if (customer.city) {
        lines.push(`${t("wa.city")}: ${customer.city}`);
      }
      if (customer.comment) {
        lines.push("");
        lines.push(`📝 ${t("wa.comment")}:`);
        lines.push(customer.comment);
      }
    }

    lines.push("");
    if (orderId) {
      lines.push(`🆔 ${t("wa.orderNumber")}: ${orderId}`);
      lines.push("");
    }
    lines.push(t("wa.confirmRequest"));

    return lines.join("\n");
  }

  /**
   * Construit l'URL wa.me finale, correctement encodée. Retourne null si
   * aucun numéro WhatsApp n'est configuré (voir js/config.js).
   */
  function buildWhatsAppUrl(message) {
    const number = (typeof JIKKLO_WHATSAPP !== "undefined" && JIKKLO_WHATSAPP) || "";
    if (!number) return null;
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }

  window.JIKKLO_WA = { generateOrderId, buildOrderMessage, buildWhatsAppUrl };
})();
