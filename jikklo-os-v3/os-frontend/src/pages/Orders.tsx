import { useEffect, useState, Fragment } from "react";
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
    api.get<{ orders: Order[] }>(`/api/orders/admin${query}`).then((r) => setOrders(r.orders));
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
      const r = await api.get<{ payments: PaymentDetail[] }>(`/api/orders/admin/${orderId}`);
      setPayments((prev) => ({ ...prev, [orderId]: r.payments ?? [] }));
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

      <div className="bg-white border rounded-xl overflow-hidden">
        {orders.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">Aucune commande pour le moment.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">N°</th>
                <th className="px-4 py-2 font-medium">Client</th>
                <th className="px-4 py-2 font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Statut</th>
                <th className="px-4 py-2 font-medium">Paiement</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <Fragment key={o.id}>
                <tr className="border-t">
                  <td className="px-4 py-2 font-mono text-xs">{o.order_number}</td>
                  <td className="px-4 py-2">{o.customer_name}</td>
                  <td className="px-4 py-2">{o.total.toLocaleString()} {o.currency}</td>
                  <td className="px-4 py-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {STATUS_LABELS[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {o.payment_method_name ? (
                      <button
                        onClick={() => togglePaymentDetails(o.id)}
                        className={`text-xs px-2 py-0.5 rounded-full ${PAYMENT_STATUS_STYLES[o.payment_status] ?? "bg-slate-100 text-slate-500"}`}
                      >
                        {o.payment_method_name} · {PAYMENT_STATUS_LABELS[o.payment_status] ?? o.payment_status}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-400 text-xs">
                    {new Date(o.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {NEXT_STATUS[o.status]?.length > 0 && (
                      <select
                        onChange={(e) => e.target.value && updateStatus(o.id, e.target.value)}
                        defaultValue=""
                        className="border rounded px-2 py-1 text-xs"
                      >
                        <option value="" disabled>Changer statut</option>
                        {NEXT_STATUS[o.status].map((s) => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
                {expandedId === o.id && o.payment_method_name && (
                  <tr className="border-t bg-slate-50">
                    <td colSpan={7} className="px-4 py-3">
                      {!payments[o.id] ? (
                        <p className="text-xs text-slate-400">Chargement…</p>
                      ) : payments[o.id].length === 0 ? (
                        <p className="text-xs text-slate-400">Aucun paiement enregistré pour cette commande.</p>
                      ) : (
                        <div className="space-y-2">
                          {payments[o.id].map((p) => (
                            <div key={p.id} className="flex flex-wrap items-center gap-3 text-xs">
                              <span className="font-medium">{p.payment_method_name}</span>
                              <span>{p.amount.toLocaleString()} {p.currency}</span>
                              <span className="text-slate-400">Référence : {p.reference ?? "—"}</span>
                              <span className="text-slate-400">
                                {new Date(p.created_at).toLocaleString("fr-FR")}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full ${PAYMENT_STATUS_STYLES[p.status] ?? "bg-slate-100 text-slate-500"}`}>
                                {PAYMENT_STATUS_LABELS[p.status] ?? p.status}
                              </span>
                              {hasPermission("payments.manage") && p.status === "pending" && (
                                <span className="flex gap-2 ml-auto">
                                  <button
                                    onClick={() => setPaymentStatus(p.id, o.id, "confirmed")}
                                    className="px-2 py-1 rounded bg-green-600 text-white"
                                  >
                                    Confirmer
                                  </button>
                                  <button
                                    onClick={() => setPaymentStatus(p.id, o.id, "failed")}
                                    className="px-2 py-1 rounded bg-red-600 text-white"
                                  >
                                    Rejeter
                                  </button>
                                </span>
                              )}
                              {!hasPermission("payments.manage") && p.status === "pending" && (
                                <span className="text-slate-400 ml-auto">
                                  Permission "payments.manage" requise pour confirmer/rejeter.
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
