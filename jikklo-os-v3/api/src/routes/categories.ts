import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { generateId, writeAuditLog } from "../lib/helpers";
import { apiError } from "../lib/apiResponse";
import { validateText } from "../lib/validate";

// Admin → Catalogue → Catégories (spécification section 1). Manquait
// jusqu'ici : `categories.parent_id` existait déjà dans le schéma (les
// sous-catégories étaient donc déjà possibles structurellement), mais
// aucune route Admin ne permettait de créer/modifier une catégorie sans
// passer directement par la base — cette route comble ce manque précis.
export const categoryRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

categoryRoutes.use("*", requireAuth);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // retire les accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

categoryRoutes.get("/", requirePermission("products.view"), async (c) => {
  const result = await c.env.DB
    .prepare(
      `SELECT cat.*, parent.name as parent_name
       FROM categories cat
       LEFT JOIN categories parent ON parent.id = cat.parent_id
       ORDER BY cat.display_order, cat.name`
    )
    .all();
  return c.json({ categories: result.results ?? [] });
});

// POST /api/admin/categories — création d'une catégorie OU d'une
// sous-catégorie (si parentId est fourni). C'est cet endpoint qui rend
// possible "Admin → Catalogue → Catégories → Ajouter une catégorie" sans
// toucher au code, exactement comme demandé.
categoryRoutes.post("/", requirePermission("products.edit"), async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{
    name: string;
    parentId?: string;
    activity?: string;
    displayOrder?: number;
    slug?: string;
  }>();

  const nameCheck = validateText(body.name, { fieldName: "Nom de la catégorie", maxLength: 150 });
  if (!nameCheck.valid) return apiError(c, 400, "VALIDATION_ERROR", nameCheck.error);

  if (body.parentId) {
    const parent = await c.env.DB.prepare("SELECT id FROM categories WHERE id = ?").bind(body.parentId).first();
    if (!parent) return apiError(c, 400, "VALIDATION_ERROR", "Catégorie parente introuvable.");
  }

  const baseSlug = body.slug ? slugify(body.slug) : slugify(nameCheck.value!);
  let slug = baseSlug;
  let suffix = 1;
  while (await c.env.DB.prepare("SELECT id FROM categories WHERE slug = ?").bind(slug).first()) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  const id = generateId("cat");
  await c.env.DB
    .prepare(
      `INSERT INTO categories (id, name, slug, parent_id, activity, display_order)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, nameCheck.value, slug, body.parentId ?? null, body.activity ?? "energy", body.displayOrder ?? 0)
    .run();

  await writeAuditLog(c.env, {
    userId: user.id, userName: user.fullName, action: "category.create",
    entityType: "category", entityId: id, details: { name: body.name, parentId: body.parentId },
  });

  return c.json({ id, slug, success: true }, 201);
});

categoryRoutes.patch("/:id", requirePermission("products.edit"), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json<Record<string, unknown>>();

  const fieldMap: Record<string, string> = {
    name: "name", parentId: "parent_id", activity: "activity", displayOrder: "display_order",
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
  bindings.push(id);

  await c.env.DB.prepare(`UPDATE categories SET ${updates.join(", ")} WHERE id = ?`).bind(...bindings).run();

  await writeAuditLog(c.env, {
    userId: user.id, userName: user.fullName, action: "category.update",
    entityType: "category", entityId: id, details: body,
  });

  return c.json({ success: true });
});

// DELETE — refusé si des produits ou sous-catégories en dépendent encore,
// pour ne jamais casser silencieusement le catalogue public.
categoryRoutes.delete("/:id", requirePermission("products.edit"), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const childProduct = await c.env.DB.prepare("SELECT id FROM products WHERE category_id = ? LIMIT 1").bind(id).first();
  if (childProduct) return apiError(c, 409, "CONFLICT", "Des produits utilisent encore cette catégorie.");
  const childCategory = await c.env.DB.prepare("SELECT id FROM categories WHERE parent_id = ? LIMIT 1").bind(id).first();
  if (childCategory) return apiError(c, 409, "CONFLICT", "Des sous-catégories existent encore sous cette catégorie.");

  await c.env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
  await writeAuditLog(c.env, {
    userId: user.id, userName: user.fullName, action: "category.delete",
    entityType: "category", entityId: id,
  });
  return c.json({ success: true });
});
