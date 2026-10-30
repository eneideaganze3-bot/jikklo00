import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { generateId, writeAuditLog } from "../lib/helpers";
import { apiError } from "../lib/apiResponse";

export const digitalRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
digitalRoutes.use("*", requireAuth);

// GET /api/admin/digital/services
digitalRoutes.get("/services", requirePermission("digital.view"), async (c) => {
  const result = await c.env.DB.prepare("SELECT * FROM digital_services ORDER BY created_at DESC").all();
  return c.json({ services: result.results ?? [] });
});

// POST /api/admin/digital/services — créer un service (désactivé par défaut,
// règle #27/#93 : aucune activation automatique de fonctionnalité réglementée)
digitalRoutes.post("/services", requirePermission("digital.edit"), async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{ name: string; description?: string; price?: number }>();
  if (!body.name) return apiError(c, 400, "VALIDATION_ERROR", "Le nom du service est requis.");

  const id = generateId("dsvc");
  await c.env.DB
    .prepare(
      `INSERT INTO digital_services (id, name, description, price, enabled) VALUES (?, ?, ?, ?, 0)`
    )
    .bind(id, body.name, body.description ?? null, body.price ?? null)
    .run();

  await writeAuditLog(c.env, {
    userId: user.id, userName: user.fullName, action: "digital.service.create",
    entityType: "digital_service", entityId: id, details: { name: body.name },
  });

  return c.json({ id, success: true, note: "Service créé désactivé — l'activer explicitement une fois la conformité légale validée." }, 201);
});

// PATCH /api/admin/digital/services/:id/enabled — activer/désactiver
digitalRoutes.patch("/services/:id/enabled", requirePermission("digital.edit"), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json<{ enabled: boolean }>();

  await c.env.DB
    .prepare("UPDATE digital_services SET enabled = ? WHERE id = ?")
    .bind(body.enabled ? 1 : 0, id)
    .run();

  await writeAuditLog(c.env, {
    userId: user.id, userName: user.fullName, action: "digital.service.toggle",
    entityType: "digital_service", entityId: id, details: { enabled: body.enabled },
  });

  return c.json({ success: true });
});

// PATCH /api/admin/digital/services/:id — modifier nom, description, prix.
// Seuls les champs envoyés sont modifiés ; price: null = « prix sur demande ».
digitalRoutes.patch("/services/:id", requirePermission("digital.edit"), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json<{ name?: string; description?: string | null; price?: number | null }>();

  const existing = await c.env.DB.prepare("SELECT id FROM digital_services WHERE id = ?").bind(id).first();
  if (!existing) return apiError(c, 404, "NOT_FOUND", "Service introuvable.");

  const updates: string[] = [];
  const bindings: (string | number | null)[] = [];

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 200) {
      return apiError(c, 400, "VALIDATION_ERROR", "Le nom doit contenir entre 1 et 200 caractères.");
    }
    updates.push("name = ?");
    bindings.push(name);
  }
  if (body.description !== undefined) {
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (description.length > 1000) {
      return apiError(c, 400, "VALIDATION_ERROR", "La description est trop longue (1000 caractères maximum).");
    }
    updates.push("description = ?");
    bindings.push(description || null);
  }
  if (body.price !== undefined) {
    if (body.price === null) {
      updates.push("price = ?");
      bindings.push(null);
    } else if (typeof body.price === "number" && Number.isFinite(body.price) && body.price >= 0) {
      updates.push("price = ?");
      bindings.push(body.price);
    } else {
      return apiError(c, 400, "VALIDATION_ERROR", "Le prix doit être un nombre positif.");
    }
  }
  if (updates.length === 0) return apiError(c, 400, "BAD_REQUEST", "Aucun champ à modifier.");

  bindings.push(id);
  await c.env.DB.prepare(`UPDATE digital_services SET ${updates.join(", ")} WHERE id = ?`).bind(...bindings).run();

  await writeAuditLog(c.env, {
    userId: user.id, userName: user.fullName, action: "digital.service.update",
    entityType: "digital_service", entityId: id, details: { fields: Object.keys(body) },
  });

  return c.json({ success: true });
});

// DELETE /api/admin/digital/services/:id — supprime un service. Refusé s'il a
// des transactions (elles référencent le service) : le désactiver suffit alors
// à le retirer du site.
digitalRoutes.delete("/services/:id", requirePermission("digital.edit"), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const existing = await c.env.DB
    .prepare("SELECT id, name FROM digital_services WHERE id = ?")
    .bind(id)
    .first<{ id: string; name: string }>();
  if (!existing) return apiError(c, 404, "NOT_FOUND", "Service introuvable.");

  const used = await c.env.DB
    .prepare("SELECT COUNT(*) AS n FROM digital_transactions WHERE service_id = ?")
    .bind(id)
    .first<{ n: number }>();
  if ((used?.n ?? 0) > 0) {
    return apiError(c, 409, "CONFLICT", "Ce service a des transactions enregistrées : désactive-le plutôt que de le supprimer.");
  }

  await c.env.DB.prepare("DELETE FROM digital_services WHERE id = ?").bind(id).run();

  await writeAuditLog(c.env, {
    userId: user.id, userName: user.fullName, action: "digital.service.delete",
    entityType: "digital_service", entityId: id, details: { name: existing.name },
  });

  return c.json({ success: true });
});

// GET /api/admin/digital/transactions
digitalRoutes.get("/transactions", requirePermission("digital.view"), async (c) => {
  const result = await c.env.DB
    .prepare(
      `SELECT t.*, s.name as service_name FROM digital_transactions t
       JOIN digital_services s ON s.id = t.service_id
       ORDER BY t.created_at DESC LIMIT 200`
    )
    .all();
  return c.json({ transactions: result.results ?? [] });
});
