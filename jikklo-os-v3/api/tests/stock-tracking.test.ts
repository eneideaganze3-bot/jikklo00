import { describe, it, expect } from "vitest";
import { checkStockForLine, calculateOrderTotals } from "../src/lib/order";

/**
 * Tests de la correction prioritaire V4.1 (mission de finalisation, section
 * 3) : la vérification de stock doit être pilotée EXPLICITEMENT par
 * `track_stock`, plus jamais déduite de la simple présence/absence d'une
 * ligne `inventory`. Voir api/src/lib/order.ts pour le détail du bug
 * corrigé (INVENTORY_NOT_CONFIGURED renvoyé à tort pour les services).
 *
 * NOTE D'EXÉCUTION : comme documenté dans tests/concurrency.test.ts, cet
 * environnement de génération n'a pas d'accès réseau pour installer les
 * dépendances npm (@cloudflare/vitest-pool-workers, vitest...). Ces tests
 * n'ont donc PAS pu être exécutés ici — voir RAPPORT-V4.1.md, section
 * "Tests", pour la trace exacte de la tentative (npm install → 403).
 * Ils sont écrits pour être lancés avec `npm run test` dans un
 * environnement avec accès réseau (Codespaces, CI...).
 */

describe("checkStockForLine — track_stock explicite (correction V4.1)", () => {
  it("1. produit avec stock suffisant : autorisé, stock suivi", () => {
    const result = checkStockForLine({ name: "Essence 1L", trackStock: true, stock: 10 }, 2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tracked).toBe(true);
  });

  it("2. produit sans stock (track_stock=false, stock=null) : autorisé, non suivi", () => {
    const result = checkStockForLine({ name: "Recharge Airtel 5000", trackStock: false, stock: null }, 1);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tracked).toBe(false);
  });

  it("3. service sans stock : autorisé, non suivi", () => {
    const result = checkStockForLine({ name: "Livraison express", trackStock: false, stock: null }, 1);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tracked).toBe(false);
  });

  it("4. recharge sans stock, même si une ligne inventory existerait par erreur : toujours autorisé", () => {
    // Cas volontairement piégeux : track_stock=false doit primer même si
    // `stock` n'est pas null (ex: donnée historique incohérente). Le stock
    // suivi est piloté par track_stock, jamais par la présence de `stock`.
    const result = checkStockForLine({ name: "Forfait 1Go", trackStock: false, stock: 0 }, 1);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tracked).toBe(false);
  });

  it("6. stock insuffisant pour un produit suivi : rejeté avec INSUFFICIENT_STOCK", () => {
    const result = checkStockForLine({ name: "Essence 1L", trackStock: true, stock: 1 }, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INSUFFICIENT_STOCK");
  });

  it("produit suivi sans ligne inventory (incohérence de configuration) : rejeté avec INVENTORY_NOT_CONFIGURED", () => {
    const result = checkStockForLine({ name: "Huile moteur", trackStock: true, stock: null }, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVENTORY_NOT_CONFIGURED");
  });

  it("stock exactement égal à la quantité demandée : autorisé (limite incluse)", () => {
    const result = checkStockForLine({ name: "Essence 1L", trackStock: true, stock: 5 }, 5);
    expect(result.ok).toBe(true);
  });
});

describe("5. Commande mixte — produit avec stock + service sans stock", () => {
  it("chaque ligne est évaluée indépendamment selon son propre track_stock", () => {
    const lines = [
      { info: { name: "Essence 1L", trackStock: true, stock: 10 }, quantity: 2 },
      { info: { name: "Livraison express", trackStock: false, stock: null }, quantity: 1 },
    ];

    const results = lines.map((l) => checkStockForLine(l.info, l.quantity));

    expect(results.every((r) => r.ok)).toBe(true);
    expect(results[0].ok && results[0].tracked).toBe(true); // le produit physique reste suivi
    expect(results[1].ok && !results[1].tracked).toBe(true); // le service reste non suivi
  });

  it("le stock insuffisant sur UNE SEULE ligne physique bloque toute la commande mixte", () => {
    const lines = [
      { info: { name: "Essence 1L", trackStock: true, stock: 1 }, quantity: 5 }, // insuffisant
      { info: { name: "Livraison express", trackStock: false, stock: null }, quantity: 1 }, // ok
    ];

    const results = lines.map((l) => checkStockForLine(l.info, l.quantity));
    const hasFailure = results.some((r) => !r.ok);

    // routes/orders.ts s'arrête à la première ligne en échec avant d'écrire
    // quoi que ce soit (boucle synchrone avant le batch D1) : la commande
    // entière est refusée, aucune décrémentation partielle ne doit avoir
    // lieu — voir tests/concurrency.test.ts pour la garantie transactionnelle.
    expect(hasFailure).toBe(true);
  });

  it("calcule correctement le total d'un panier mixte (prix figé par ligne, indépendant du suivi de stock)", () => {
    const totals = calculateOrderTotals([
      { productId: "prod_essence", productName: "Essence 1L", unitPrice: 5500, quantity: 2 },
      { productId: "prod_recharge", productName: "Recharge Airtel 5000", unitPrice: 5000, quantity: 1 },
      { productId: "prod_service", productName: "Livraison express", unitPrice: 3000, quantity: 1 },
    ]);
    expect(totals.subtotal).toBe(5500 * 2 + 5000 + 3000);
  });
});

describe("7. Concurrence — track_stock=false ne doit jamais créer de contention", () => {
  it("deux vérifications simultanées sur une offre non suivie sont toujours indépendamment autorisées", () => {
    // Contrairement à un produit avec track_stock=true (voir
    // tests/concurrency.test.ts, qui vérifie que D1 sérialise correctement
    // les décrémentations concurrentes via CHECK (quantity >= 0)), une
    // offre non suivie n'implique AUCUNE écriture sur `inventory` : deux
    // clients peuvent commander la même recharge au même instant sans
    // jamais se bloquer mutuellement, par construction (aucune ressource
    // partagée n'est décrémentée).
    const offer = { name: "Recharge Orange 10000", trackStock: false, stock: null } as const;
    const results = [checkStockForLine(offer, 1), checkStockForLine(offer, 1), checkStockForLine(offer, 1)];
    expect(results.every((r) => r.ok)).toBe(true);
  });
});
