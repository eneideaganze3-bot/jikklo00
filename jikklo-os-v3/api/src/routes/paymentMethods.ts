import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { generateId, writeAuditLog } from "../lib/helpers";
import { apiError } from "../lib/apiResponse";
import { validateText } from "../lib/validate";

// Admin → Paramètres → Paiements (spécification "évolution architecturale
// majeure", section 4/5). Chaque moyen de paiement est activable/désactivable
// et configurable ici, sans toucher au code : le site public (voir
// routes/misc.ts, GET /api/public/payment-methods) n'affiche jamais que les
// moyens avec enabled = 1. Aucun secret n'est manipulé par ces routes —
// `config` est un JSON de réglages opérationnels non sensibles uniquement
// (numéro marchand, IBAN...), jamais une clé API.
export const paymentMethodRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

paymentMethodRoutes.use("*", requireAuth);
paymentMethodRoutes.use("*", requirePermission("payments.manage"));

const ALLOWED_KIND = new Set(["manual", "api"]);

function parseConfig(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  try {
    return JSON.stringify(raw);
  } catch {
    return null;
  }
}

function readConfig(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// `kind=api` only describes a future/real provider integration. The Admin UI
// must not be able to expose an API payment method at checkout merely by
// flipping enabled=1 while no production integration has been declared.
// `integrationReady: true` is an explicit operational gate in the non-secret
// config; provider secrets remain Cloudflare Worker secrets.
function canEnable(methodKind: unknown, rawConfig: unknown): boolean {
  if (methodKind !== "api") return true;
  return readConfig(rawConfig).integrationReady === true;
}

paymentMethodRoutes.get("/", async (c) => {
  const result = await c.env.DB
    .prepare("SELECT * FROM payment_methods ORDER BY display_order, name")
    .all();
  const methods = (result.results ?? []).map((row: any) => ({
    ...row,
    config: readConfig(row.config),
  }));
  return c.json({ paymentMethods: methods });
});

paymentMethodRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT * FROM payment_methods WHERE id = ?").bind(id).first<any>();
  if (!row) return apiError(c, 404, "NOT_FOUND", "Moyen de paiement introuvable.");
  return c.json({ paymentMethod: { ...row, config: readConfig(row.config) } });
});

// POST /api/admin/payment-methods — créer un nouveau moyen (ex: un futur
// provider mobile money spécifique à Jikklo, sans déploiement de code).
paymentMethodRoutes.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{
    code: string;
    name: string;
    kind?: "manual" | "api";
    currency?: string;
    instructions?: string;
    config?: Record<string, unknown>;
    displayOrder?: number;
    logoUrl?: string;
  }>();

  const codeCheck = validateText(body.code, { fieldName: "Code", maxLength: 60 });
  const nameCheck = validateText(body.name, { fieldName: "Nom", maxLength: 120 });
  if (!codeCheck.valid) return apiError(c, 400, "VALIDATION_ERROR", codeCheck.error);
  if (!nameCheck.valid) return apiError(c, 400, "VALIDATION_ERROR", nameCheck.error);
  if (body.kind && !ALLOWED_KIND.has(body.kind)) {
    return apiError(c, 400, "VALIDATION_ERROR", "Type de moyen de paiement invalide (manual|api).");
  }

  const serializedConfig = parseConfig(body.config);
  if (body.config !== undefined && body.config !== null && serializedConfig === null) {
    return apiError(c, 400, "VALIDATION_ERROR", "La configuration doit être un objet JSON valide.");
  }

  const existing = await c.env.DB.prepare("SELECT id FROM payment_methods WHERE code = ?").bind(codeCheck.value).first();
  if (existing) return apiError(c, 409, "CONFLICT", "Un moyen de paiement avec ce code existe déjà.");

  const id = generateId("pm");
  await c.env.DB
    .prepare(
      `INSERT INTO payment_methods (id, code, name, logo_url, kind, enabled, currency, display_order, instructions, config, updated_by)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      codeCheck.value,
      nameCheck.value,
      body.logoUrl ?? null,
      body.kind ?? "manual",
      body.currency ?? "CDF",
      body.displayOrder ?? 0,
      body.instructions ?? null,
      serializedConfig,
      user.id
    )
    .run();

  await writeAuditLog(c.env, {
    userId: user.id, userName: user.fullName, action: "payment_method.create",
    entityType: "payment_method", entityId: id, details: { code: body.code },
  });

  return c.json({ id, success: true }, 201);
});

// PATCH /api/admin/payment-methods/:id — modifier / activer / désactiver.
// C'est CE endpoint qui fait qu'activer Airtel Money depuis Admin le fait
// apparaître immédiatement au checkout, sans redéploiement (règle #5).
paymentMethodRoutes.patch("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json<Record<string, unknown>>();

  const current = await c.env.DB.prepare(
    "SELECT id, kind, enabled, config FROM payment_methods WHERE id = ?"
  ).bind(id).first<{ id: string; kind: string; enabled: number; config: string | null }>();
  if (!current) return apiError(c, 404, "NOT_FOUND", "Moyen de paiement introuvable.");

  const requestedKind = body.kind ?? current.kind;
  const requestedConfig = "config" in body ? parseConfig(body.config) : current.config;
  if (requestedKind !== "manual" && requestedKind !== "api") {
    return apiError(c, 400, "VALIDATION_ERROR", "Type de moyen de paiement invalide (manual|api).");
  }
  if ("enabled" in body && Boolean(body.enabled) && !canEnable(requestedKind, requestedConfig)) {
    return apiError(c, 400, "INTEGRATION_NOT_READY", "Ce moyen de paiement API ne peut pas être activé tant que son intégration de production n'est pas déclarée comme prête.");
  }
  if (requestedKind === "api" && "kind" in body && !canEnable(requestedKind, requestedConfig)) {
    return apiError(c, 400, "INTEGRATION_NOT_READY", "Configurez d'abord l'intégration de production avant de passer ce moyen en mode API.");
  }

  const fieldMap: Record<string, string> = {
    name: "name", logoUrl: "logo_url", kind: "kind", enabled: "enabled",
    currency: "currency", displayOrder: "display_order", instructions: "instructions",
  };

  const updates: string[] = [];
  const bindings: unknown[] = [];

  for (const [bodyKey, column] of Object.entries(fieldMap)) {
    if (bodyKey in body) {
      let value = body[bodyKey];
      if (column === "enabled") value = value ? 1 : 0;
      updates.push(`${column} = ?`);
      bindings.push(value);
    }
  }
  if ("config" in body) {
    const serializedConfig = parseConfig(body.config);
    if (body.config !== null && body.config !== undefined && serializedConfig === null) {
      return apiError(c, 400, "VALIDATION_ERROR", "La configuration doit être un objet JSON valide.");
    }
    updates.push("config = ?");
    bindings.push(serializedConfig);
  }
  if (requestedKind === "api" && !canEnable(requestedKind, requestedConfig)) {
    // A configuration change that makes an API integration unready must also
    // revoke its public enabled state. This prevents a stale enabled=1 flag.
    const explicitlyEnabling = "enabled" in body && Boolean(body.enabled);
    if (explicitlyEnabling) {
      return apiError(c, 400, "INTEGRATION_NOT_READY", "Ce moyen de paiement API ne peut pas être activé tant que son intégration de production n'est pas déclarée comme prête.");
    }
    updates.push("enabled = 0");
  }

  if (updates.length === 0) return apiError(c, 400, "BAD_REQUEST", "Aucun champ valide à modifier.");

  updates.push("updated_at = datetime('now')", "updated_by = ?");
  bindings.push(user.id, id);

  await c.env.DB.prepare(`UPDATE payment_methods SET ${updates.join(", ")} WHERE id = ?`).bind(...bindings).run();

  await writeAuditLog(c.env, {
    userId: user.id, userName: user.fullName, action: "payment_method.update",
    entityType: "payment_method", entityId: id, details: body,
  });

  return c.json({ success: true });
});

// DELETE /api/admin/payment-methods/:id — désactive plutôt que supprimer,
// pour ne jamais casser l'historique des commandes déjà passées avec ce
// moyen (order_payments.payment_method_id y fait référence).
paymentMethodRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  await c.env.DB.prepare("UPDATE payment_methods SET enabled = 0, updated_at = datetime('now') WHERE id = ?").bind(id).run();
  await writeAuditLog(c.env, {
    userId: user.id, userName: user.fullName, action: "payment_method.disable",
    entityType: "payment_method", entityId: id,
  });
  return c.json({ success: true });
});
