import type { Env } from "../types";

export function generateId(prefix: string): string {
  // ID unique lisible : prefix_<uuid>
  return `${prefix}_${crypto.randomUUID()}`;
}

/**
 * Génère le prochain numéro de commande au format JKK-YYYY-000001 de façon
 * ATOMIQUE — corrige le bug V1 (COUNT(*)+1, sujet aux collisions en cas de
 * commandes simultanées). Utilise un compteur dédié avec
 * INSERT ... ON CONFLICT DO UPDATE ... RETURNING, qui est une opération
 * atomique unique en SQLite/D1 : deux requêtes concurrentes ne peuvent
 * jamais recevoir la même valeur.
 */
export async function generateOrderNumber(env: Env): Promise<string> {
  const year = new Date().getFullYear();

  const prefixRow = await env.DB
    .prepare("SELECT value FROM settings WHERE key = 'order_number_prefix'")
    .first<{ value: string }>();
  const prefix = prefixRow?.value ?? "JKK";

  const result = await env.DB
    .prepare(
      `INSERT INTO order_counters (year, next_value) VALUES (?, 1)
       ON CONFLICT(year) DO UPDATE SET next_value = next_value + 1
       RETURNING next_value`
    )
    .bind(year)
    .first<{ next_value: number }>();

  const nextNumber = result?.next_value ?? 1;
  const padded = String(nextNumber).padStart(6, "0");
  return `${prefix}-${year}-${padded}`;
}

/**
 * Validation stricte d'une quantité (règle #6 V2) : refuse 0, négatif,
 * NaN, Infinity, et les valeurs absurdement grandes.
 * `allowDecimal` doit être false pour les produits vendus à l'unité.
 */
export function validateQuantity(
  value: unknown,
  allowDecimal: boolean,
  maxAllowed = 100_000
): { valid: true; quantity: number } | { valid: false; error: string } {
  const num = Number(value);
  if (typeof value !== "number" && typeof value !== "string") {
    return { valid: false, error: "Quantité invalide." };
  }
  if (Number.isNaN(num)) return { valid: false, error: "Quantité invalide (NaN)." };
  if (!Number.isFinite(num)) return { valid: false, error: "Quantité invalide (infinie)." };
  if (num <= 0) return { valid: false, error: "La quantité doit être supérieure à zéro." };
  if (num > maxAllowed) return { valid: false, error: "Quantité anormalement élevée." };
  if (!allowDecimal && !Number.isInteger(num)) {
    return { valid: false, error: "Ce produit ne peut pas être commandé en quantité décimale." };
  }
  return { valid: true, quantity: num };
}

/**
 * Enregistre une action dans le journal d'audit (règle #38).
 */
export async function writeAuditLog(
  env: Env,
  params: {
    userId: string;
    userName: string;
    action: string;
    entityType?: string;
    entityId?: string;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  await env.DB
    .prepare(
      `INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      generateId("audit"),
      params.userId,
      params.userName,
      params.action,
      params.entityType ?? null,
      params.entityId ?? null,
      params.details ? JSON.stringify(params.details) : null
    )
    .run();
}

/**
 * Crée une notification interne (règle #37).
 */
export async function createNotification(
  env: Env,
  params: {
    type: string;
    title: string;
    message: string;
    referenceId?: string;
  }
): Promise<void> {
  await env.DB
    .prepare(
      `INSERT INTO notifications (id, type, title, message, reference_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(
      generateId("notif"),
      params.type,
      params.title,
      params.message,
      params.referenceId ?? null
    )
    .run();
}
