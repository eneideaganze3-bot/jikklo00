import { describe, it, expect } from "vitest";
import { calculateOrderTotals, isValidStatusTransition } from "../src/lib/order";
import { computeDeliveryFee } from "../src/lib/delivery";

describe("calculateOrderTotals", () => {
  it("calcule correctement une ligne simple", () => {
    const r = calculateOrderTotals([{ productId: "p1", productName: "Essence", unitPrice: 5500, quantity: 2 }]);
    expect(r.subtotal).toBe(11000);
    expect(r.total).toBe(11000);
  });

  it("le prix unitaire fourni n'est jamais recalculé (prix figé au moment de la commande — règle #8/#42)", () => {
    const r = calculateOrderTotals([{ productId: "p1", productName: "Essence", unitPrice: 5500, quantity: 1 }]);
    expect(r.items[0].unitPrice).toBe(5500);
  });

  it("gère les quantités décimales (litres)", () => {
    const r = calculateOrderTotals([{ productId: "p1", productName: "Essence", unitPrice: 5500, quantity: 1.5 }]);
    expect(r.subtotal).toBe(8250);
  });
});

describe("computeDeliveryFee — règle #15 V2 (plus de deliveryFee=0 codé en dur)", () => {
  it("retourne 0 pour un retrait sur place quel que soit le paramétrage", () => {
    const fee = computeDeliveryFee("pickup", 50000, { delivery_mode: "fixed", delivery_fixed_fee: "3000" });
    expect(fee).toBe(0);
  });

  it("applique les frais fixes configurés pour une livraison", () => {
    const fee = computeDeliveryFee("delivery", 10000, { delivery_mode: "fixed", delivery_fixed_fee: "3000", delivery_free_above: "0" });
    expect(fee).toBe(3000);
  });

  it("offre la livraison gratuite au-dessus du seuil configuré", () => {
    const fee = computeDeliveryFee("delivery", 60000, { delivery_mode: "fixed", delivery_fixed_fee: "3000", delivery_free_above: "50000" });
    expect(fee).toBe(0);
  });

  it("mode 'free' : toujours gratuit", () => {
    const fee = computeDeliveryFee("delivery", 1000, { delivery_mode: "free" });
    expect(fee).toBe(0);
  });
});

describe("isValidStatusTransition", () => {
  it("refuse de sauter des étapes", () => {
    expect(isValidStatusTransition("new", "delivered")).toBe(false);
  });
  it("autorise le cycle normal", () => {
    expect(isValidStatusTransition("new", "confirmed")).toBe(true);
    expect(isValidStatusTransition("delivered", "completed")).toBe(true);
  });
});
