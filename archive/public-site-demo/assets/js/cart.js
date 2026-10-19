// Panier JIKKLO.COM — stocké en localStorage, mais ne contient QUE
// { productId, quantity }. Le prix et le stock affichés sont TOUJOURS
// relus en direct depuis l'API (règle #52 : aucune donnée commerciale
// codée en dur ou mise en cache côté client comme source de vérité).
// Le serveur revalide de toute façon tout au moment du checkout.
const CART_KEY = "jikklo_cart_v2";

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}

function addToCart(productId, quantity = 1) {
  const cart = getCart();
  const existing = cart.find((i) => i.productId === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ productId, quantity });
  }
  saveCart(cart);
}

function updateCartQuantity(productId, quantity) {
  let cart = getCart();
  if (quantity <= 0) {
    cart = cart.filter((i) => i.productId !== productId);
  } else {
    const item = cart.find((i) => i.productId === productId);
    if (item) item.quantity = quantity;
  }
  saveCart(cart);
}

function removeFromCart(productId) {
  saveCart(getCart().filter((i) => i.productId !== productId));
}

function clearCart() {
  saveCart([]);
}

function cartItemCount() {
  return getCart().reduce((sum, i) => sum + i.quantity, 0);
}

function updateCartBadge() {
  document.querySelectorAll("[data-cart-badge]").forEach((el) => {
    const count = cartItemCount();
    el.textContent = count;
    el.style.display = count > 0 ? "inline-block" : "none";
  });
}

document.addEventListener("DOMContentLoaded", updateCartBadge);
