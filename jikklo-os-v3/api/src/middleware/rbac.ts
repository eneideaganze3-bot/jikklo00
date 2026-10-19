import type { Context, Next } from "hono";
import type { Env, Variables } from "../types";
import { apiError } from "../lib/apiResponse";

/**
 * Middleware à utiliser APRÈS requireAuth.
 * Bloque la requête (403) si l'utilisateur n'a pas la permission donnée.
 * Toujours vérifié côté serveur — jamais uniquement côté frontend (règle #41).
 */
export function requirePermission(permissionCode: string) {
  return async (
    c: Context<{ Bindings: Env; Variables: Variables }>,
    next: Next
  ) => {
    const user = c.get("user");
    if (!user) {
      return apiError(c, 401, "UNAUTHENTICATED", "Authentification requise.");
    }
    if (!user.permissions.includes(permissionCode)) {
      return c.json(
        { error: `Permission refusée : ${permissionCode} requis.` },
        403
      );
    }
    await next();
  };
}
