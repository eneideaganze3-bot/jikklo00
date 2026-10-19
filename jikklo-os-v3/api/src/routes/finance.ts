import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { generateId, writeAuditLog } from "../lib/helpers";
import { apiError } from "../lib/apiResponse";

export const financeRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
financeRoutes.use("*", requireAuth);

// GET /api/admin/finance/entries — recettes/dépenses manuelles
financeRoutes.get("/entries", requirePermission("finance.view"), async (c) => {
  const type = c.req.query("type");
  let query = "SELECT * FROM finance_entries WHERE 1=1";
  const bindings: string[] = [];
  if (type) { query += " AND type = ?"; bindings.push(type); }
  query += " ORDER BY created_at DESC LIMIT 200";
  const result = await c.env.DB.prepare(query).bind(...bindings).all();
  return c.json({ entries: result.results ?? [] });
});

// GET /api/admin/finance/summary — recettes des ventes (automatique, depuis
// orders) + entrées manuelles + estimation de marge.
// IMPORTANT : ceci est une estimation opérationnelle, PAS une comptabilité
// légale certifiée (règle #29). Ne jamais présenter ces chiffres comme tels.
financeRoutes.get("/summary", requirePermission("finance.view"), async (c) => {
  const salesRevenue = await c.env.DB
    .prepare("SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE status NOT IN ('cancelled')")
    .first<{ total: number }>();

  const estimatedMargin = await c.env.DB
    .prepare(
      `SELECT COALESCE(SUM((oi.unit_price - pr.purchase_price) * oi.quantity), 0) as margin
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN prices pr ON pr.product_id = oi.product_id
       WHERE o.status NOT IN ('cancelled')`
    )
    .first<{ margin: number }>();

  const manualIncome = await c.env.DB
    .prepare("SELECT COALESCE(SUM(amount), 0) as total FROM finance_entries WHERE type = 'income'")
    .first<{ total: number }>();
  const manualExpense = await c.env.DB
    .prepare("SELECT COALESCE(SUM(amount), 0) as total FROM finance_entries WHERE type = 'expense'")
    .first<{ total: number }>();

  return c.json({
    salesRevenue: salesRevenue?.total ?? 0,
    estimatedMargin: estimatedMargin?.margin ?? 0,
    manualIncome: manualIncome?.total ?? 0,
    manualExpense: manualExpense?.total ?? 0,
    disclaimer: "Estimation opérationnelle interne — ne remplace pas une comptabilité certifiée.",
  });
});

// POST /api/admin/finance/entries
financeRoutes.post("/entries", requirePermission("finance.edit"), async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{
    type: "income" | "expense";
    category: string;
    amount: number;
    activity?: string;
    reference?: string;
    notes?: string;
  }>();

  if (!body.type || !body.category || !body.amount || body.amount <= 0) {
    return apiError(c, 400, "VALIDATION_ERROR", "Type, catégorie et montant (positif) sont requis.");
  }

  const id = generateId("fin");
  await c.env.DB
    .prepare(
      `INSERT INTO finance_entries (id, type, category, amount, activity, reference, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, body.type, body.category, body.amount, body.activity ?? null, body.reference ?? null, body.notes ?? null, user.id)
    .run();

  await writeAuditLog(c.env, {
    userId: user.id, userName: user.fullName, action: "finance.entry.create",
    entityType: "finance_entry", entityId: id, details: { type: body.type, amount: body.amount },
  });

  return c.json({ id, success: true }, 201);
});
