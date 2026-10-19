/* ==========================================================================
   JIKKLO — js/config.js
   --------------------------------------------------------------------------
   Modifiez UNIQUEMENT les valeurs ci-dessous pour mettre à jour les
   informations de l'entreprise sur tout le site (nom, contact, réseaux).
   Aucun autre fichier n'a besoin d'être touché pour ces changements.

   Laissez une valeur en chaîne vide "" si l'information n'est pas encore
   disponible : les éléments concernés (boutons, liens) seront masqués
   automatiquement par js/main.js, plutôt que d'afficher une donnée fictive.
   ========================================================================== */

const JIKKLO_NAME = "JIKKLO";
const JIKKLO_DOMAIN = "https://jikklo.com";

// Version affichée dans le footer (badge).
const JIKKLO_VERSION = "v0.03";
const JIKKLO_EMAIL = "contact@jikklo.com";

// ⚠️ NUMÉRO WHATSAPP ⚠️
// Numéro WhatsApp Business JIKKLO déjà configuré (voir CONFIGURATION-WHATSAPP.txt).
// Format international SANS le "+" (ex: "243900000000").
// Pour masquer les boutons "Commander sur WhatsApp" (fiches produits, page
// energy, checkout), remettre cette valeur à "".
const JIKKLO_WHATSAPP = "243904067863"; // WhatsApp Business JIKKLO

const JIKKLO_PHONE = ""; // ex: "+243 900 000 000"

// Laissez vide "" pour afficher automatiquement "Bukavu, RDC" traduit dans
// la langue active du site. Renseignez une valeur ici uniquement si vous
// voulez une adresse précise et identique dans toutes les langues.
const JIKKLO_LOCATION = "";

// Réseaux sociaux — laissez "" pour masquer une icône non encore active
const JIKKLO_FACEBOOK = "";
const JIKKLO_INSTAGRAM = "";
const JIKKLO_TIKTOK = "";
const JIKKLO_LINKEDIN = "";

// Devise utilisée pour l'affichage des prix (voir js/main.js: formatPrice()).
const JIKKLO_CURRENCY = "FC";

// --------------------------------------------------------------------------
// Objet de configuration groupé, utile pour les scripts e-commerce
// (js/whatsapp.js, js/checkout.js, etc.). Reflète simplement les constantes
// ci-dessus : modifiez les constantes plus haut, pas cet objet directement.
// --------------------------------------------------------------------------
const JIKKLO_CONFIG = {
  whatsappNumber: JIKKLO_WHATSAPP,
  currency: JIKKLO_CURRENCY,
  companyName: JIKKLO_NAME,
  defaultCountry: "CD",
};
