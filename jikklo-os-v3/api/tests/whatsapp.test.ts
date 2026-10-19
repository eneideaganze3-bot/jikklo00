import { describe, it, expect } from "vitest";
import { buildOrderWhatsAppMessage } from "../src/lib/whatsapp";
import { calculateOrderTotals } from "../src/lib/order";

describe("buildOrderWhatsAppMessage — règle #17 V2", () => {
  it("génère un message complet, jamais générique", () => {
    const totals = calculateOrderTotals([{ productId: "p1", productName: "Essence", unitPrice: 5500, quantity: 2 }]);
    const message = buildOrderWhatsAppMessage({
      orderNumber: "JKK-2026-000001", customerName: "Jean Dupont", customerPhone: "+243900000000",
      totals, currency: "CDF", deliveryMode: "pickup", createdAt: "2026-08-28T10:00:00Z",
    });
    expect(message).toContain("JKK-2026-000001");
    expect(message).toContain("Jean Dupont");
    expect(message).toContain("Essence");
    expect(message.length).toBeGreaterThan(50);
  });
});
