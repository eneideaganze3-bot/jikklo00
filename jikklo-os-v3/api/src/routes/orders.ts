import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { Env, Variables } from "../types";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { generateId, generateOrderNumber, validateQuantity, writeAuditLog, createNotification } from "../lib/helpers";
import { calculateOrderTotals, isValidStatusTransition, checkStockForLine, type OrderStatus, type OrderLineInput } from "../lib/order";
import { buildOrderWhatsAppMessage, getWhatsAppProvider } from "../lib/whatsapp";
import { computeDeliveryFee } from "../lib/delivery";
import { verifyJwt } from "../lib/jwt";
import { validatePhone, validateText, parsePagination, validateOrderStatus } from "../lib/validate";
import { apiError } from "../lib/apiResponse";

export const orderRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * Si le client est connecté (cookie jikklo_customer_session valide), renvoie
 * son id — jamais fait confiance à un customerId envoyé dans le corps de la
 * requête (règle #52 : aucune donnée d'identité fournie par le client n'est
 * utilisée sans vérification serveur).
 */
async function getVerifiedCustomerId(c: any): Promise<string | null> {
  const token = getCookie(c, "jikklo_customer_session");
  if (!token) return null;
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  return payload?.sub ?? null;
}

// ---------------------------------------------------------------------
// PUBLIC — création de commande (règles #4, #5, #6 V2)
//
// GARANTIES :
// - Prix et stock relus depuis la base (jamais fait confiance au client).
// - Quantités validées strictement côté serveur.
// - Toute la création (commande + lignes + décrément stock + mouvements)
//   est exécutée en UNE SEULE transaction via env.DB.batch(). Si le
//   décrément d'un produit fait passer son stock sous 0, la contrainte
//   CHECK (quantity >= 0) sur la table `inventory` fait échouer cette
//   requête — D1 annule alors TOUT le batch (aucune écriture partielle).
//   C'est ce qui garantit qu'en cas de commandes simultanées sur un
//   dernier article, une seule des deux commandes peut réussir.
// ---------------------------------------------------------------------
orderRoutes.post("/public/create", async (c) => {
  const body = await c.req.json<{
    customerName: string;
    customerPhone: string;
    customerId?: string;
    items: { productId: string; quantity: number }[];
    deliveryMode?: "pickup" | "delivery";
    deliveryAddress?: string;
    notes?: string;
    paymentMethodId?: string;
    paymentReference?: string;
  }>();

  const nameCheck = validateText(body.customerName, { fieldName: "Nom", maxLength: 200 });
  const phoneCheck = validatePhone(body.customerPhone);
  const addressCheck = validateText(body.deliveryAddress, { fieldName: "Adresse", maxLength: 500, required: false });
  const notesCheck = validateText(body.notes, { fieldName: "Commentaire", maxLength: 1000, required: false });
  const paymentReferenceCheck = validateText(body.paymentReference, { fieldName: "Référence de paiement", maxLength: 120, required: false });
  if (!nameCheck.valid) return apiError(c, 400, "VALIDATION_ERROR", nameCheck.error);
  if (!phoneCheck.valid) return apiError(c, 400, "VALIDATION_ERROR", phoneCheck.error);
  if (!addressCheck.valid) return apiError(c, 400, "VALIDATION_ERROR", addressCheck.error);
  if (!notesCheck.valid) return apiError(c, 400, "VALIDATION_ERROR", notesCheck.error);
  if (!paymentReferenceCheck.valid) return apiError(c, 400, "VALIDATION_ERROR", paymentReferenceCheck.error);
  const deliveryMode = body.deliveryMode ?? "pickup";
  if (deliveryMode !== "pickup" && deliveryMode !== "delivery") {
    return apiError(c, 400, "VALIDATION_ERROR", "Mode de réception invalide.");
  }
  if (deliveryMode === "delivery" && !addressCheck.value) {
    return apiError(c, 400, "VALIDATION_ERROR", "Adresse de livraison requise.");
  }
  if (!body.items?.length) {
    return apiError(c, 400, "VALIDATION_ERROR", "Au moins un produit est requis.");
  }
  if (body.items.length > 100) {
    return apiError(c, 400, "VALIDATION_ERROR", "Trop de lignes dans la commande.");
  }

  // Le moyen de paiement est optionnel à la commande (règle #4 : le
  // paiement peut être confirmé après coup, ex: à la livraison), mais s'il
  // est fourni il DOIT correspondre à un moyen activé — jamais fait
  // confiance à un id de paiement arbitraire envoyé par le client.
  let paymentMethod: { id: string; name: string; kind: string; instructions: string | null; config: string | null } | null = null;
  if (body.paymentMethodId) {
    paymentMethod = await c.env.DB
      .prepare("SELECT id, name, kind, instructions, config FROM payment_methods WHERE id = ? AND enabled = 1")
      .bind(body.paymentMethodId)
      .first<{ id: string; name: string; kind: string; instructions: string | null; config: string | null }>();
    if (!paymentMethod) {
      return apiError(c, 400, "BAD_REQUEST", "Moyen de paiement invalide ou désactivé.");
    }
    if (paymentMethod.kind === "api") {
      let ready = false;
      try {
        const config = paymentMethod.config ? JSON.parse(paymentMethod.config) : {};
        ready = !!config && typeof config === "object" && config.integrationReady === true;
      } catch {
        ready = false;
      }
      if (!ready) return apiError(c, 400, "INTEGRATION_NOT_READY", "Ce moyen de paiement en ligne n'est pas encore disponible.");
    }
  }

  // 1. Relire produit, prix, stock et unité RÉELS depuis la base pour chaque ligne,
  //    et valider strictement la quantité (règle #6).
  const lineItems: OrderLineInput[] = [];
  // Produits pour lesquels le stock doit être vérifié/décrémenté. Piloté
  // EXPLICITEMENT par `products.track_stock` (migration 0007) — plus par
  // la simple présence/absence d'une ligne `inventory`, qui était ambiguë
  // et rejetait à tort les offres sans stock (service, recharge...).
  const trackedInventory = new Set<string>();
  for (const reqItem of body.items) {
    const product = await c.env.DB
      .prepare(
        `SELECT p.id, p.name, p.status, p.unit, p.track_stock, pr.sale_price, inv.quantity as stock
         FROM products p
         JOIN prices pr ON pr.product_id = p.id
         LEFT JOIN inventory inv ON inv.product_id = p.id
         WHERE p.id = ?`
      )
      .bind(reqItem.productId)
      .first<{ id: string; name: string; status: string; unit: string; track_stock: number; sale_price: number; stock: number | null }>();

    if (!product || product.status !== "published") {
      return apiError(c, 400, "BAD_REQUEST", `Produit indisponible ou mal configuré : ${reqItem.productId}`);
    }

    const allowDecimal = product.unit === "L" || product.unit === "kg";
    const qtyCheck = validateQuantity(reqItem.quantity, allowDecimal);
    if (!qtyCheck.valid) {
      return apiError(c, 400, "BAD_REQUEST", `${product.name} : ${qtyCheck.error}`);
    }

    if (product.track_stock) {
      const stockCheck = checkStockForLine(
        { name: product.name, trackStock: true, stock: product.stock },
        qtyCheck.quantity
      );
      if (!stockCheck.ok) {
        return apiError(c, 409, stockCheck.code, stockCheck.message);
      }
      trackedInventory.add(product.id);
    }
    // track_stock = 0 (service, recharge, forfait, abonnement...) : aucune
    // vérification de stock n'est exigée, la commande peut être créée
    // normalement, que la ligne inventory existe ou non (voir
    // checkStockForLine dans lib/order.ts et tests/stock-tracking.test.ts).

    lineItems.push({
      productId: product.id,
      productName: product.name,
      unitPrice: product.sale_price,
      quantity: qtyCheck.quantity,
    });
  }

  const verifiedCustomerId = await getVerifiedCustomerId(c);

  const settingsRows = await c.env.DB
    .prepare("SELECT key, value FROM settings WHERE key IN ('currency','delivery_mode','delivery_fixed_fee','delivery_free_above')")
    .all<{ key: string; value: string }>();
  const settingsMap = Object.fromEntries((settingsRows.results ?? []).map((r) => [r.key, r.value]));
  const currency = settingsMap.currency ?? "CDF";

  const provisionalSubtotal = lineItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const deliveryFee = computeDeliveryFee(deliveryMode, provisionalSubtotal, settingsMap);

  const totals = calculateOrderTotals(lineItems, deliveryFee);

  const orderId = generateId("order");
  const orderNumber = await generateOrderNumber(c.env); // atomique, voir helpers.ts
  const now = new Date().toISOString();

  // 2. Construire TOUTES les requêtes d'écriture, puis les exécuter en un seul
  //    batch atomique (règle #4). Le CHECK constraint sur inventory.quantity
  //    protège contre la survente en cas de concurrence (règle #5).
  const statements = [
    c.env.DB
      .prepare(
        `INSERT INTO orders
          (id, order_number, customer_id, customer_name, customer_phone, status,
           delivery_mode, delivery_address, delivery_fee, subtotal, total, currency, channel, notes,
           payment_method_id, payment_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, 'web', ?, ?, ?, ?, ?)`
      )
      .bind(
        orderId, orderNumber, verifiedCustomerId, nameCheck.value, phoneCheck.value,
        deliveryMode, addressCheck.value ?? null, deliveryFee,
        totals.subtotal, totals.total, currency, notesCheck.value ?? null,
        paymentMethod?.id ?? null, "pending", now, now
      ),
  ];

  if (paymentMethod) {
    statements.push(
      c.env.DB
        .prepare(
          `INSERT INTO order_payments (id, order_id, payment_method_id, status, amount, currency, reference)
           VALUES (?, ?, ?, 'pending', ?, ?, ?)`
        )
        .bind(generateId("pay"), orderId, paymentMethod.id, totals.total, currency, paymentReferenceCheck.value ?? null)
    );
  }

  for (const item of totals.items) {
    statements.push(
      c.env.DB
        .prepare(
          `INSERT INTO order_items (id, order_id, product_id, product_name, unit_price, quantity, line_total)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(generateId("item"), orderId, item.productId, item.productName, item.unitPrice, item.quantity, item.lineTotal)
    );

    // Décrémentation atomique uniquement si le stock est réellement suivi.
    // L'absence de ligne inventory signifie « stock non suivi » et ne doit
    // donc ni bloquer la vente ni produire un mouvement fictif.
    if (trackedInventory.has(item.productId)) {
      statements.push(
        c.env.DB
          .prepare(
            `UPDATE inventory SET quantity = quantity - ?, updated_at = datetime('now') WHERE product_id = ?`
          )
          .bind(item.quantity, item.productId)
      );

      statements.push(
        c.env.DB
          .prepare(
            `INSERT INTO inventory_movements (id, product_id, type, quantity, resulting_stock, reference)
             VALUES (?, ?, 'vente', ?,
               (SELECT quantity FROM inventory WHERE product_id = ?), ?)`
          )
          .bind(generateId("mvt"), item.productId, -item.quantity, item.productId, orderNumber)
      );
    }
  }

  try {
    await c.env.DB.batch(statements);
  } catch (err) {
    // Le batch entier a été annulé — probablement une survente concurrente.
    console.error("Order batch failed:", err);
    return c.json(
      { error: "Impossible de finaliser la commande (stock devenu insuffisant entre-temps). Réessaie." },
      409
    );
  }

  const whatsappMessage = buildOrderWhatsAppMessage({
    orderNumber, customerName: body.customerName, customerPhone: body.customerPhone,
    totals, currency, deliveryMode, deliveryAddress: body.deliveryAddress, notes: body.notes, createdAt: now,
    paymentMethodName: paymentMethod?.name,
    paymentReference: body.paymentReference,
    paymentStatus: paymentMethod ? "en attente" : undefined,
  });

  const provider = getWhatsAppProvider(c.env);
  let whatsappSent = false;
  if (provider && settingsMap.business_whatsapp_number) {
    whatsappSent = await provider.sendMessage(settingsMap.business_whatsapp_number, whatsappMessage);
  }

  await createNotification(c.env, {
    type: "new_order",
    title: "Nouvelle commande",
    message: `Commande ${orderNumber} — ${totals.total} ${currency}`,
    referenceId: orderId,
  });

  return c.json({
    orderId,
    orderNumber,
    total: totals.total,
    currency,
    whatsappMessage,
    whatsappSent,
    whatsappConfigured: provider !== null,
    payment: paymentMethod
      ? { methodId: paymentMethod.id, methodName: paymentMethod.name, kind: paymentMethod.kind, instructions: paymentMethod.instructions, status: "pending" }
      : null,
  }, 201);
});

// GET /api/public/orders/:orderNumber/track — suivi de commande (public)
orderRoutes.get("/public/track/:orderNumber", async (c) => {
  const orderNumber = c.req.param("orderNumber");
  const order = await c.env.DB
    .prepare("SELECT order_number, status, total, currency, created_at, updated_at FROM orders WHERE order_number = ?")
    .bind(orderNumber)
    .first();
  if (!order) return apiError(c, 404, "NOT_FOUND", "Commande introuvable.");
  return c.json({ order });
});

// ---------------------------------------------------------------------
// ADMIN — gestion des commandes dans JIKKLO OS
// ---------------------------------------------------------------------
orderRoutes.use("/admin/*", requireAuth);

orderRoutes.get("/admin", requirePermission("orders.view"), async (c) => {
  const status = c.req.query("status");
  if (status) {
    const statusCheck = validateOrderStatus(status);
    if (!statusCheck.valid) return apiError(c, 400, "VALIDATION_ERROR", statusCheck.error);
  }
  const { limit, offset } = parsePagination(c.req.query());

  // Jointure avec payment_methods pour afficher le NOM du moyen choisi
  // (pas juste son id) dans la liste Admin — mission V4.1 section 7 :
  // "afficher le moyen de paiement" doit être lisible sans appel séparé.
  let query = `
    SELECT o.*, pm.name as payment_method_name, pm.code as payment_method_code
    FROM orders o
    LEFT JOIN payment_methods pm ON pm.id = o.payment_method_id
    WHERE 1=1
  `;
  const bindings: (string | number)[] = [];
  if (status) {
    query += " AND o.status = ?";
    bindings.push(status);
  }
  query += " ORDER BY o.created_at DESC LIMIT ? OFFSET ?";
  bindings.push(limit, offset);
  const result = await c.env.DB.prepare(query).bind(...bindings).all();
  return c.json({ orders: result.results ?? [], pagination: { limit, offset } });
});

orderRoutes.get("/admin/:id", requirePermission("orders.view"), async (c) => {
  const id = c.req.param("id");
  const order = await c.env.DB
    .prepare(
      `SELECT o.*, pm.name as payment_method_name, pm.code as payment_method_code, pm.kind as payment_method_kind
       FROM orders o
       LEFT JOIN payment_methods pm ON pm.id = o.payment_method_id
       WHERE o.id = ?`
    )
    .bind(id).first();
  if (!order) return apiError(c, 404, "NOT_FOUND", "Commande introuvable.");
  const items = await c.env.DB.prepare("SELECT * FROM order_items WHERE order_id = ?").bind(id).all();
  const history = await c.env.DB
    .prepare("SELECT * FROM order_status_history WHERE order_id = ? ORDER BY changed_at DESC")
    .bind(id).all();
  // Historique des paiements associés — mission V4.1 section 7 : montant,
  // référence, date, statut, moyen. Une commande peut avoir plusieurs
  // lignes si le client a changé de moyen après un échec.
  const payments = await c.env.DB
    .prepare(
      `SELECT op.*, pm.name as payment_method_name, pm.kind as payment_method_kind
       FROM order_payments op
       JOIN payment_methods pm ON pm.id = op.payment_method_id
       WHERE op.order_id = ? ORDER BY op.created_at DESC`
    )
    .bind(id).all();
  return c.json({ order, items: items.results ?? [], history: history.results ?? [], payments: payments.results ?? [] });
});

orderRoutes.patch("/admin/:id/status", requirePermission("orders.edit"), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json<{ status: string }>();

  const statusCheck = validateOrderStatus(body.status);
  if (!statusCheck.valid) return apiError(c, 400, "VALIDATION_ERROR", statusCheck.error);
  const newStatus = statusCheck.value as OrderStatus;

  const order = await c.env.DB
    .prepare("SELECT status FROM orders WHERE id = ?")
    .bind(id)
    .first<{ status: OrderStatus }>();
  if (!order) return apiError(c, 404, "NOT_FOUND", "Commande introuvable.");

  if (!isValidStatusTransition(order.status, newStatus)) {
    return apiError(c, 400, "INVALID_TRANSITION", `Transition invalide : ${order.status} → ${newStatus}`);
  }

  await c.env.DB
    .prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(newStatus, id)
    .run();

  await c.env.DB
    .prepare(
      `INSERT INTO order_status_history (id, order_id, old_status, new_status, changed_by)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(generateId("statushist"), id, order.status, newStatus, user.id)
    .run();

  await writeAuditLog(c.env, {
    userId: user.id,
    userName: user.fullName,
    action: "order.status_change",
    entityType: "order",
    entityId: id,
    details: { from: order.status, to: newStatus },
  });

  return c.json({ success: true });
});

// PATCH /api/orders/admin/:id/payment-status — confirmer/rejeter un paiement
// manuel (Airtel Money, virement...) après vérification humaine côté Admin.
// Pour un provider API futur, cette même transition pourra être déclenchée
// automatiquement par un endpoint de webhook dédié plutôt que par un humain.
orderRoutes.patch("/admin/:id/payment-status", requirePermission("payments.manage"), async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json<{
    status: "confirmed" | "failed" | "cancelled";
    paymentId?: string;
    reference?: string;
  }>();

  const validStatuses = ["confirmed", "failed", "cancelled"];
  if (!validStatuses.includes(body.status)) {
    return apiError(c, 400, "VALIDATION_ERROR", "Statut de paiement invalide.");
  }

  const order = await c.env.DB
    .prepare("SELECT id, payment_method_id FROM orders WHERE id = ?")
    .bind(id)
    .first<{ id: string; payment_method_id: string | null }>();
  if (!order) return apiError(c, 404, "NOT_FOUND", "Commande introuvable.");
  if (!order.payment_method_id) {
    return apiError(c, 400, "BAD_REQUEST", "Cette commande n'a pas de moyen de paiement associé.");
  }

  // Une commande peut conserver plusieurs tentatives de paiement. Quand
  // paymentId est fourni, on ne modifie QUE cette tentative. Pour compatibilité
  // avec les anciens clients, l'absence de paymentId cible la dernière tentative
  // en attente ; elle est donc toujours déterministe et ne modifie jamais toute
  // l'historique de paiement de la commande.
  const payment = body.paymentId
    ? await c.env.DB
        .prepare(
          `SELECT id, status FROM order_payments
           WHERE id = ? AND order_id = ?`
        )
        .bind(body.paymentId, id)
        .first<{ id: string; status: string }>()
    : await c.env.DB
        .prepare(
          `SELECT id, status FROM order_payments
           WHERE order_id = ? AND status = 'pending'
           ORDER BY created_at DESC LIMIT 1`
        )
        .bind(id)
        .first<{ id: string; status: string }>();

  if (!payment) {
    return apiError(c, 404, "NOT_FOUND", "Paiement introuvable pour cette commande.");
  }

  if (payment.status !== "pending") {
    return apiError(c, 409, "CONFLICT", "Ce paiement a déjà été traité.");
  }

  await c.env.DB
    .prepare(
      `UPDATE order_payments SET status = ?, reference = COALESCE(?, reference),
         confirmed_at = CASE WHEN ? = 'confirmed' THEN datetime('now') ELSE confirmed_at END
       WHERE id = ? AND order_id = ? AND status = 'pending'`
    )
    .bind(body.status, body.reference ?? null, body.status, payment.id, id)
    .run();

  // Le statut consolidé de la commande reflète la tentative traitée.
  await c.env.DB
    .prepare("UPDATE orders SET payment_status = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(body.status, id)
    .run();

  await writeAuditLog(c.env, {
    userId: user.id,
    userName: user.fullName,
    action: "order.payment_status_change",
    entityType: "order",
    entityId: id,
    details: { newStatus: body.status },
  });

  return c.json({ success: true });
});
