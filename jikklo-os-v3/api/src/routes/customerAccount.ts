import { Hono } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import type { Env, Variables } from "../types";
import { generateId } from "../lib/helpers";
import { hashPassword, verifyPassword } from "../lib/password";
import { signJwt, verifyJwt } from "../lib/jwt";
import { apiError } from "../lib/apiResponse";
import { validatePhone, validateEmail, validateText } from "../lib/validate";

// Espace client public sur jikklo.com (règle #19 V2) : inscription, connexion,
// profil, historique de commandes. Cookie dédié (jikklo_customer_session),
// distinct du cookie staff (jikklo_session) — les deux niveaux d'accès ne
// doivent jamais être mélangés.
export const customerAccountRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables & { customer?: { id: string; full_name: string } };
}>();

const CUSTOMER_COOKIE_NAME = "jikklo_customer_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 jours

async function requireCustomerAuth(c: any, next: any) {
  const token = getCookie(c, CUSTOMER_COOKIE_NAME);
  if (!token) return apiError(c, 401, "UNAUTHENTICATED", "Connexion requise.");
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) return apiError(c, 401, "UNAUTHENTICATED", "Session invalide ou expirée.");
  const customer = await c.env.DB
    .prepare("SELECT id, full_name, email, phone, address, city, status FROM customers WHERE id = ?")
    .bind(payload.sub)
    .first();
  if (!customer || customer.status !== "active") {
    return apiError(c, 401, "UNAUTHENTICATED", "Compte introuvable.");
  }
  c.set("customer", customer);
  await next();
}

customerAccountRoutes.post("/register", async (c) => {
  const body = await c.req.json<{ fullName: string; phone: string; email?: string; password: string }>();

  const nameCheck = validateText(body.fullName, { fieldName: "Nom", maxLength: 200 });
  const phoneCheck = validatePhone(body.phone);
  const emailCheck = validateEmail(body.email, false);
  if (!nameCheck.valid) return apiError(c, 400, "VALIDATION_ERROR", nameCheck.error);
  if (!phoneCheck.valid) return apiError(c, 400, "VALIDATION_ERROR", phoneCheck.error);
  if (!emailCheck.valid) return apiError(c, 400, "VALIDATION_ERROR", emailCheck.error);
  if (!body.password || body.password.length < 8) {
    return apiError(c, 400, "VALIDATION_ERROR", "Le mot de passe doit contenir au moins 8 caractères.");
  }

  const existing = await c.env.DB.prepare("SELECT id FROM customers WHERE phone = ?").bind(phoneCheck.value).first();
  if (existing) return apiError(c, 409, "CONFLICT", "Un compte existe déjà avec ce numéro.");

  const { hash, salt } = await hashPassword(body.password);
  const id = generateId("cust");

  await c.env.DB
    .prepare(`INSERT INTO customers (id, full_name, phone, email, password_hash, password_salt) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(id, nameCheck.value, phoneCheck.value, emailCheck.value, hash, salt)
    .run();

  const token = await signJwt({ sub: id, role: "client" }, c.env.JWT_SECRET);
  setCookie(c, CUSTOMER_COOKIE_NAME, token, {
    httpOnly: true, secure: c.env.ENVIRONMENT === "production", sameSite: "Strict", path: "/", maxAge: COOKIE_MAX_AGE_SECONDS,
  });

  return c.json({ id, success: true }, 201);
});

customerAccountRoutes.post("/login", async (c) => {
  const body = await c.req.json<{ phone: string; password: string }>();
  if (!body.phone || !body.password) return apiError(c, 400, "VALIDATION_ERROR", "Téléphone et mot de passe requis.");

  const customer = await c.env.DB
    .prepare("SELECT id, full_name, password_hash, password_salt, status FROM customers WHERE phone = ?")
    .bind(body.phone.trim())
    .first<{ id: string; full_name: string; password_hash: string | null; password_salt: string | null; status: string }>();

  const invalidCredentials = () => apiError(c, 401, "INVALID_CREDENTIALS", "Téléphone ou mot de passe incorrect.");
  if (!customer || !customer.password_hash || !customer.password_salt) return invalidCredentials();
  if (customer.status !== "active") return apiError(c, 403, "ACCOUNT_SUSPENDED", "Compte suspendu.");

  const valid = await verifyPassword(body.password, customer.password_hash, customer.password_salt);
  if (!valid) return invalidCredentials();

  const token = await signJwt({ sub: customer.id, role: "client" }, c.env.JWT_SECRET);
  setCookie(c, CUSTOMER_COOKIE_NAME, token, {
    httpOnly: true, secure: c.env.ENVIRONMENT === "production", sameSite: "Strict", path: "/", maxAge: COOKIE_MAX_AGE_SECONDS,
  });

  return c.json({ id: customer.id, fullName: customer.full_name });
});

customerAccountRoutes.post("/logout", async (c) => {
  deleteCookie(c, CUSTOMER_COOKIE_NAME, { path: "/" });
  return c.json({ success: true });
});

customerAccountRoutes.get("/me", requireCustomerAuth, async (c) => {
  return c.json({ customer: c.get("customer") });
});

customerAccountRoutes.patch("/me", requireCustomerAuth, async (c) => {
  const customer = c.get("customer")!;
  const body = await c.req.json<{ fullName?: unknown; email?: unknown; address?: unknown; city?: unknown }>();
  const allowed: Record<string, string | null> = {};

  if ("fullName" in body) {
    const check = validateText(body.fullName, { fieldName: "Nom", maxLength: 200 });
    if (!check.valid) return apiError(c, 400, "VALIDATION_ERROR", check.error);
    allowed.full_name = check.value;
  }
  if ("email" in body) {
    const check = validateEmail(body.email, false);
    if (!check.valid) return apiError(c, 400, "VALIDATION_ERROR", check.error);
    allowed.email = check.value;
  }
  if ("address" in body) {
    const check = validateText(body.address, { required: false, fieldName: "Adresse", maxLength: 500 });
    if (!check.valid) return apiError(c, 400, "VALIDATION_ERROR", check.error);
    allowed.address = check.value;
  }
  if ("city" in body) {
    const check = validateText(body.city, { required: false, fieldName: "Ville", maxLength: 120 });
    if (!check.valid) return apiError(c, 400, "VALIDATION_ERROR", check.error);
    allowed.city = check.value;
  }
  if (Object.keys(allowed).length === 0) return apiError(c, 400, "BAD_REQUEST", "Aucun champ valide.");

  const setClauses = Object.keys(allowed).map((k) => `${k} = ?`).join(", ");
  await c.env.DB
    .prepare(`UPDATE customers SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...Object.values(allowed), customer.id)
    .run();
  return c.json({ success: true });
});

customerAccountRoutes.get("/orders", requireCustomerAuth, async (c) => {
  const customer = c.get("customer")!;
  const result = await c.env.DB
    .prepare(
      `SELECT o.id, o.order_number, o.status, o.total, o.currency, o.created_at,
              o.payment_status, pm.name as payment_method_name
       FROM orders o
       LEFT JOIN payment_methods pm ON pm.id = o.payment_method_id
       WHERE o.customer_id = ? ORDER BY o.created_at DESC`
    )
    .bind(customer.id)
    .all();
  return c.json({ orders: result.results ?? [] });
});

customerAccountRoutes.get("/orders/:id", requireCustomerAuth, async (c) => {
  const customer = c.get("customer")!;
  const id = c.req.param("id");
  const order = await c.env.DB
    .prepare(
      `SELECT o.*, pm.name as payment_method_name, pm.kind as payment_method_kind
       FROM orders o
       LEFT JOIN payment_methods pm ON pm.id = o.payment_method_id
       WHERE o.id = ? AND o.customer_id = ?`
    )
    .bind(id, customer.id).first();
  if (!order) return apiError(c, 404, "NOT_FOUND", "Commande introuvable.");
  const items = await c.env.DB.prepare("SELECT * FROM order_items WHERE order_id = ?").bind(id).all();
  return c.json({ order, items: items.results ?? [] });
});
