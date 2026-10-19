import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { generateId, writeAuditLog } from "../lib/helpers";
import { hashPassword } from "../lib/password";
import { apiError } from "../lib/apiResponse";
import { validateText, validateEmail } from "../lib/validate";

export const userRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

userRoutes.use("*", requireAuth);

// GET /api/admin/users — liste du staff avec leur rôle
userRoutes.get("/", requirePermission("users.manage"), async (c) => {
  const result = await c.env.DB
    .prepare(
      `SELECT u.id, u.full_name, u.email, u.status, u.last_login_at, r.name as role_name, r.label as role_label
       FROM users u JOIN roles r ON r.id = u.role_id
       ORDER BY u.created_at DESC`
    )
    .all();
  return c.json({ users: result.results ?? [] });
});

// GET /api/admin/users/roles — liste des rôles disponibles (pour le formulaire)
userRoutes.get("/roles", requirePermission("users.manage"), async (c) => {
  const result = await c.env.DB.prepare("SELECT id, name, label FROM roles").all();
  return c.json({ roles: result.results ?? [] });
});

// POST /api/admin/users — créer un compte staff
userRoutes.post("/", requirePermission("users.manage"), async (c) => {
  const currentUser = c.get("user");
  const body = await c.req.json<{
    fullName: string;
    email: string;
    password: string;
    roleId: string;
    phone?: string;
  }>();

  const nameCheck = validateText(body.fullName, { fieldName: "Nom", maxLength: 200 });
  const emailCheck = validateEmail(body.email, true);
  if (!nameCheck.valid) return apiError(c, 400, "VALIDATION_ERROR", nameCheck.error);
  if (!emailCheck.valid) return apiError(c, 400, "VALIDATION_ERROR", emailCheck.error);
  if (!body.password || !body.roleId) {
    return apiError(c, 400, "VALIDATION_ERROR", "Mot de passe et rôle sont requis.");
  }
  if (body.password.length < 8) {
    return apiError(c, 400, "VALIDATION_ERROR", "Le mot de passe doit contenir au moins 8 caractères.");
  }

  // Le rôle envoyé par le frontend doit exister réellement en base — un
  // roleId arbitraire ne doit jamais pouvoir être accepté tel quel (règle #16 V3).
  const roleExists = await c.env.DB.prepare("SELECT id FROM roles WHERE id = ?").bind(body.roleId).first();
  if (!roleExists) return apiError(c, 400, "VALIDATION_ERROR", "Rôle invalide.");

  const existing = await c.env.DB
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(emailCheck.value)
    .first();
  if (existing) return apiError(c, 409, "CONFLICT", "Cet email est déjà utilisé.");

  const { hash, salt } = await hashPassword(body.password);
  const userId = generateId("user");

  await c.env.DB
    .prepare(
      `INSERT INTO users (id, full_name, email, phone, password_hash, password_salt, role_id, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`
    )
    .bind(userId, nameCheck.value, emailCheck.value, body.phone ?? null, hash, salt, body.roleId, currentUser.id)
    .run();

  await writeAuditLog(c.env, {
    userId: currentUser.id,
    userName: currentUser.fullName,
    action: "user.create",
    entityType: "user",
    entityId: userId,
    details: { email: body.email, roleId: body.roleId },
  });

  return c.json({ id: userId, success: true }, 201);
});

// PATCH /api/admin/users/:id/status — suspendre/réactiver
userRoutes.patch("/:id/status", requirePermission("users.manage"), async (c) => {
  const currentUser = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json<{ status: string }>();

  if (body.status !== "active" && body.status !== "suspended") {
    return apiError(c, 400, "VALIDATION_ERROR", "Statut invalide (active ou suspended attendu).");
  }
  if (id === currentUser.id && body.status === "suspended") {
    return apiError(c, 400, "VALIDATION_ERROR", "Tu ne peux pas suspendre ton propre compte.");
  }

  await c.env.DB
    .prepare("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(body.status, id)
    .run();

  await writeAuditLog(c.env, {
    userId: currentUser.id,
    userName: currentUser.fullName,
    action: "user.status_change",
    entityType: "user",
    entityId: id,
    details: { status: body.status },
  });

  return c.json({ success: true });
});
