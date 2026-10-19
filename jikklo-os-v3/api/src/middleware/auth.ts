import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import type { Env, Variables, AuthUser } from "../types";
import { verifyJwt } from "../lib/jwt";
import { apiError } from "../lib/apiResponse";

const AUTH_COOKIE_NAME = "jikklo_session";

/**
 * Vérifie la session via le cookie HttpOnly `jikklo_session` (V2, règle #20).
 * Conserve en repli la lecture de l'en-tête Authorization: Bearer, utile pour
 * des clients non-navigateur (scripts, futurs clients mobiles natifs) — mais
 * le frontend web JIKKLO OS utilise désormais exclusivement le cookie.
 */
export async function requireAuth(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  const cookieToken = getCookie(c, AUTH_COOKIE_NAME);
  const authHeader = c.req.header("Authorization");
  const headerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token = cookieToken ?? headerToken;

  if (!token) {
    return apiError(c, 401, "UNAUTHENTICATED", "Authentification requise.");
  }
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) {
    return apiError(c, 401, "UNAUTHENTICATED", "Session invalide ou expirée.");
  }

  const userRow = await c.env.DB
    .prepare(
      `SELECT u.id, u.full_name, u.email, u.role_id, u.status, r.name as role_name
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`
    )
    .bind(payload.sub)
    .first<{
      id: string;
      full_name: string;
      email: string;
      role_id: string;
      status: string;
      role_name: string;
    }>();

  if (!userRow || userRow.status !== "active") {
    return apiError(c, 401, "UNAUTHENTICATED", "Compte introuvable ou suspendu.");
  }

  const permRows = await c.env.DB
    .prepare(
      `SELECT p.code FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = ?`
    )
    .bind(userRow.role_id)
    .all<{ code: string }>();

  const user: AuthUser = {
    id: userRow.id,
    fullName: userRow.full_name,
    email: userRow.email,
    roleId: userRow.role_id,
    roleName: userRow.role_name,
    permissions: (permRows.results ?? []).map((p) => p.code),
  };

  c.set("user", user);
  await next();
}
