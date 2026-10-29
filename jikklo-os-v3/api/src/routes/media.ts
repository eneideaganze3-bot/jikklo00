import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { generateId, writeAuditLog } from "../lib/helpers";
import { apiError } from "../lib/apiResponse";

type MediaBindings = Env & { ASSETS?: R2Bucket };

// ---------------------------------------------------------------------
// ADMIN — upload / suppression / photo principale (authentification requise)
// ---------------------------------------------------------------------
export const mediaRoutes = new Hono<{ Bindings: MediaBindings; Variables: Variables }>();
mediaRoutes.use("*", requireAuth);

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 Mo

// POST /api/admin/media/upload — upload une image produit vers R2.
// IMPORTANT : nécessite le binding R2 "ASSETS" activé dans wrangler.toml.
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

  // La première photo d'un produit devient automatiquement la photo
  // principale : c'est la seule que le catalogue public affiche
  // (jointure `is_primary = 1` dans routes/misc.ts).
  const imageId = generateId("img");
  await c.env.DB
    .prepare(
      `INSERT INTO product_images (id, product_id, url, is_primary, display_order)
       VALUES (
         ?, ?, ?,
         CASE WHEN EXISTS (SELECT 1 FROM product_images WHERE product_id = ? AND is_primary = 1) THEN 0 ELSE 1 END,
         (SELECT COALESCE(MAX(display_order), -1) + 1 FROM product_images WHERE product_id = ?)
       )`
    )
    .bind(imageId, productId, key, productId, productId)
    .run();

  await writeAuditLog(c.env, {
    userId: user.id, userName: user.fullName, action: "media.upload",
    entityType: "product", entityId: productId, details: { key },
  });

  return c.json({ id: imageId, key, success: true }, 201);
});

// POST /api/admin/media/publication — envoie (ou remplace) l'image d'une
// publication « Nouveautés Jikklo ». L'image est stockée dans R2 et sa clé est
// enregistrée dans publications.image_url ; le site public la reçoit sous
// forme d'URL complète (voir routes/misc.ts).
mediaRoutes.post("/publication", requirePermission("publications.manage"), async (c) => {
  if (!("ASSETS" in c.env) || !c.env.ASSETS) {
    return c.json(
      { error: "Le stockage d'images (R2) n'est pas configuré sur ce déploiement. Voir wrangler.toml." },
      501
    );
  }

  const user = c.get("user");
  const formData = await c.req.formData();
  const file = formData.get("file");
  const publicationId = formData.get("publicationId");

  if (!(file instanceof File)) return apiError(c, 400, "BAD_REQUEST", "Aucun fichier reçu.");
  if (typeof publicationId !== "string" || !publicationId) {
    return apiError(c, 400, "VALIDATION_ERROR", "publicationId requis.");
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return apiError(c, 400, "VALIDATION_ERROR", "Type de fichier non autorisé. Formats acceptés : JPEG, PNG, WEBP.");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return apiError(c, 400, "VALIDATION_ERROR", "Fichier trop volumineux (5 Mo maximum).");
  }

  const publication = await c.env.DB
    .prepare("SELECT id, image_url FROM publications WHERE id = ?")
    .bind(publicationId)
    .first<{ id: string; image_url: string | null }>();
  if (!publication) return apiError(c, 404, "NOT_FOUND", "Publication introuvable.");

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `publications/${publicationId}/${crypto.randomUUID()}.${extension}`;

  await c.env.ASSETS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });
  await c.env.DB
    .prepare("UPDATE publications SET image_url = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ?")
    .bind(key, user.id, publicationId)
    .run();

  // L'ancienne image, si elle venait de R2, n'est plus utile.
  if (publication.image_url && publication.image_url.startsWith("publications/")) {
    await c.env.ASSETS.delete(publication.image_url);
  }

  await writeAuditLog(c.env, {
    userId: user.id, userName: user.fullName, action: "media.publication",
    entityType: "publication", entityId: publicationId, details: { key },
  });

  return c.json({ key, success: true }, 201);
});

// PATCH /api/admin/media/:imageId/primary — choisit la photo principale d'un produit.
mediaRoutes.patch("/:imageId/primary", requirePermission("media.upload"), async (c) => {
  const user = c.get("user");
  const imageId = c.req.param("imageId");
  const image = await c.env.DB
    .prepare("SELECT product_id FROM product_images WHERE id = ?")
    .bind(imageId)
    .first<{ product_id: string }>();
  if (!image) return apiError(c, 404, "NOT_FOUND", "Image introuvable.");

  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE product_images SET is_primary = 0 WHERE product_id = ?").bind(image.product_id),
    c.env.DB.prepare("UPDATE product_images SET is_primary = 1 WHERE id = ?").bind(imageId),
  ]);

  await writeAuditLog(c.env, {
    userId: user.id, userName: user.fullName, action: "media.primary",
    entityType: "product", entityId: image.product_id, details: { imageId },
  });

  return c.json({ success: true });
});

// DELETE /api/admin/media/:imageId
mediaRoutes.delete("/:imageId", requirePermission("media.upload"), async (c) => {
  if (!("ASSETS" in c.env) || !c.env.ASSETS) {
    return apiError(c, 501, "NOT_CONFIGURED", "R2 non configuré.");
  }
  const imageId = c.req.param("imageId");
  const image = await c.env.DB
    .prepare("SELECT url, product_id, is_primary FROM product_images WHERE id = ?")
    .bind(imageId)
    .first<{ url: string; product_id: string; is_primary: number }>();
  if (!image) return apiError(c, 404, "NOT_FOUND", "Image introuvable.");

  await c.env.ASSETS.delete(image.url);
  await c.env.DB.prepare("DELETE FROM product_images WHERE id = ?").bind(imageId).run();

  // Si la photo principale vient d'être supprimée, la suivante prend sa place.
  if (image.is_primary === 1) {
    await c.env.DB
      .prepare(
        `UPDATE product_images SET is_primary = 1
         WHERE id = (SELECT id FROM product_images WHERE product_id = ? ORDER BY display_order LIMIT 1)`
      )
      .bind(image.product_id)
      .run();
  }

  return c.json({ success: true });
});

// ---------------------------------------------------------------------
// PUBLIC — GET /api/public/media/products/<id>/<fichier> : sert une photo
// produit depuis R2. Sans authentification : les photos sont affichées sur
// le site public. Seules les clés au format généré par l'upload sont
// acceptées, jamais un chemin arbitraire du bucket.
// ---------------------------------------------------------------------
export const publicMediaRoutes = new Hono<{ Bindings: MediaBindings; Variables: Variables }>();

const MEDIA_KEY_PATTERN = /^(products|publications)\/[A-Za-z0-9_-]+\/[A-Za-z0-9-]+\.(jpg|png|webp)$/;
const PUBLIC_MEDIA_PREFIX = "/api/public/media/";

publicMediaRoutes.get("/*", async (c) => {
  if (!c.env.ASSETS) return apiError(c, 404, "NOT_FOUND", "Image introuvable.");

  const pathname = new URL(c.req.url).pathname;
  let key = "";
  try {
    key = pathname.startsWith(PUBLIC_MEDIA_PREFIX)
      ? decodeURIComponent(pathname.slice(PUBLIC_MEDIA_PREFIX.length))
      : "";
  } catch {
    return apiError(c, 404, "NOT_FOUND", "Image introuvable.");
  }
  if (!MEDIA_KEY_PATTERN.test(key)) return apiError(c, 404, "NOT_FOUND", "Image introuvable.");

  const object = await c.env.ASSETS.get(key);
  if (!object) return apiError(c, 404, "NOT_FOUND", "Image introuvable.");

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  // Les noms de fichier sont uniques (UUID) : une photo ne change jamais.
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  if (c.req.header("If-None-Match") === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(object.body, { headers });
});
