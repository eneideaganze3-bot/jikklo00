// Injecte un header et un footer identiques sur toutes les pages, pour
// éviter de dupliquer le HTML (et le risque d'incohérence) sur 15 fichiers.
function renderLayout() {
  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <div class="bar">
      <a href="/" class="brand">JIKKLO<span>.</span></a>
      <nav class="nav-links">
        <a href="/">Accueil</a>
        <a href="/about.html">À propos</a>
        <a href="/energy.html">Energy</a>
        <a href="/digital.html">Digital</a>
        <a href="/shop.html">Boutique</a>
        <a href="/contact.html">Contact</a>
      </nav>
      <div class="header-actions">
        <a href="/account.html" title="Mon compte" aria-label="Mon compte">👤</a>
        <a href="/cart.html" class="cart-link" title="Panier" aria-label="Panier">
          🛒<span data-cart-badge class="cart-badge" style="display:none">0</span>
        </a>
        <button class="menu-toggle" aria-label="Menu" onclick="document.getElementById('mobileMenu').classList.toggle('open')">☰</button>
      </div>
    </div>
    <div class="mobile-menu" id="mobileMenu">
      <a href="/">Accueil</a>
      <a href="/about.html">À propos</a>
      <a href="/energy.html">Jikklo Energy</a>
      <a href="/digital.html">Jikklo Digital</a>
      <a href="/shop.html">Boutique</a>
      <a href="/faq.html">FAQ</a>
      <a href="/contact.html">Contact</a>
      <a href="/account.html">Mon compte</a>
      <a href="/track.html">Suivre ma commande</a>
    </div>
  `;
  document.body.prepend(header);

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <h4>JIKKLO</h4>
          <p>Entreprise basée à Bukavu, Sud-Kivu, RDC — activités Energy et Digital.</p>
        </div>
        <div>
          <h4>Navigation</h4>
          <ul>
            <li><a href="/energy.html">Jikklo Energy</a></li>
            <li><a href="/digital.html">Jikklo Digital</a></li>
            <li><a href="/shop.html">Boutique</a></li>
            <li><a href="/faq.html">FAQ</a></li>
          </ul>
        </div>
        <div>
          <h4>Légal</h4>
          <ul>
            <li><a href="/privacy.html">Confidentialité</a></li>
            <li><a href="/terms.html">Conditions générales</a></li>
            <li><a href="/contact.html">Contact</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">© ${new Date().getFullYear()} JIKKLO SAS. Tous droits réservés.</div>
    </div>
  `;
  document.body.appendChild(footer);

  // Bouton WhatsApp flottant — n'apparaît que si un numéro est configuré
  // côté JIKKLO OS (règle #52 : rien de codé en dur).
  window.jikkloApi.get("/api/settings/public").then((res) => {
    if (res.settings?.whatsapp_enabled === "true" && window.JIKKLO_WHATSAPP_NUMBER) {
      const fab = document.createElement("a");
      fab.className = "whatsapp-fab";
      fab.href = `https://wa.me/${window.JIKKLO_WHATSAPP_NUMBER}`;
      fab.target = "_blank";
      fab.rel = "noopener";
      fab.innerHTML = "💬";
      fab.title = "Discuter sur WhatsApp";
      document.body.appendChild(fab);
    }
  }).catch(() => {});
}

document.addEventListener("DOMContentLoaded", renderLayout);
