import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  status: string;
  total: number;
  currency: string;
  created_at: string;
  payment_method_id: string | null;
  payment_method_name: string | null;
  payment_status: string;
};

const STATUS_LABELS: Record<string, string> = {
  new: "Nouvelle",
  confirmed: "Confirmée",
  preparing: "En préparation",
  ready: "Prête",
  delivering: "En livraison",
  delivered: "Livrée",
  completed: "Terminée",
  cancelled: "Annulée",
};

const NEXT_STATUS: Record<string, string[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["delivering", "delivered", "cancelled"],
  delivering: ["delivered", "cancelled"],
  delivered: ["completed"],
  completed: [],
  cancelled: [],
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  failed: "Échoué",
  cancelled: "Annulé",
};

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
};

type PaymentDetail = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  reference: string | null;
  created_at: string;
  confirmed_at: string | null;
  payment_method_name: string;
  payment_method_kind: string;
};

export function Orders() {
  const { hasPermission } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [payments, setPayments] = useState<Record<string, PaymentDetail[]>>({});

  function load() {
    const query = filter ? `?status=${filter}` : "";
    api
      .get<{ orders: Order[] }>(`/api/orders/admin${query}`)
      .then((r) => setOrders(r.orders))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Impossible de charger les commandes."));
  }

  useEffect(load, [filter]);

  async function updateStatus(id: string, status: string) {
    setError(null);
    try {
      await api.patch(`/api/orders/admin/${id}/status`, { status });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors du changement de statut.");
    }
  }

  async function togglePaymentDetails(orderId: string) {
    if (expandedId === orderId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(orderId);
    if (!payments[orderId]) {
      try {
        const r = await api.get<{ payments: PaymentDetail[] }>(`/api/orders/admin/${orderId}`);
        setPayments((prev) => ({ ...prev, [orderId]: r.payments ?? [] }));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Impossible de charger le paiement.");
      }
    }
  }

  async function setPaymentStatus(paymentId: string, orderId: string, status: "confirmed" | "failed" | "cancelled") {
    setError(null);
    try {
      await api.patch(`/api/orders/admin/${orderId}/payment-status`, { status, paymentId });
      load();
      const r = await api.get<{ payments: PaymentDetail[] }>(`/api/orders/admin/${orderId}`);
      setPayments((prev) => ({ ...prev, [orderId]: r.payments ?? [] }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de la mise à jour du paiement.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold text-jikklo-navy">Commandes</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="bg-white border rounded-xl divide-y">
        {orders.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">Aucune commande pour le moment.</p>
        ) : (
          orders.map((o) => (
            <div key={o.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-slate-500">{o.order_number}</div>
                  <div className="text-sm font-medium text-slate-800 break-words">{o.customer_name}</div>
                  <div className="text-sm">{o.total.toLocaleString()} {o.currency}</div>
                  <div className="text-xs text-slate-400">{new Date(o.created_at).toLocaleDateString("fr-FR")}</div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                  {STATUS_LABELS[o.status] ?? o.status}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {o.payment_method_name ? (
                  <button
                    onClick={() => togglePaymentDetails(o.id)}
                    className={`text-xs px-3 py-1.5 rounded-full ${PAYMENT_STATUS_STYLES[o.payment_status] ?? "bg-slate-100 text-slate-500"}`}
                  >
                    {o.payment_method_name} · {PAYMENT_STATUS_LABELS[o.payment_status] ?? o.payment_status}
                    {expandedId === o.id ? " ▲" : " ▼"}
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">Pas de paiement</span>
                )}
                {NEXT_STATUS[o.status]?.length > 0 && (
                  <select
                    onChange={(e) => e.target.value && updateStatus(o.id, e.target.value)}
                    defaultValue=""
                    className="border rounded px-2 py-1 text-xs"
                  >
                    <option value="" disabled>Changer le statut</option>
                    {NEXT_STATUS[o.status].map((st) => (
                      <option key={st} value={st}>{STATUS_LABELS[st]}</option>
                    ))}
                  </select>
                )}
              </div>

              {expandedId === o.id && o.payment_method_name && (
                <div className="bg-slate-50 border rounded-lg p-3">
                  {!payments[o.id] ? (
                    <p className="text-xs text-slate-400">Chargement…</p>
                  ) : payments[o.id].length === 0 ? (
                    <p className="text-xs text-slate-400">Aucun paiement enregistré pour cette commande.</p>
                  ) : (
                    <div className="space-y-3">
                      {payments[o.id].map((p) => (
                        <div key={p.id} className="space-y-2 text-xs">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="font-medium">{p.payment_method_name}</span>
                            <span>{p.amount.toLocaleString()} {p.currency}</span>
                            <span className={`px-2 py-0.5 rounded-full ${PAYMENT_STATUS_STYLES[p.status] ?? "bg-slate-100 text-slate-500"}`}>
                              {PAYMENT_STATUS_LABELS[p.status] ?? p.status}
                            </span>
                          </div>
                          <div className="text-slate-500 break-all">Référence : {p.reference ?? "—"}</div>
                          <div className="text-slate-400">{new Date(p.created_at).toLocaleString("fr-FR")}</div>
                          {hasPermission("payments.manage") && p.status === "pending" && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => setPaymentStatus(p.id, o.id, "confirmed")}
                                className="px-3 py-1.5 rounded bg-green-600 text-white"
                              >
                                Confirmer le paiement
                              </button>
                              <button
                                onClick={() => setPaymentStatus(p.id, o.id, "failed")}
                                className="px-3 py-1.5 rounded bg-red-600 text-white"
                              >
                                Rejeter
                              </button>
                            </div>
                          )}
                          {!hasPermission("payments.manage") && p.status === "pending" && (
                            <div className="text-slate-400">
                              Permission « payments.manage » requise pour confirmer ou rejeter.
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
