import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { generateId, writeAuditLog } from "../lib/helpers";
import { apiError } from "../lib/apiResponse";

export const mediaRoutes = new Hono<{ Bindings: Env & { ASSETS?: R2Bucket }; Variables: Variables }>();
mediaRoutes.use("*", requireAuth);

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 Mo

// POST /api/admin/media/upload — upload une image produit vers R2.
// IMPORTANT : nécessite le binding R2 "ASSETS" décommenté dans wrangler.toml.
// Si R2 n'est pas configuré, cette route répond honnêtement 501 plutôt que
// de simuler un succès (règle #93/95 : pas de fausse fonctionnalité).
mediaRoutes.post("/upload", requirePermission("media.upload"), async (c) => {
  if (!("ASSETS" in c.env) || !c.env.ASSETS) {
    return c.json(
      { error: "Le stockage d'images (R2) n'est pas configuré sur ce déploiement. Voir wrangler.toml." },
      501
    );
  }

  const user = c.get("user");
  const formData = await c.req.formData();
  const file = formData.get("file");
  const productId = formData.get("productId");

  if (!(file instanceof File)) {
    return apiError(c, 400, "BAD_REQUEST", "Aucun fichier reçu.");
  }
  if (typeof productId !== "string" || !productId) {
    return apiError(c, 400, "VALIDATION_ERROR", "productId requis.");
  }

  // Validation stricte du type MIME (jamais fait confiance à l'extension du nom de fichier)
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return apiError(c, 400, "VALIDATION_ERROR", "Type de fichier non autorisé. Formats acceptés : JPEG, PNG, WEBP.");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return apiError(c, 400, "VALIDATION_ERROR", "Fichier trop volumineux (5 Mo maximum).");
  }

  const product = await c.env.DB.prepare("SELECT id FROM products WHERE id = ?").bind(productId).first();
  if (!product) return apiError(c, 404, "NOT_FOUND", "Produit introuvable.");

  // Nom de fichier généré (jamais celui fourni par l'utilisateur — évite path traversal / collisions)
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `products/${productId}/${crypto.randomUUID()}.${extension}`;

  await c.env.ASSETS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  const imageId = generateId("img");
  await c.env.DB
    .prepare(
      `INSERT INTO product_images (id, product_id, url, is_primary, display_order)
       VALUES (?, ?, ?, 0, (SELECT COALESCE(MAX(display_order), -1) + 1 FROM product_images WHERE product_id = ?))`
    )
    .bind(imageId, productId, key, productId)
    .run();

  await writeAuditLog(c.env, {
    userId: user.id, userName: user.fullName, action: "media.upload",
    entityType: "product", entityId: productId, details: { key },
  });

  return c.json({ id: imageId, key, success: true }, 201);
});

// DELETE /api/admin/media/:imageId
mediaRoutes.delete("/:imageId", requirePermission("media.upload"), async (c) => {
  if (!("ASSETS" in c.env) || !c.env.ASSETS) {
    return apiError(c, 501, "NOT_CONFIGURED", "R2 non configuré.");
  }
  const imageId = c.req.param("imageId");
  const image = await c.env.DB
    .prepare("SELECT url FROM product_images WHERE id = ?")
    .bind(imageId)
    .first<{ url: string }>();
  if (!image) return apiError(c, 404, "NOT_FOUND", "Image introuvable.");

  await c.env.ASSETS.delete(image.url);
  await c.env.DB.prepare("DELETE FROM product_images WHERE id = ?").bind(imageId).run();

  return c.json({ success: true });
});
