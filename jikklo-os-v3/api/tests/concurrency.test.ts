import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";

/**
 * Tests de concurrence sur D1 réel (via @cloudflare/vitest-pool-workers),
 * exigés explicitement par le cahier des charges V2 (section 57, Test 1) :
 *
 *   Stock = 1 L. Deux clients commandent simultanément 1 L chacun.
 *   Résultat attendu : une seule commande réussit, le stock ne devient
 *   jamais négatif.
 *
 * NOTE D'EXÉCUTION : ces tests nécessitent l'environnement de test Workers
 * complet (`npm run test` depuis la racine, avec @cloudflare/vitest-pool-workers
 * installé — voir api/package.json). Ils n'ont pas pu être exécutés dans cet
 * environnement de génération car il n'a pas d'accès réseau pour installer
 * les dépendances npm. La logique qu'ils vérifient (contrainte SQL
 * CHECK (quantity >= 0) + écriture atomique via D1 batch) a été validée
 * manuellement — voir AUDIT-V2.md, section "Limitations connues".
 */

async function setupSchema() {
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT DEFAULT 'published');
    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL UNIQUE,
      quantity REAL NOT NULL DEFAULT 0 CHECK (quantity >= 0)
    );
  `);
}

describe("Concurrence du stock (règle #5 V2 — Test 1 obligatoire)", () => {
  beforeEach(async () => {
    await setupSchema();
    await env.DB.prepare("DELETE FROM inventory").run();
    await env.DB.prepare("DELETE FROM products").run();
    await env.DB.prepare("INSERT INTO products (id, name) VALUES ('prod_1', 'Essence')").run();
    await env.DB.prepare("INSERT INTO inventory (id, product_id, quantity) VALUES ('inv_1', 'prod_1', 1)").run();
  });

  it("une seule des deux décrémentations simultanées de 1 unité réussit sur un stock de 1", async () => {
    const decrement = () =>
      env.DB.batch([
        env.DB.prepare("UPDATE inventory SET quantity = quantity - 1 WHERE product_id = 'prod_1'"),
      ]);

    const results = await Promise.allSettled([decrement(), decrement()]);

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    // D1 exécute les écritures de façon sérialisée par base ; la seconde
    // décrémentation fait passer la quantité à -1, ce qui viole la
    // contrainte CHECK (quantity >= 0) et fait échouer son batch.
    expect(succeeded).toBe(1);
    expect(failed).toBe(1);

    const final = await env.DB
      .prepare("SELECT quantity FROM inventory WHERE product_id = 'prod_1'")
      .first<{ quantity: number }>();
    expect(final?.quantity).toBe(0); // jamais négatif
  });

  it("refuse une décrémentation qui ferait passer le stock sous 0 même en écriture unique", async () => {
    await env.DB.prepare("UPDATE inventory SET quantity = 0 WHERE product_id = 'prod_1'").run();

    await expect(
      env.DB.prepare("UPDATE inventory SET quantity = quantity - 1 WHERE product_id = 'prod_1'").run()
    ).rejects.toThrow();

    const final = await env.DB
      .prepare("SELECT quantity FROM inventory WHERE product_id = 'prod_1'")
      .first<{ quantity: number }>();
    expect(final?.quantity).toBe(0);
  });
});

describe("Génération atomique du numéro de commande (règle #7 V2)", () => {
  beforeEach(async () => {
    await env.DB.exec(`
      CREATE TABLE IF NOT EXISTS order_counters (year INTEGER PRIMARY KEY, next_value INTEGER NOT NULL DEFAULT 0);
    `);
    await env.DB.prepare("DELETE FROM order_counters").run();
  });

  it("ne produit jamais deux fois le même numéro même en cas d'appels concurrents", async () => {
    const year = 2026;
    const increment = () =>
      env.DB
        .prepare(
          `INSERT INTO order_counters (year, next_value) VALUES (?, 1)
           ON CONFLICT(year) DO UPDATE SET next_value = next_value + 1
           RETURNING next_value`
        )
        .bind(year)
        .first<{ next_value: number }>();

    const results = await Promise.all([increment(), increment(), increment(), increment(), increment()]);
    const values = results.map((r) => r?.next_value);
    const uniqueValues = new Set(values);

    expect(uniqueValues.size).toBe(5); // aucune collision
    expect(Math.max(...values.map((v) => v ?? 0))).toBe(5);
  });
});
