export type OrderLineInput = {
  productId: string;
  productName: string;
  unitPrice: number; // prix AU MOMENT de la commande (figé, jamais recalculé après coup)
  quantity: number;
};

export type OrderTotals = {
  items: (OrderLineInput & { lineTotal: number })[];
  subtotal: number;
  deliveryFee: number;
  total: number;
};

// ---------------------------------------------------------------------
// Vérification de stock — correction V4.1 (section 3 de la mission de
// finalisation).
//
// PROBLÈME CORRIGÉ : avant cette correction, routes/orders.ts déduisait
// "stock suivi ou non" depuis la simple présence/absence d'une ligne
// `inventory`. Depuis la migration 0006, un produit peut légitimement
// n'avoir aucune ligne inventory (service, recharge, forfait...), mais le
// code traitait encore cette absence comme une incohérence de données et
// REJETAIT la commande. Résultat : un service ou une recharge créés via
// l'extensibilité V4 ne pouvaient jamais être commandés.
//
// CORRECTION : la décision repose désormais UNIQUEMENT sur la colonne
// explicite `products.track_stock` (migration 0007) :
//   track_stock = 1 → une ligne inventory DOIT exister et être suffisante.
//   track_stock = 0 → aucune vérification de stock n'est exigée, qu'une
//                      ligne inventory existe ou non.
// Extrait en fonction pure (sans dépendance à D1/Hono) pour être testée
// unitairement — voir tests/stock-tracking.test.ts.
// ---------------------------------------------------------------------
export type ProductStockInfo = {
  name: string;
  trackStock: boolean;
  stock: number | null; // quantité en inventory, ou null si aucune ligne
};

export type StockCheckResult =
  | { ok: true; tracked: boolean }
  | { ok: false; code: "INVENTORY_NOT_CONFIGURED" | "INSUFFICIENT_STOCK"; message: string };

export function checkStockForLine(product: ProductStockInfo, quantity: number): StockCheckResult {
  if (!product.trackStock) {
    // Service, recharge, forfait, abonnement... : jamais de vérification
    // de stock, jamais bloquant, que `stock` soit null ou non.
    return { ok: true, tracked: false };
  }

  // À partir d'ici, track_stock = true : le produit DOIT avoir une ligne
  // inventory. Son absence est ici une vraie incohérence de configuration.
  if (product.stock === null) {
    return {
      ok: false,
      code: "INVENTORY_NOT_CONFIGURED",
      message: `Le stock du produit ${product.name} n'est pas configuré.`,
    };
  }
  if (product.stock < quantity) {
    return {
      ok: false,
      code: "INSUFFICIENT_STOCK",
      message: `Stock insuffisant pour ${product.name}.`,
    };
  }
  return { ok: true, tracked: true };
}

/**
 * Calcule les totaux d'une commande à partir des lignes et des frais de livraison.
 * Centralisé ici pour être testé une seule fois et réutilisé partout
 * (évite les écarts entre panier client, checkout, et JIKKLO OS).
 */
export function calculateOrderTotals(
  items: OrderLineInput[],
  deliveryFee = 0
): OrderTotals {
  const computedItems = items.map((item) => ({
    ...item,
    lineTotal: Math.round(item.unitPrice * item.quantity * 100) / 100,
  }));
  const subtotal = computedItems.reduce((sum, i) => sum + i.lineTotal, 0);
  const total = Math.round((subtotal + deliveryFee) * 100) / 100;

  return { items: computedItems, subtotal, deliveryFee, total };
}

export const ORDER_STATUSES = [
  "new",
  "confirmed",
  "preparing",
  "ready",
  "delivering",
  "delivered",
  "completed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["delivering", "delivered", "cancelled"],
  delivering: ["delivered", "cancelled"],
  delivered: ["completed"],
  completed: [],
  cancelled: [],
};

export function isValidStatusTransition(
  from: OrderStatus,
  to: OrderStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
