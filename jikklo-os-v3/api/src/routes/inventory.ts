import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { generateId, writeAuditLog, createNotification } from "../lib/helpers";
import { apiError } from "../lib/apiResponse";

export const inventoryRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

inventoryRoutes.use("*", requireAuth);

// GET /api/admin/inventory — état du stock de tous les produits
inventoryRoutes.get("/", requirePermission("inventory.view"), async (c) => {
  const result = await c.env.DB
    .prepare(
      `SELECT p.id as product_id, p.name, p.unit, inv.quantity, inv.min_threshold,
              CASE WHEN inv.quantity <= 0 THEN 'out_of_stock'
                   WHEN inv.quantity <= inv.min_threshold THEN 'low_stock'
                   ELSE 'ok' END as stock_status
       FROM products p
       JOIN inventory inv ON inv.product_id = p.id
       WHERE p.status != 'archived'
       ORDER BY stock_status DESC, p.name`
    )
    .all();
  return c.json({ inventory: result.results ?? [] });
});

// GET /api/admin/inventory/:productId/movements — historique des mouvements
inventoryRoutes.get(
  "/:productId/movements",
  requirePermission("inventory.view"),
  async (c) => {
    const productId = c.req.param("productId");
    const result = await c.env.DB
      .prepare(
        `SELECT im.*, u.full_name as created_by_name
         FROM inventory_movements im
         LEFT JOIN users u ON u.id = im.created_by
         WHERE im.product_id = ?
         ORDER BY im.created_at DESC
         LIMIT 100`
      )
      .bind(productId)
      .all();
    return c.json({ movements: result.results ?? [] });
  }
);

// POST /api/admin/inventory/movement — enregistre un mouvement de stock
// (règle #28 : chaque mouvement est tracé). Corrigé en V2 : la mise à jour
// du stock est atomique (UPDATE ... WHERE ..., protégé par la contrainte
// CHECK (quantity >= 0)) plutôt qu'un lire-puis-écrire, qui était sujet
// à une condition de course en cas de mouvements simultanés.
inventoryRoutes.post(
  "/movement",
  requirePermission("inventory.edit"),
  async (c) => {
    const user = c.get("user");
    const body = await c.req.json<{
      productId: string;
      type: "entree" | "vente" | "correction" | "perte" | "retour" | "transfert";
      quantity: number; // positif = entrée, négatif = sortie
      reason?: string;
      reference?: string;
    }>();

    if (!body.productId || body.quantity === undefined || !body.type) {
      return apiError(c, 400, "VALIDATION_ERROR", "productId, type et quantity sont requis.");
    }
    const qtyNum = Number(body.quantity);
    if (!Number.isFinite(qtyNum) || qtyNum === 0) {
      return apiError(c, 400, "VALIDATION_ERROR", "Quantité de mouvement invalide.");
    }

    const thresholdRow = await c.env.DB
      .prepare("SELECT min_threshold FROM inventory WHERE product_id = ?")
      .bind(body.productId)
      .first<{ min_threshold: number }>();
    if (!thresholdRow) {
      return apiError(c, 404, "BAD_REQUEST", "Aucune fiche de stock pour ce produit.");
    }

    const movementId = generateId("mvt");

    try {
      await c.env.DB.batch([
        // Échoue (et annule tout) si ça ferait passer le stock sous 0 —
        // protection anti-concurrence via la contrainte CHECK.
        c.env.DB
          .prepare(
            `UPDATE inventory SET quantity = quantity + ?, updated_at = datetime('now') WHERE product_id = ?`
          )
          .bind(qtyNum, body.productId),
        c.env.DB
          .prepare(
            `INSERT INTO inventory_movements (id, product_id, type, quantity, resulting_stock, reason, reference, created_by)
             VALUES (?, ?, ?, ?, (SELECT quantity FROM inventory WHERE product_id = ?), ?, ?, ?)`
          )
          .bind(movementId, body.productId, body.type, qtyNum, body.productId, body.reason ?? null, body.reference ?? null, user.id),
      ]);
    } catch (err) {
      return apiError(c, 409, "INSUFFICIENT_STOCK", "Stock insuffisant pour ce mouvement.");
    }

    const updated = await c.env.DB
      .prepare("SELECT quantity FROM inventory WHERE product_id = ?")
      .bind(body.productId)
      .first<{ quantity: number }>();
    const newQuantity = updated?.quantity ?? 0;

    // Alertes automatiques (règle #29)
    if (newQuantity <= 0) {
      await createNotification(c.env, {
        type: "out_of_stock",
        title: "Rupture de stock",
        message: `Le produit est en rupture de stock.`,
        referenceId: body.productId,
      });
    } else if (newQuantity <= thresholdRow.min_threshold) {
      await createNotification(c.env, {
        type: "low_stock",
        title: "Stock faible",
        message: `Le stock est passé sous le seuil minimum (${thresholdRow.min_threshold}).`,
        referenceId: body.productId,
      });
    }

    await writeAuditLog(c.env, {
      userId: user.id,
      userName: user.fullName,
      action: "inventory.movement",
      entityType: "product",
      entityId: body.productId,
      details: { type: body.type, quantity: qtyNum, resultingStock: newQuantity },
    });

    return c.json({ success: true, newQuantity });
  }
);
