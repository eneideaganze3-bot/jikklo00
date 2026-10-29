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
      `SELECT u.id, u.full_name, u.email, u.phone, u.status, u.last_login_at, u.role_id, r.name as role_name, r.label as role_label
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

// Nombre d'autres comptes super_admin actifs : empêche de se retrouver sans
// aucun administrateur (rétrogradation ou suppression du dernier).
async function countOtherActiveSuperAdmins(db: D1Database, excludeUserId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM users u JOIN roles r ON r.id = u.role_id
       WHERE r.name = 'super_admin' AND u.status = 'active' AND u.id != ?`
    )
    .bind(excludeUserId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// PATCH /api/admin/users/:id — modifier nom, e-mail, téléphone, rôle et/ou
// réinitialiser le mot de passe. Seuls les champs envoyés sont modifiés.
userRoutes.patch("/:id", requirePermission("users.manage"), async (c) => {
  const currentUser = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json<{
    fullName?: string;
    email?: string;
    phone?: string | null;
    roleId?: string;
    password?: string;
  }>();

  const target = await c.env.DB
    .prepare(
      `SELECT u.id, u.role_id, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`
    )
    .bind(id)
    .first<{ id: string; role_id: string; role_name: string }>();
  if (!target) return apiError(c, 404, "NOT_FOUND", "Utilisateur introuvable.");

  const updates: string[] = [];
  const bindings: (string | null)[] = [];

  if (body.fullName !== undefined) {
    const nameCheck = validateText(body.fullName, { fieldName: "Nom", maxLength: 200 });
    if (!nameCheck.valid) return apiError(c, 400, "VALIDATION_ERROR", nameCheck.error);
    updates.push("full_name = ?");
    bindings.push(nameCheck.value);
  }

  if (body.email !== undefined) {
    const emailCheck = validateEmail(body.email, true);
    if (!emailCheck.valid) return apiError(c, 400, "VALIDATION_ERROR", emailCheck.error);
    const taken = await c.env.DB
      .prepare("SELECT id FROM users WHERE email = ? AND id != ?")
      .bind(emailCheck.value, id)
      .first();
    if (taken) return apiError(c, 409, "CONFLICT", "Cet email est déjà utilisé.");
    updates.push("email = ?");
    bindings.push(emailCheck.value);
  }

  if (body.phone !== undefined) {
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    if (phone.length > 30) return apiError(c, 400, "VALIDATION_ERROR", "Téléphone trop long.");
    updates.push("phone = ?");
    bindings.push(phone || null);
  }

  if (body.roleId !== undefined && body.roleId !== target.role_id) {
    if (id === currentUser.id) {
      return apiError(c, 400, "VALIDATION_ERROR", "Tu ne peux pas changer ton propre rôle.");
    }
    const roleExists = await c.env.DB.prepare("SELECT id FROM roles WHERE id = ?").bind(body.roleId).first();
    if (!roleExists) return apiError(c, 400, "VALIDATION_ERROR", "Rôle invalide.");
    if (target.role_name === "super_admin" && (await countOtherActiveSuperAdmins(c.env.DB, id)) === 0) {
      return apiError(c, 400, "VALIDATION_ERROR", "Impossible de retirer le rôle du dernier Super Admin actif.");
    }
    updates.push("role_id = ?");
    bindings.push(body.roleId);
  }

  let passwordChanged = false;
  if (body.password !== undefined && body.password !== "") {
    if (body.password.length < 8) {
      return apiError(c, 400, "VALIDATION_ERROR", "Le mot de passe doit contenir au moins 8 caractères.");
    }
    const { hash, salt } = await hashPassword(body.password);
    updates.push("password_hash = ?", "password_salt = ?");
    bindings.push(hash, salt);
    passwordChanged = true;
  }

  if (updates.length === 0) return apiError(c, 400, "BAD_REQUEST", "Aucun champ à modifier.");

  updates.push("updated_at = datetime('now')");
  bindings.push(id);
  await c.env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).bind(...bindings).run();

  await writeAuditLog(c.env, {
    userId: currentUser.id,
    userName: currentUser.fullName,
    action: "user.update",
    entityType: "user",
    entityId: id,
    // Le mot de passe n'est jamais journalisé, seulement le fait qu'il a changé.
    details: { fields: Object.keys(body).filter((k) => k !== "password"), passwordChanged },
  });

  return c.json({ success: true });
});

// DELETE /api/admin/users/:id — supprime définitivement un compte staff.
// Ses lignes du journal d'audit sont conservées (le nom reste), seule la
// référence vers le compte supprimé est retirée.
userRoutes.delete("/:id", requirePermission("users.manage"), async (c) => {
  const currentUser = c.get("user");
  const id = c.req.param("id");

  if (id === currentUser.id) {
    return apiError(c, 400, "VALIDATION_ERROR", "Tu ne peux pas supprimer ton propre compte.");
  }

  const target = await c.env.DB
    .prepare(
      `SELECT u.id, u.full_name, u.email, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`
    )
    .bind(id)
    .first<{ id: string; full_name: string; email: string; role_name: string }>();
  if (!target) return apiError(c, 404, "NOT_FOUND", "Utilisateur introuvable.");

  if (target.role_name === "super_admin" && (await countOtherActiveSuperAdmins(c.env.DB, id)) === 0) {
    return apiError(c, 400, "VALIDATION_ERROR", "Impossible de supprimer le dernier Super Admin actif.");
  }

  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE audit_logs SET user_id = NULL WHERE user_id = ?").bind(id),
    c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id),
  ]);

  await writeAuditLog(c.env, {
    userId: currentUser.id,
    userName: currentUser.fullName,
    action: "user.delete",
    entityType: "user",
    entityId: id,
    details: { email: target.email, name: target.full_name },
  });

  return c.json({ success: true });
});
