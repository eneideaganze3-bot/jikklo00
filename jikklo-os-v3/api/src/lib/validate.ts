/**
 * Validations réutilisables côté serveur (règle #11 V3). Chaque fonction
 * retourne soit la valeur nettoyée, soit une erreur explicite — jamais
 * d'exception non gérée sur une entrée malformée.
 */

export type ValidationResult<T> =
  | { valid: true; value: T }
  | { valid: false; error: string };

const MAX_TEXT_LENGTH = 4000;
const PHONE_REGEX = /^\+?[0-9]{8,15}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID_PREFIX_REGEX = /^[a-z0-9_]+_[a-f0-9-]{36}$|^[a-z]+_[a-zA-Z0-9-]{1,60}$/;

export function validatePhone(value: unknown): ValidationResult<string> {
  if (typeof value !== "string") return { valid: false, error: "Numéro de téléphone requis." };
  const trimmed = value.trim();
  if (!PHONE_REGEX.test(trimmed)) {
    return { valid: false, error: "Numéro de téléphone invalide (8 à 15 chiffres, + optionnel)." };
  }
  return { valid: true, value: trimmed };
}

export function validateEmail(value: unknown, required = false): ValidationResult<string | null> {
  if (value === undefined || value === null || value === "") {
    return required ? { valid: false, error: "Email requis." } : { valid: true, value: null };
  }
  if (typeof value !== "string" || !EMAIL_REGEX.test(value.trim()) || value.length > 254) {
    return { valid: false, error: "Adresse email invalide." };
  }
  return { valid: true, value: value.trim().toLowerCase() };
}

export function validateText(
  value: unknown,
  { required = true, maxLength = MAX_TEXT_LENGTH, fieldName = "Champ" } = {}
): ValidationResult<string | null> {
  if (value === undefined || value === null || value === "") {
    return required ? { valid: false, error: `${fieldName} requis.` } : { valid: true, value: null };
  }
  if (typeof value !== "string") return { valid: false, error: `${fieldName} invalide.` };
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    return { valid: false, error: `${fieldName} trop long (${maxLength} caractères maximum).` };
  }
  return { valid: true, value: trimmed };
}

/** Vérifie qu'un identifiant a une forme plausible (préfixe_uuid ou similaire) — n'accède jamais à la base avec une valeur non filtrée sans ce filtre basique. */
export function validateId(value: unknown): ValidationResult<string> {
  if (typeof value !== "string" || value.length < 3 || value.length > 80) {
    return { valid: false, error: "Identifiant invalide." };
  }
  // Filtre permissif mais bloque les caractères dangereux (espaces, quotes, etc.)
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    return { valid: false, error: "Identifiant invalide." };
  }
  return { valid: true, value };
}

export function validatePrice(value: unknown): ValidationResult<number> {
  const num = Number(value);
  if (typeof value !== "number" && typeof value !== "string") {
    return { valid: false, error: "Prix invalide." };
  }
  if (Number.isNaN(num) || !Number.isFinite(num)) return { valid: false, error: "Prix invalide." };
  if (num < 0) return { valid: false, error: "Le prix ne peut pas être négatif." };
  if (num > 1_000_000_000) return { valid: false, error: "Prix anormalement élevé." };
  return { valid: true, value: num };
}

export type Pagination = { limit: number; offset: number };

/** Borne limit/offset pour éviter des requêtes abusives (règle #11 : pagination). */
export function parsePagination(query: { limit?: string; offset?: string }): Pagination {
  let limit = Number(query.limit ?? 50);
  let offset = Number(query.offset ?? 0);
  if (!Number.isFinite(limit) || limit <= 0) limit = 50;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;
  limit = Math.min(limit, 200); // plafond dur
  return { limit: Math.floor(limit), offset: Math.floor(offset) };
}

const ALLOWED_ORDER_STATUSES = new Set([
  "new", "confirmed", "preparing", "ready", "delivering", "delivered", "completed", "cancelled",
]);
export function validateOrderStatus(value: unknown): ValidationResult<string> {
  if (typeof value !== "string" || !ALLOWED_ORDER_STATUSES.has(value)) {
    return { valid: false, error: "Statut de commande invalide." };
  }
  return { valid: true, value };
}
