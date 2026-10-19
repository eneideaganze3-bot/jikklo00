import type { Env } from "../types";
import type { OrderTotals } from "./order";

/**
 * Construit le texte détaillé de la commande, envoyé à l'entreprise ET
 * utilisable pour le lien "Commander via WhatsApp" côté client (règle #18, #19).
 * Ne JAMAIS envoyer un message générique type "Nouvelle commande" seul.
 */
export function buildOrderWhatsAppMessage(params: {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  totals: OrderTotals;
  currency: string;
  deliveryMode: string;
  deliveryAddress?: string;
  notes?: string;
  createdAt: string;
  paymentMethodName?: string;
  paymentReference?: string;
  paymentStatus?: string;
}): string {
  const lines: string[] = [];
  lines.push("JIKKLO — NOUVELLE COMMANDE");
  lines.push(`Commande : ${params.orderNumber}`);
  lines.push("");
  lines.push(`Client : ${params.customerName}`);
  lines.push(`Téléphone : ${params.customerPhone}`);
  lines.push("");
  lines.push("Produits :");
  params.totals.items.forEach((item, i) => {
    lines.push(
      `${i + 1}. ${item.productName} — ${item.quantity} ` +
        `Prix unitaire : ${item.unitPrice} ${params.currency} ` +
        `Sous-total : ${item.lineTotal} ${params.currency}`
    );
  });
  lines.push("");
  lines.push(`Sous-total : ${params.totals.subtotal} ${params.currency}`);
  if (params.totals.deliveryFee > 0) {
    lines.push(`Livraison : ${params.totals.deliveryFee} ${params.currency}`);
  }
  lines.push(`Total : ${params.totals.total} ${params.currency}`);
  lines.push("");
  lines.push(`Mode de livraison : ${params.deliveryMode}`);
  if (params.deliveryAddress) lines.push(`Adresse : ${params.deliveryAddress}`);
  if (params.notes) lines.push(`Notes : ${params.notes}`);
  // Section paiement (correction V4.1, mission section 18) — absente avant
  // cette correction alors que payment_methods/order_payments existent
  // depuis la migration 0006. Sans ceci, l'équipe recevait la commande sur
  // WhatsApp sans savoir comment le client comptait payer.
  if (params.paymentMethodName) {
    lines.push("");
    lines.push(`Moyen de paiement : ${params.paymentMethodName}`);
    if (params.paymentReference) lines.push(`Référence : ${params.paymentReference}`);
    lines.push(`Statut paiement : ${params.paymentStatus ?? "en attente"}`);
  }
  lines.push(`Date : ${params.createdAt}`);

  return lines.join("\n");
}

/**
 * Couche d'abstraction fournisseur WhatsApp (règle #79).
 * Implémentation actuelle : WhatsApp Business Cloud API.
 * Peut être remplacée sans toucher au reste de l'application.
 */
export interface WhatsAppProvider {
  sendMessage(toPhoneNumber: string, message: string): Promise<boolean>;
}

export class WhatsAppCloudApiProvider implements WhatsAppProvider {
  constructor(private token: string, private phoneNumberId: string) {}

  async sendMessage(toPhoneNumber: string, message: string): Promise<boolean> {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v20.0/${this.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: toPhoneNumber,
            type: "text",
            text: { body: message },
          }),
        }
      );
      return res.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Renvoie un provider WhatsApp fonctionnel si les secrets sont configurés,
 * sinon null (le système continue de fonctionner sans planter — règle #93/#95 :
 * pas de fausse fonctionnalité, on indique clairement que ce n'est pas configuré).
 */
export function getWhatsAppProvider(env: Env): WhatsAppProvider | null {
  if (!env.WHATSAPP_API_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) return null;
  return new WhatsAppCloudApiProvider(
    env.WHATSAPP_API_TOKEN,
    env.WHATSAPP_PHONE_NUMBER_ID
  );
}

/** Construit le lien wa.me pré-rempli pour le bouton client (règle #19). */
export function buildWhatsAppDeepLink(
  businessPhone: string,
  message: string
): string {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${businessPhone}?text=${encoded}`;
}
