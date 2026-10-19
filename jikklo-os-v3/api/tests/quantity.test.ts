import { describe, it, expect } from "vitest";
import { validateQuantity } from "../src/lib/helpers";

describe("validateQuantity — règle #6 V2", () => {
  it("refuse zéro", () => {
    const r = validateQuantity(0, true);
    expect(r.valid).toBe(false);
  });

  it("refuse les valeurs négatives", () => {
    const r = validateQuantity(-1, true);
    expect(r.valid).toBe(false);
  });

  it("refuse NaN", () => {
    const r = validateQuantity(NaN, true);
    expect(r.valid).toBe(false);
  });

  it("refuse Infinity", () => {
    const r = validateQuantity(Infinity, true);
    expect(r.valid).toBe(false);
  });

  it("refuse les quantités absurdement grandes", () => {
    const r = validateQuantity(10_000_000, true);
    expect(r.valid).toBe(false);
  });

  it("accepte les décimales pour un produit vendu au litre", () => {
    const r = validateQuantity(1.5, true);
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.quantity).toBe(1.5);
  });

  it("refuse les décimales pour un produit vendu à l'unité", () => {
    const r = validateQuantity(1.5, false);
    expect(r.valid).toBe(false);
  });

  it("accepte un entier positif normal pour un produit à l'unité", () => {
    const r = validateQuantity(3, false);
    expect(r.valid).toBe(true);
  });

  it("refuse une chaîne non numérique", () => {
    const r = validateQuantity("abc", true);
    expect(r.valid).toBe(false);
  });
});
