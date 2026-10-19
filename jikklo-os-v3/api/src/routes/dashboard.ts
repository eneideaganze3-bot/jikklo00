import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";

export const dashboardRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

dashboardRoutes.use("*", requireAuth);

// GET /api/admin/dashboard — toutes les données proviennent de la base réelle.
// Si aucune donnée n'existe encore, les valeurs sont 0 / tableaux vides —
// jamais de chiffres inventés (règle #25).
dashboardRoutes.get("/", requirePermission("dashboard.view"), async (c) => {
  const today = new Date().toISOString().slice(0, 10);

  const revenueToday = await c.env.DB
    .prepare(
      `SELECT COALESCE(SUM(total), 0) as total FROM orders
       WHERE date(created_at) = ? AND status != 'cancelled'`
    )
    .bind(today)
    .first<{ total: number }>();

  const ordersToday = await c.env.DB
    .prepare("SELECT COUNT(*) as count FROM orders WHERE date(created_at) = ?")
    .bind(today)
    .first<{ count: number }>();

  const pendingOrders = await c.env.DB
    .prepare("SELECT COUNT(*) as count FROM orders WHERE status IN ('new','confirmed','preparing')")
    .first<{ count: number }>();

  const lowStock = await c.env.DB
    .prepare(
      `SELECT p.id, p.name, inv.quantity, inv.min_threshold
       FROM inventory inv JOIN products p ON p.id = inv.product_id
       WHERE inv.quantity <= inv.min_threshold AND p.status != 'archived'
       ORDER BY inv.quantity ASC LIMIT 10`
    )
    .all();

  const outOfStock = await c.env.DB
    .prepare(
      `SELECT COUNT(*) as count FROM inventory WHERE quantity <= 0`
    )
    .first<{ count: number }>();

  const totalCustomers = await c.env.DB
    .prepare("SELECT COUNT(*) as count FROM customers")
    .first<{ count: number }>();

  const salesByActivity = await c.env.DB
    .prepare(
      `SELECT p.activity, COALESCE(SUM(oi.line_total), 0) as total
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       JOIN orders o ON o.id = oi.order_id
       WHERE o.status != 'cancelled'
       GROUP BY p.activity`
    )
    .all();

  const recentActivity = await c.env.DB
    .prepare(
      `SELECT action, user_name, entity_type, created_at
       FROM audit_logs ORDER BY created_at DESC LIMIT 15`
    )
    .all();

  const salesLast7Days = await c.env.DB
    .prepare(
      `SELECT date(created_at) as day, COALESCE(SUM(total), 0) as total
       FROM orders
       WHERE created_at >= datetime('now', '-7 days') AND status != 'cancelled'
       GROUP BY day ORDER BY day`
    )
    .all();

  return c.json({
    revenueToday: revenueToday?.total ?? 0,
    ordersToday: ordersToday?.count ?? 0,
    pendingOrders: pendingOrders?.count ?? 0,
    lowStockProducts: lowStock.results ?? [],
    outOfStockCount: outOfStock?.count ?? 0,
    totalCustomers: totalCustomers?.count ?? 0,
    salesByActivity: salesByActivity.results ?? [],
    recentActivity: recentActivity.results ?? [],
    salesLast7Days: salesLast7Days.results ?? [],
  });
});
