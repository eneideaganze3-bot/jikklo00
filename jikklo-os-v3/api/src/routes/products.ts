import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { generateId, writeAuditLog } from "../lib/helpers";
import { apiError } from "../lib/apiResponse";
import { parsePagination, validatePrice, validateText } from "../lib/validate";

export const productRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

productRoutes.use("*", requireAuth);

// GET /api/admin/products — liste avec prix et stock joints
productRoutes.get("/", requirePermission("products.view"), async (c) => {
  const status = c.req.query("status");
  const activity = c.req.query("activity");

  let query = `
    SELECT p.*, pr.sale_price, pr.purchase_price, pr.currency,
           inv.quantity as stock_quantity, inv.min_threshold,
           cat.name as category_name
    FROM products p
    LEFT JOIN prices pr ON pr.product_id = p.id
    LEFT JOIN inventory inv ON inv.product_id = p.id
    LEFT JOIN categories cat ON cat.id = p.category_id
    WHERE 1=1
  `;
  const bindings: string[] = [];
  if (status) {
    query += " AND p.status = ?";
    bindings.push(status);
  }
  if (activity) {
    query += " AND p.activity = ?";
    bindings.push(activity);
  }
  const { limit, offset } = parsePagination(c.req.query());
  query += " ORDER BY p.created_at DESC LIMIT ? OFFSET ?";
  const allBindings: (string | number)[] = [...bindings, limit, offset];

  const result = await c.env.DB.prepare(query).bind(...allBindings).all();
  return c.json({ products: result.results ?? [], pagination: { limit, offset } });
});

// GET /api/admin/products/:id
productRoutes.get("/:id", requirePermission("products.view"), async (c) => {
  const id = c.req.param("id");
  const product = await c.env.DB
    .prepare(
      `SELECT p.*, pr.sale_price, pr.purchase_price, inv.quantity as stock_quantity
       FROM products p
       LEFT JOIN prices pr ON pr.product_id = p.id
       LEFT JOIN inventory inv ON inv.product_id = p.id
       WHERE p.id = ?`
    )
    .bind(id)
    .first();

  if (!product) return apiError(c, 404, "NOT_FOUND", "Produit introuvable.");

  const images = await c.env.DB
    .prepare("SELECT * FROM product_images WHERE product_id = ? ORDER BY display_order")
    .bind(id)
    .all();

  return c.json({ product, images: images.results ?? [] });
});

// POST /api/admin/products — création
productRoutes.post("/", requirePermission("products.edit"), async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{
    name: string;
    nameEn?: string;
    categoryId?: string;
    activity?: string;
    offerType?: string;
    description?: string;
    descriptionEn?: string;
    detailsFr?: string;
    detailsEn?: string;
    characteristicsFr?: string[];
    characteristicsEn?: string[];
    subcategory?: string;
    brand?: string;
    unit?: string;
    sku?: string;
    salePrice: number;
    purchasePrice?: number;
    initialStock?: number;
    minThreshold?: number;
    trackStock?: boolean;
  }>();

  const nameCheck = validateText(body.name, { fieldName: "Nom du produit", maxLength: 200 });
  const priceCheck = validatePrice(body.salePrice);
  if (!nameCheck.valid) return apiError(c, 400, "VALIDATION_ERROR", nameCheck.error);
  if (body.salePrice === undefined) return apiError(c, 400, "VALIDATION_ERROR", "Prix de vente requis.");
  if (!priceCheck.valid) return apiError(c, 400, "VALIDATION_ERROR", priceCheck.error);
  if (body.purchasePrice !== undefined) {
    const purchaseCheck = validatePrice(body.purchasePrice);
    if (!purchaseCheck.valid) return apiError(c, 400, "VALIDATION_ERROR", purchaseCheck.error);
  }

  const ALLOWED_OFFER_TYPES = new Set(["product", "service", "topup", "package", "subscription", "other"]);
  if (body.offerType && !ALLOWED_OFFER_TYPES.has(body.offerType)) {
    return apiError(c, 400, "VALIDATION_ERROR", "Type d'offre invalide (product|service|topup|package|subscription|other).");
  }

  // Le stock est optionnel selon le type d'offre (spécification section 8) :
  // un service, une recharge ou un abonnement n'ont pas de stock physique.
  // `track_stock` est une colonne EXPLICITE sur `products` (migration 0007)
  // — c'est elle, et uniquement elle, qui pilote la vérification/
  // décrémentation de stock dans routes/orders.ts. Par défaut, seuls
  // "product" et "package" suivent un stock ; `trackStock` permet à
  // l'Admin de forcer le comportement dans les deux sens.
  const stockByDefaultTypes = new Set(["product", "package"]);
  const shouldTrackStock = body.trackStock ?? stockByDefaultTypes.has(body.offerType ?? "product");

  const productId = generateId("prod");
  const now = new Date().toISOString();

  await c.env.DB
    .prepare(
      `INSERT INTO products
        (id, sku, name, name_en, category_id, activity, offer_type, track_stock, description, description_en,
         details_fr, details_en, characteristics_fr, characteristics_en, subcategory,
         brand, unit, status, created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`
    )
    .bind(
      productId,
      body.sku ?? null,
      nameCheck.value,
      body.nameEn ?? null,
      body.categoryId ?? null,
      body.activity ?? "energy",
      body.offerType ?? "product",
      shouldTrackStock ? 1 : 0,
      body.description ?? null,
      body.descriptionEn ?? null,
      body.detailsFr ?? null,
      body.detailsEn ?? null,
      body.characteristicsFr ? JSON.stringify(body.characteristicsFr) : null,
      body.characteristicsEn ? JSON.stringify(body.characteristicsEn) : null,
      body.subcategory ?? null,
      body.brand ?? null,
      body.unit ?? "unit",
      now,
      now,
      user.id,
      user.id
    )
    .run();

  await c.env.DB
    .prepare(
      `INSERT INTO prices (id, product_id, purchase_price, sale_price, updated_by)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(
      generateId("price"),
      productId,
      body.purchasePrice ?? 0,
      body.salePrice,
      user.id
    )
    .run();

  if (shouldTrackStock) {
    await c.env.DB
      .prepare(
        `INSERT INTO inventory (id, product_id, quantity, min_threshold)
         VALUES (?, ?, ?, ?)`
      )
      .bind(
        generateId("inv"),
        productId,
        body.initialStock ?? 0,
        body.minThreshold ?? 5
      )
      .run();
  }

  await writeAuditLog(c.env, {
    userId: user.id,
    userName: user.fullName,
    action: "product.create",
    entityType: "product",
    entityId: productId,
    details: { name: body.name },
  });

  return c.json({ id: productId, success: true }, 201);
});

// PATCH /api/admin/products/:id — modification (hors prix, voir routes/pricing.ts)
productRoutes.patch("/:id", requirePermission("products.edit"), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json<Record<string, unknown>>();

  const allowedFields = [
    "name", "name_en", "category_id", "activity", "offer_type", "track_stock", "description", "description_en",
    "details_fr", "details_en", "subcategory", "brand",
    "unit", "sku", "packaging", "status", "featured",
  ];
  // Champs stockés en JSON stringifié (règle #52 : normalisation à un seul
  // endroit) — le client envoie un tableau, on le sérialise ici.
  const jsonFields = ["characteristics_fr", "characteristics_en"];
  if ("track_stock" in body && typeof body.track_stock !== "boolean" && body.track_stock !== 0 && body.track_stock !== 1) {
    return apiError(c, 400, "VALIDATION_ERROR", "track_stock doit être un booléen.");
  }
  const updates: string[] = [];
  const bindings: unknown[] = [];

  for (const field of allowedFields) {
    if (field in body) {
      updates.push(`${field} = ?`);
      bindings.push(field === "track_stock" ? (body[field] === true || body[field] === 1 ? 1 : 0) : body[field]);
    }
  }
  for (const field of jsonFields) {
    if (field in body) {
      updates.push(`${field} = ?`);
      bindings.push(Array.isArray(body[field]) ? JSON.stringify(body[field]) : null);
    }
  }
  if (updates.length === 0) {
    return apiError(c, 400, "BAD_REQUEST", "Aucun champ valide à modifier.");
  }

  updates.push("updated_at = ?", "updated_by = ?");
  bindings.push(new Date().toISOString(), user.id, id);

  await c.env.DB
    .prepare(`UPDATE products SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...bindings)
    .run();

  // Si l'Admin active le suivi de stock sur une offre qui n'en avait pas
  // (ex: un service requalifié en produit physique), on crée la ligne
  // inventory manquante à la volée plutôt que de laisser track_stock=1
  // pointer vers rien — ce qui redéclencherait exactement le bug corrigé
  // par la migration 0007 (INVENTORY_NOT_CONFIGURED à la commande).
  if ("track_stock" in body && (body.track_stock === true || body.track_stock === 1)) {
    const existingInventory = await c.env.DB.prepare("SELECT id FROM inventory WHERE product_id = ?").bind(id).first();
    if (!existingInventory) {
      await c.env.DB
        .prepare(`INSERT INTO inventory (id, product_id, quantity, min_threshold) VALUES (?, ?, 0, 5)`)
        .bind(generateId("inv"), id)
        .run();
    }
  }

  await writeAuditLog(c.env, {
    userId: user.id,
    userName: user.fullName,
    action: "product.update",
    entityType: "product",
    entityId: id,
    details: body,
  });

  return c.json({ success: true });
});

// DELETE /api/admin/products/:id — archivage (pas de suppression physique)
productRoutes.delete("/:id", requirePermission("products.edit"), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  await c.env.DB
    .prepare("UPDATE products SET status = 'archived', updated_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), id)
    .run();

  await writeAuditLog(c.env, {
    userId: user.id,
    userName: user.fullName,
    action: "product.archive",
    entityType: "product",
    entityId: id,
  });

  return c.json({ success: true });
});
