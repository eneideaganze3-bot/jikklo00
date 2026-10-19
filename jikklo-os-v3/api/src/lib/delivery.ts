/**
 * Calcule les frais de livraison à partir des paramètres configurés dans
 * JIKKLO OS (table settings). Remplace le `deliveryFee = 0` codé en dur
 * de la V1 (règle #15 V2).
 *
 * Modes supportés aujourd'hui :
 * - "fixed"     : frais fixes (delivery_fixed_fee), gratuit si le sous-total
 *                 dépasse delivery_free_above (0 = désactivé)
 * - "free"      : toujours gratuit
 *
 * Architecture prévue pour évoluer vers "by_zone" (frais par zone
 * géographique) sans casser l'interface de cette fonction.
 */
export function computeDeliveryFee(
  deliveryMode: "pickup" | "delivery",
  subtotal: number,
  settings: Record<string, string>
): number {
  if (deliveryMode === "pickup") return 0;

  const mode = settings.delivery_mode ?? "fixed";
  if (mode === "free") return 0;

  const fixedFee = Number(settings.delivery_fixed_fee ?? 0);
  const freeAbove = Number(settings.delivery_free_above ?? 0);

  if (freeAbove > 0 && subtotal >= freeAbove) return 0;
  return Number.isFinite(fixedFee) && fixedFee > 0 ? fixedFee : 0;
}
