import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import type { Env, Variables } from "../types";
import { verifyPassword } from "../lib/password";
import { signJwt } from "../lib/jwt";
import { requireAuth } from "../middleware/auth";
import { writeAuditLog } from "../lib/helpers";
import { apiError } from "../lib/apiResponse";

export const authRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

export const AUTH_COOKIE_NAME = "jikklo_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 jours, doit correspondre à l'expiration du JWT

// POST /api/auth/login — connexion staff JIKKLO OS.
// V2 : le token n'est plus renvoyé dans le corps JSON (vulnérable au XSS via
// localStorage) mais posé comme cookie HttpOnly + Secure + SameSite=Strict
// (règle #20 V2). Le frontend doit appeler l'API avec `credentials: "include"`.
authRoutes.post("/login", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();
  if (!body.email || !body.password) {
    return apiError(c, 400, "VALIDATION_ERROR", "Email et mot de passe requis.");
  }

  const user = await c.env.DB
    .prepare(
      `SELECT u.id, u.full_name, u.email, u.password_hash, u.password_salt,
              u.status, u.role_id, r.name as role_name
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.email = ?`
    )
    .bind(body.email.toLowerCase().trim())
    .first();

  const invalidCredentials = () => apiError(c, 401, "INVALID_CREDENTIALS", "Email ou mot de passe incorrect.");

  if (!user) return invalidCredentials();
  if (user.status !== "active") {
    return apiError(c, 403, "ACCOUNT_SUSPENDED", "Ce compte est suspendu.");
  }

  const valid = await verifyPassword(body.password, user.password_hash, user.password_salt);
  if (!valid) return invalidCredentials();

  const token = await signJwt({ sub: user.id, role: user.role_name }, c.env.JWT_SECRET);

  setCookie(c, AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: c.env.ENVIRONMENT === "production",
    sameSite: "Strict",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });

  await c.env.DB
    .prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?")
    .bind(user.id)
    .run();

  await writeAuditLog(c.env, { userId: user.id, userName: user.full_name, action: "auth.login" });

  return c.json({
    user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role_name },
  });
});

// GET /api/auth/me — infos de l'utilisateur connecté + ses permissions
authRoutes.get("/me", requireAuth, async (c) => {
  const user = c.get("user");
  return c.json({ user });
});

// POST /api/auth/logout — supprime le cookie côté serveur (contrairement à un
// token localStorage, un cookie HttpOnly ne peut pas être effacé par du JS
// côté client : c'est l'API qui doit l'invalider explicitement).
authRoutes.post("/logout", requireAuth, async (c) => {
  const user = c.get("user");
  deleteCookie(c, AUTH_COOKIE_NAME, { path: "/" });
  await writeAuditLog(c.env, { userId: user.id, userName: user.fullName, action: "auth.logout" });
  return c.json({ success: true });
});
