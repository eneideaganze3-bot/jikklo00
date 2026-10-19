import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { generateId, writeAuditLog } from "../lib/helpers";
import { apiError } from "../lib/apiResponse";
import { validateText, parsePagination } from "../lib/validate";

// Admin → Publications — section "Nouveautés Jikklo" (spécification section
// 6). Une publication passée à status='published' apparaît automatiquement
// sur le site public (voir routes/misc.ts, GET /api/public/publications),
// sans déploiement de code.
export const publicationRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

publicationRoutes.use("*", requireAuth);
publicationRoutes.use("*", requirePermission("publications.manage"));

publicationRoutes.get("/", async (c) => {
  const status = c.req.query("status");
  const { limit, offset } = parsePagination(c.req.query());
  let query = "SELECT * FROM publications WHERE 1=1";
  const bindings: (string | number)[] = [];
  if (status) {
    query += " AND status = ?";
    bindings.push(status);
  }
  query += " ORDER BY display_order, created_at DESC LIMIT ? OFFSET ?";
  bindings.push(limit, offset);
  const result = await c.env.DB.prepare(query).bind(...bindings).all();
  return c.json({ publications: result.results ?? [], pagination: { limit, offset } });
});

publicationRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT * FROM publications WHERE id = ?").bind(id).first();
  if (!row) return apiError(c, 404, "NOT_FOUND", "Publication introuvable.");
  return c.json({ publication: row });
});

publicationRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{
    title: string;
    body?: string;
    imageUrl?: string;
    productId?: string;
    categoryId?: string;
    ctaLabel?: string;
    ctaUrl?: string;
    priceOverride?: number;
    displayOrder?: number;
  }>();

  const titleCheck = validateText(body.title, { fieldName: "Titre", maxLength: 200 });
  if (!titleCheck.valid) return apiError(c, 400, "VALIDATION_ERROR", titleCheck.error);

  const id = generateId("pub");
  await c.env.DB
    .prepare(
      `INSERT INTO publications
        (id, title, body, image_url, product_id, category_id, cta_label, cta_url, price_override, display_order, status, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`
    )
    .bind(
      id, titleCheck.value, body.body ?? null, body.imageUrl ?? null,
      body.productId ?? null, body.categoryId ?? null,
      body.ctaLabel ?? null, body.ctaUrl ?? null, body.priceOverride ?? null,
      body.displayOrder ?? 0, user.id, user.id
    )
    .run();

  await writeAuditLog(c.env, {
    userId: user.id, userName: user.fullName, action: "publication.create",
    entityType: "publication", entityId: id, details: { title: body.title },
  });

  return c.json({ id, success: true }, 201);
});

publicationRoutes.patch("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json<Record<string, unknown>>();

  const fieldMap: Record<string, string> = {
    title: "title", body: "body", imageUrl: "image_url", productId: "product_id",
    categoryId: "category_id", ctaLabel: "cta_label", ctaUrl: "cta_url",
    priceOverride: "price_override", displayOrder: "display_order", status: "status",
  };

  const updates: string[] = [];
  const bindings: unknown[] = [];
  for (const [bodyKey, column] of Object.entries(fieldMap)) {
    if (bodyKey in body) {
      updates.push(`${column} = ?`);
      bindings.push(body[bodyKey]);
    }
  }
  if (updates.length === 0) return apiError(c, 400, "BAD_REQUEST", "Aucun champ valide à modifier.");

  // Passage à "published" horodate published_at une seule fois (première
  // publication), pour un tri/affichage cohérent côté site public.
  if (body.status === "published") {
    updates.push("published_at = COALESCE(published_at, datetime('now'))");
  }

  updates.push("updated_at = datetime('now')", "updated_by = ?");
  bindings.push(user.id, id);

  await c.env.DB.prepare(`UPDATE publications SET ${updates.join(", ")} WHERE id = ?`).bind(...bindings).run();

  await writeAuditLog(c.env, {
    userId: user.id, userName: user.fullName, action: "publication.update",
    entityType: "publication", entityId: id, details: body,
  });

  return c.json({ success: true });
});

publicationRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM publications WHERE id = ?").bind(id).run();
  await writeAuditLog(c.env, {
    userId: user.id, userName: user.fullName, action: "publication.delete",
    entityType: "publication", entityId: id,
  });
  return c.json({ success: true });
});
