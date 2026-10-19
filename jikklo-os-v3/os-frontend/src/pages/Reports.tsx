import { useEffect, useState } from "react";
import { api } from "../api/client";

type Order = {
  order_number: string;
  customer_name: string;
  status: string;
  total: number;
  currency: string;
  created_at: string;
};

function downloadCsv(orders: Order[]) {
  const header = "Numero,Client,Statut,Total,Devise,Date\n";
  const rows = orders
    .map((o) => `${o.order_number},"${o.customer_name}",${o.status},${o.total},${o.currency},${o.created_at}`)
    .join("\n");
  const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `jikklo-commandes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function Reports() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    api.get<{ orders: Order[] }>("/api/orders/admin").then((r) => setOrders(r.orders));
  }, []);

  const totalRevenue = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-jikklo-navy">Rapports</h1>
        <button
          onClick={() => downloadCsv(orders)}
          disabled={orders.length === 0}
          className="bg-jikklo-navy text-white text-sm px-4 py-2 rounded-lg disabled:opacity-40"
        >
          Exporter en CSV
        </button>
      </div>

      <div className="bg-white rounded-xl border p-4">
        <div className="text-xs text-slate-500">Chiffre d'affaires total (hors annulées)</div>
        <div className="text-2xl font-semibold text-jikklo-navy">
          {totalRevenue.toLocaleString()} FC
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        {orders.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">Aucune commande à analyser pour l'instant.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">N°</th>
                <th className="px-4 py-2 font-medium">Client</th>
                <th className="px-4 py-2 font-medium">Statut</th>
                <th className="px-4 py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 50).map((o) => (
                <tr key={o.order_number} className="border-t">
                  <td className="px-4 py-2 font-mono text-xs">{o.order_number}</td>
                  <td className="px-4 py-2">{o.customer_name}</td>
                  <td className="px-4 py-2 text-slate-500">{o.status}</td>
                  <td className="px-4 py-2">{o.total.toLocaleString()} {o.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
