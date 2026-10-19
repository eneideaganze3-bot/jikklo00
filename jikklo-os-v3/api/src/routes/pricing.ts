import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { generateId, writeAuditLog, createNotification } from "../lib/helpers";
import { apiError } from "../lib/apiResponse";
import { validatePrice } from "../lib/validate";

export const pricingRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

pricingRoutes.use("*", requireAuth);

// GET /api/admin/pricing — liste des prix actuels de tous les produits
pricingRoutes.get("/", requirePermission("pricing.view"), async (c) => {
  const result = await c.env.DB
    .prepare(
      `SELECT p.id as product_id, p.name, p.unit, pr.sale_price, pr.purchase_price,
              pr.currency, pr.effective_date, pr.updated_at
       FROM products p
       JOIN prices pr ON pr.product_id = p.id
       ORDER BY p.name`
    )
    .all();
  return c.json({ prices: result.results ?? [] });
});

// GET /api/admin/pricing/:productId/history — historique complet
pricingRoutes.get(
  "/:productId/history",
  requirePermission("pricing.view"),
  async (c) => {
    const productId = c.req.param("productId");
    const result = await c.env.DB
      .prepare(
        `SELECT ph.*, u.full_name as changed_by_name
         FROM price_history ph
         LEFT JOIN users u ON u.id = ph.changed_by
         WHERE ph.product_id = ?
         ORDER BY ph.changed_at DESC`
      )
      .bind(productId)
      .all();
    return c.json({ history: result.results ?? [] });
  }
);

// PATCH /api/admin/pricing/:productId — change le prix (garde l'historique)
// Règle #42 : ne change QUE le prix "actuel" ; les commandes déjà passées
// conservent le prix qui était applicable au moment où elles ont été créées
// (car order_items.unit_price est une copie figée, jamais une référence).
pricingRoutes.patch(
  "/:productId",
  requirePermission("pricing.edit"),
  async (c) => {
    const user = c.get("user");
    const productId = c.req.param("productId");
    const body = await c.req.json<{
      salePrice?: number;
      purchasePrice?: number;
      reason?: string;
    }>();

    if (body.salePrice === undefined && body.purchasePrice === undefined) {
      return apiError(c, 400, "VALIDATION_ERROR", "Aucun nouveau prix fourni.");
    }
    if (body.salePrice !== undefined) {
      const check = validatePrice(body.salePrice);
      if (!check.valid) return apiError(c, 400, "VALIDATION_ERROR", `Prix de vente : ${check.error}`);
    }
    if (body.purchasePrice !== undefined) {
      const check = validatePrice(body.purchasePrice);
      if (!check.valid) return apiError(c, 400, "VALIDATION_ERROR", `Prix d'achat : ${check.error}`);
    }

    const current = await c.env.DB
      .prepare("SELECT * FROM prices WHERE product_id = ?")
      .bind(productId)
      .first<{ sale_price: number; purchase_price: number }>();

    if (!current) {
      return apiError(c, 404, "NOT_FOUND", "Aucun prix existant pour ce produit.");
    }

    const newSale = body.salePrice ?? current.sale_price;
    const newPurchase = body.purchasePrice ?? current.purchase_price;

    // 1. Enregistrer l'historique AVANT de modifier le prix courant
    await c.env.DB
      .prepare(
        `INSERT INTO price_history
           (id, product_id, old_sale_price, new_sale_price, old_purchase_price, new_purchase_price, changed_by, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        generateId("pricehist"),
        productId,
        current.sale_price,
        newSale,
        current.purchase_price,
        newPurchase,
        user.id,
        body.reason ?? null
      )
      .run();

    // 2. Mettre à jour le prix courant (celui lu par le site public)
    await c.env.DB
      .prepare(
        `UPDATE prices
         SET sale_price = ?, purchase_price = ?, effective_date = datetime('now'), updated_at = datetime('now'), updated_by = ?
         WHERE product_id = ?`
      )
      .bind(newSale, newPurchase, user.id, productId)
      .run();

    await writeAuditLog(c.env, {
      userId: user.id,
      userName: user.fullName,
      action: "price.change",
      entityType: "product",
      entityId: productId,
      details: { oldSale: current.sale_price, newSale, oldPurchase: current.purchase_price, newPurchase },
    });

    await createNotification(c.env, {
      type: "price_change",
      title: "Prix modifié",
      message: `Le prix a changé de ${current.sale_price} à ${newSale}.`,
      referenceId: productId,
    });

    return c.json({ success: true, salePrice: newSale, purchasePrice: newPurchase });
  }
);
