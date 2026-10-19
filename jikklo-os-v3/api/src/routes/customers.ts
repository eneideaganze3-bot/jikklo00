import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { apiError } from "../lib/apiResponse";
import { parsePagination } from "../lib/validate";

// Gestion clients côté STAFF uniquement (JIKKLO OS). Pour l'espace client
// public (inscription/connexion/commandes), voir routes/customerAccount.ts.
export const customerRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
customerRoutes.use("*", requireAuth);

customerRoutes.get("/", requirePermission("customers.view"), async (c) => {
  const { limit, offset } = parsePagination(c.req.query());
  const result = await c.env.DB
    .prepare(
      `SELECT c.id, c.full_name, c.phone, c.email, c.created_at,
              COUNT(o.id) as order_count,
              COALESCE(SUM(o.total), 0) as total_spent,
              MAX(o.created_at) as last_order_at
       FROM customers c
       LEFT JOIN orders o ON o.customer_id = c.id AND o.status != 'cancelled'
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(limit, offset)
    .all();
  return c.json({ customers: result.results ?? [], pagination: { limit, offset } });
});

customerRoutes.get("/:id", requirePermission("customers.view"), async (c) => {
  const id = c.req.param("id");
  const customer = await c.env.DB.prepare("SELECT * FROM customers WHERE id = ?").bind(id).first();
  if (!customer) return apiError(c, 404, "NOT_FOUND", "Client introuvable.");
  const orders = await c.env.DB
    .prepare("SELECT id, order_number, status, total, currency, created_at FROM orders WHERE customer_id = ? ORDER BY created_at DESC")
    .bind(id).all();
  return c.json({ customer, orders: orders.results ?? [] });
});
