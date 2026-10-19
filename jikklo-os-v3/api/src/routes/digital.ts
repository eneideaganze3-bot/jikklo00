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
