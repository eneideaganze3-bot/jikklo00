import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { generateId, writeAuditLog } from "../lib/helpers";
import { apiError } from "../lib/apiResponse";

export const supplierRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
supplierRoutes.use("*", requireAuth);

supplierRoutes.get("/", requirePermission("suppliers.view"), async (c) => {
  const result = await c.env.DB.prepare("SELECT * FROM suppliers ORDER BY name").all();
  return c.json({ suppliers: result.results ?? [] });
});

supplierRoutes.post("/", requirePermission("suppliers.edit"), async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{ name: string; contactName?: string; phone?: string; email?: string; notes?: string }>();
  if (!body.name?.trim()) return apiError(c, 400, "VALIDATION_ERROR", "Le nom du fournisseur est requis.");

  const id = generateId("supplier");
  await c.env.DB
    .prepare("INSERT INTO suppliers (id, name, contact_name, phone, email, notes) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, body.name.trim(), body.contactName ?? null, body.phone ?? null, body.email ?? null, body.notes ?? null)
    .run();

  await writeAuditLog(c.env, {
    userId: user.id, userName: user.fullName, action: "supplier.create",
    entityType: "supplier", entityId: id, details: { name: body.name },
  });

  return c.json({ id, success: true }, 201);
});

supplierRoutes.patch("/:id", requirePermission("suppliers.edit"), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json<Record<string, string>>();
  const allowed = ["name", "contact_name", "phone", "email", "notes"];
  const updates: string[] = [];
  const bindings: string[] = [];
  for (const field of allowed) {
    if (field in body) { updates.push(`${field} = ?`); bindings.push(body[field]); }
  }
  if (updates.length === 0) return apiError(c, 400, "BAD_REQUEST", "Aucun champ valide.");
  bindings.push(id);
  await c.env.DB.prepare(`UPDATE suppliers SET ${updates.join(", ")} WHERE id = ?`).bind(...bindings).run();

  await writeAuditLog(c.env, {
    userId: user.id, userName: user.fullName, action: "supplier.update",
    entityType: "supplier", entityId: id,
  });

  return c.json({ success: true });
});
