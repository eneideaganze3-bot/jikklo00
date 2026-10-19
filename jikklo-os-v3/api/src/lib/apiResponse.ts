import type { Context } from "hono";
import type { StatusCode } from "hono/utils/http-status";

/**
 * Format d'erreur uniforme sur toute l'API (règle #36 V3) :
 *   { success: false, error: { code, message } }
 * `code` est une chaîne stable destinée aux clients programmatiques
 * (ex: le futur JIKKLO.COM peut faire `if (err.code === "INSUFFICIENT_STOCK")`
 * sans dépendre du texte français, qui peut changer).
 */
export function apiError(c: Context, status: StatusCode, code: string, message: string) {
  return c.json({ success: false, error: { code, message } }, status);
}

/** Enveloppe de succès cohérente pour les réponses qui ne renvoient pas déjà un objet métier explicite. */
export function apiSuccess<T extends Record<string, unknown>>(c: Context, data: T, status: StatusCode = 200) {
  return c.json({ success: true, ...data }, status);
}

export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  UNAUTHORIZED: "UNAUTHORIZED",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
  RATE_LIMITED: "RATE_LIMITED",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;
