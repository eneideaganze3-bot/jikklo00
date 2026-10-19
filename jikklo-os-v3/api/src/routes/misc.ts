import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { writeAuditLog } from "../lib/helpers";
import { apiError } from "../lib/apiResponse";
import { validateText, validateEmail, validatePhone, parsePagination } from "../lib/validate";

// ---------------------------------------------------------------------
// NOTIFICATIONS (règle #37)
// ---------------------------------------------------------------------
export const notificationRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
notificationRoutes.use("*", requireAuth);

notificationRoutes.get("/", async (c) => {
  const unreadOnly = c.req.query("unread") === "true";
  const { limit, offset } = parsePagination(c.req.query());
  let query = "SELECT * FROM notifications";
  if (unreadOnly) query += " WHERE read = 0";
  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  const result = await c.env.DB.prepare(query).bind(limit, offset).all();
  return c.json({ notifications: result.results ?? [], pagination: { limit, offset } });
});

notificationRoutes.patch("/:id/read", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("UPDATE notifications SET read = 1 WHERE id = ?").bind(id).run();
  return c.json({ success: true });
});

// ---------------------------------------------------------------------
// AUDIT LOGS (règle #38)
// ---------------------------------------------------------------------
export const auditLogRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
auditLogRoutes.use("*", requireAuth);

auditLogRoutes.get("/", requirePermission("audit.view"), async (c) => {
  const { limit, offset } = parsePagination(c.req.query());
  const result = await c.env.DB
    .prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?")
    .bind(limit, offset)
    .all();
  return c.json({ logs: result.results ?? [], pagination: { limit, offset } });
});

// ---------------------------------------------------------------------
// SETTINGS (règle #78)
// ---------------------------------------------------------------------
export const settingsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Lecture publique de certains réglages non sensibles (devise, nom entreprise…)
// utilisée par jikklo.com pour rester synchronisé avec JIKKLO OS.
settingsRoutes.get("/public", async (c) => {
  const PUBLIC_KEYS = ["company_name", "currency", "whatsapp_enabled", "delivery_enabled"];
  const placeholders = PUBLIC_KEYS.map(() => "?").join(",");
  const result = await c.env.DB
    .prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`)
    .bind(...PUBLIC_KEYS)
    .all<{ key: string; value: string }>();
  const settings = Object.fromEntries((result.results ?? []).map((r) => [r.key, r.value]));
  return c.json({ settings });
});

settingsRoutes.use("/admin/*", requireAuth);

settingsRoutes.get("/admin", requirePermission("settings.manage"), async (c) => {
  const result = await c.env.DB.prepare("SELECT * FROM settings").all();
  return c.json({ settings: result.results ?? [] });
});

settingsRoutes.patch("/admin/:key", requirePermission("settings.manage"), async (c) => {
  const user = c.get("user");
  const key = c.req.param("key");
  const body = await c.req.json<{ value: string }>();

  await c.env.DB
    .prepare("UPDATE settings SET value = ?, updated_at = datetime('now'), updated_by = ? WHERE key = ?")
    .bind(body.value, user.id, key)
    .run();

  await writeAuditLog(c.env, {
    userId: user.id,
    userName: user.fullName,
    action: "settings.update",
    entityType: "settings",
    entityId: key,
    details: { newValue: body.value },
  });

  return c.json({ success: true });
});

// ---------------------------------------------------------------------
// CATALOGUE PUBLIC (consommé par jikklo.com — règle #46 : source de vérité unique)
// ---------------------------------------------------------------------
// NORMALISATION (règle #52 du brief d'intégration jikklo.com) : le vrai
// frontend jikklo.com attend des produits bilingues (fr/en) en camelCase
// (ex: salePrice, stockQuantity), alors que les colonnes D1 sont en
// snake_case et pour la plupart mono-langue. `toPublicProduct()` est le
// SEUL endroit qui fait cette traduction, pour ne pas avoir à adapter le
// frontend produit par produit. Voir migration 0005 pour les colonnes
// bilingues ajoutées (name_en, description_en, details_fr/en,
// characteristics_fr/en, subcategory).
// ---------------------------------------------------------------------
export const publicCatalogRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

type PublicProductRow = {
  id: string;
  sku: string | null;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  details_fr: string | null;
  details_en: string | null;
  characteristics_fr: string | null;
  characteristics_en: string | null;
  subcategory: string | null;
  unit: string;
  brand: string | null;
  activity: string;
  offer_type: string;
  track_stock: number;
  featured: number;
  sale_price: number;
  currency: string;
  stock_quantity: number | null;
  min_threshold: number | null;
  category_name: string | null;
  category_slug: string | null;
  price_updated_at: string | null;
  image_url: string | null;
};

function parseCharacteristics(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Dérive un statut de stock lisible (règle #10 : le frontend affiche,
 *  mais ne décide jamais — cette dérivation reste côté serveur). */
function stockStatus(quantity: number | null, minThreshold: number | null): "in-stock" | "low-stock" | "out-of-stock" {
  if (quantity === null) return "in-stock"; // pas de suivi de stock activé pour ce produit
  if (quantity <= 0) return "out-of-stock";
  if (minThreshold !== null && quantity <= minThreshold) return "low-stock";
  return "in-stock";
}

function toPublicProduct(row: PublicProductRow) {
  return {
    id: row.id,
    sku: row.sku,
    activity: row.activity,
    offerType: row.offer_type,
    trackStock: !!row.track_stock,
    subcategory: row.subcategory,
    category: row.category_name ? { name: row.category_name, slug: row.category_slug } : null,
    name: { fr: row.name, en: row.name_en || row.name },
    description: { fr: row.description || "", en: row.description_en || row.description || "" },
    details: {
      fr: row.details_fr || row.description || "",
      en: row.details_en || row.description_en || row.description || "",
    },
    characteristics: {
      fr: parseCharacteristics(row.characteristics_fr),
      en: parseCharacteristics(row.characteristics_en),
    },
    unit: row.unit,
    brand: row.brand,
    featured: !!row.featured,
    salePrice: row.sale_price,
    currency: row.currency,
    stockQuantity: row.stock_quantity,
    stockStatus: stockStatus(row.stock_quantity, row.min_threshold),
    image: row.image_url || null,
    lastUpdated: row.price_updated_at,
  };
}

const PUBLIC_PRODUCT_COLUMNS = `
  p.id, p.sku, p.name, p.name_en, p.description, p.description_en,
  p.details_fr, p.details_en, p.characteristics_fr, p.characteristics_en,
  p.subcategory, p.unit, p.brand, p.activity, p.offer_type, p.track_stock, p.featured,
  pr.sale_price, pr.currency, pr.updated_at as price_updated_at,
  inv.quantity as stock_quantity, inv.min_threshold,
  cat.name as category_name, cat.slug as category_slug,
  pi.url as image_url
`;
const PUBLIC_PRODUCT_JOINS = `
  FROM products p
  JOIN prices pr ON pr.product_id = p.id
  LEFT JOIN inventory inv ON inv.product_id = p.id
  LEFT JOIN categories cat ON cat.id = p.category_id
  LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
`;

publicCatalogRoutes.get("/products", async (c) => {
  const activity = c.req.query("activity");
  const categorySlug = c.req.query("category");

  let query = `SELECT ${PUBLIC_PRODUCT_COLUMNS} ${PUBLIC_PRODUCT_JOINS} WHERE p.status = 'published'`;
  const bindings: string[] = [];
  if (activity) { query += " AND p.activity = ?"; bindings.push(activity); }
  if (categorySlug) { query += " AND cat.slug = ?"; bindings.push(categorySlug); }
  query += " ORDER BY p.featured DESC, p.name";

  const result = await c.env.DB.prepare(query).bind(...bindings).all<PublicProductRow>();
  return c.json({ products: (result.results ?? []).map(toPublicProduct) });
});

publicCatalogRoutes.get("/products/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB
    .prepare(`SELECT ${PUBLIC_PRODUCT_COLUMNS} ${PUBLIC_PRODUCT_JOINS} WHERE p.id = ? AND p.status = 'published'`)
    .bind(id)
    .first<PublicProductRow>();
  if (!row) return apiError(c, 404, "NOT_FOUND", "Produit introuvable.");
  const images = await c.env.DB
    .prepare("SELECT url, is_primary FROM product_images WHERE product_id = ? ORDER BY display_order")
    .bind(id).all<{ url: string; is_primary: number }>();
  return c.json({
    product: toPublicProduct(row),
    images: (images.results ?? []).map((img) => ({ url: img.url, isPrimary: !!img.is_primary })),
  });
});

publicCatalogRoutes.get("/categories", async (c) => {
  const result = await c.env.DB
    .prepare("SELECT id, name, slug, parent_id, activity, display_order FROM categories ORDER BY display_order")
    .all();
  return c.json({ categories: result.results ?? [] });
});

// GET /api/public/payment-methods — UNIQUEMENT les moyens activés depuis
// Admin → Paramètres → Paiements. Aucune donnée sensible n'est exposée ici :
// `config` (numéro/IBAN) n'est PAS renvoyé au public — seules les
// instructions de paiement, déjà écrites pour être lues par le client, le
// sont. Activer/désactiver un moyen dans Admin se reflète immédiatement ici,
// sans redéploiement (règle #5 de la spécification).
publicCatalogRoutes.get("/payment-methods", async (c) => {
  const result = await c.env.DB
    .prepare(
      `SELECT id, code, name, logo_url, kind, currency, instructions, config
       FROM payment_methods WHERE enabled = 1 ORDER BY display_order, name`
    )
    .all();

  // Never expose an API method unless its integration has explicitly been
  // marked ready. This also protects against legacy/manual DB edits.
  const paymentMethods = (result.results ?? []).filter((r: any) => {
    if (r.kind !== "api") return true;
    try {
      const config = r.config ? JSON.parse(r.config) : {};
      return config && typeof config === "object" && config.integrationReady === true;
    } catch {
      return false;
    }
  }).map((r: any) => ({
    id: r.id, code: r.code, name: r.name, logoUrl: r.logo_url,
    kind: r.kind, currency: r.currency, instructions: r.instructions,
  }));

  return c.json({ paymentMethods });
});

// GET /api/public/publications — section "Nouveautés Jikklo". Une
// publication créée dans Admin apparaît ici dès qu'elle passe à
// status='published', sans redéploiement.
publicCatalogRoutes.get("/publications", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 12) || 12, 50);
  const result = await c.env.DB
    .prepare(
      `SELECT pub.id, pub.title, pub.body, pub.image_url, pub.cta_label, pub.cta_url,
              pub.price_override, pub.published_at,
              p.id as product_id, p.name as product_name,
              cat.id as category_id, cat.name as category_name, cat.slug as category_slug
       FROM publications pub
       LEFT JOIN products p ON p.id = pub.product_id
       LEFT JOIN categories cat ON cat.id = pub.category_id
       WHERE pub.status = 'published'
       ORDER BY pub.display_order, pub.published_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<any>();

  const publications = (result.results ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    imageUrl: r.image_url,
    cta: r.cta_label ? { label: r.cta_label, url: r.cta_url } : null,
    priceOverride: r.price_override,
    publishedAt: r.published_at,
    product: r.product_id ? { id: r.product_id, name: r.product_name } : null,
    category: r.category_id ? { id: r.category_id, name: r.category_name, slug: r.category_slug } : null,
  }));

  return c.json({ publications });
});

// POST /api/public/contact — formulaire de contact (règle #51 V2 : réellement
// connecté au backend, pas un simple mailto). Crée une notification interne
// vue dans JIKKLO OS ; n'envoie pas d'email pour rester dans le socle gratuit
// (à activer plus tard via un service d'email si besoin).
publicCatalogRoutes.post("/contact", async (c) => {
  const body = await c.req.json<{ name: string; email?: string; phone?: string; message: string }>();

  const nameCheck = validateText(body.name, { fieldName: "Nom", maxLength: 200 });
  const messageCheck = validateText(body.message, { fieldName: "Message", maxLength: 4000 });
  const emailCheck = validateEmail(body.email, false);
  const phoneCheck = body.phone ? validatePhone(body.phone) : { valid: true as const, value: null };

  if (!nameCheck.valid) return apiError(c, 400, "VALIDATION_ERROR", nameCheck.error);
  if (!messageCheck.valid) return apiError(c, 400, "VALIDATION_ERROR", messageCheck.error);
  if (!emailCheck.valid) return apiError(c, 400, "VALIDATION_ERROR", emailCheck.error);
  if (!phoneCheck.valid) return apiError(c, 400, "VALIDATION_ERROR", phoneCheck.error);

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare(
      `INSERT INTO notifications (id, type, title, message, reference_id)
       VALUES (?, 'contact_message', ?, ?, ?)`
    )
    .bind(
      `notif_${id}`,
      `Message de contact — ${nameCheck.value}`,
      `${messageCheck.value}\n\nContact : ${emailCheck.value ?? "—"} / ${phoneCheck.value ?? "—"}`,
      null
    )
    .run();

  return c.json({ success: true });
});
