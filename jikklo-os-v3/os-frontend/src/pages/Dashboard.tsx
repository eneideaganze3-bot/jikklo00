import { useEffect, useState } from "react";
import { api } from "../api/client";

type DashboardData = {
  revenueToday: number;
  ordersToday: number;
  pendingOrders: number;
  lowStockProducts: { id: string; name: string; quantity: number; min_threshold: number }[];
  outOfStockCount: number;
  totalCustomers: number;
  salesByActivity: { activity: string; total: number }[];
  recentActivity: { action: string; user_name: string; created_at: string }[];
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-2xl font-semibold text-jikklo-navy">{value}</div>
    </div>
  );
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardData>("/api/admin/dashboard")
      .then(setData)
      .catch(() => setError("Impossible de charger le dashboard."));
  }, []);

  if (error) return <div className="text-red-600 text-sm">{error}</div>;
  if (!data) return <div className="text-slate-400 text-sm">Chargement…</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-jikklo-navy">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="CA aujourd'hui" value={`${data.revenueToday.toLocaleString()} FC`} />
        <StatCard label="Commandes du jour" value={data.ordersToday} />
        <StatCard label="En attente" value={data.pendingOrders} />
        <StatCard label="Clients" value={data.totalCustomers} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="font-medium text-sm text-slate-700 mb-3">Ventes par activité</h2>
          {data.salesByActivity.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune donnée disponible.</p>
          ) : (
            <ul className="space-y-2">
              {data.salesByActivity.map((row) => (
                <li key={row.activity} className="flex justify-between text-sm">
                  <span className="capitalize text-slate-600">{row.activity}</span>
                  <span className="font-medium">{row.total.toLocaleString()} FC</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="font-medium text-sm text-slate-700 mb-3">
            Stock faible {data.outOfStockCount > 0 && (
              <span className="text-red-600">({data.outOfStockCount} en rupture)</span>
            )}
          </h2>
          {data.lowStockProducts.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune alerte de stock.</p>
          ) : (
            <ul className="space-y-2">
              {data.lowStockProducts.map((p) => (
                <li key={p.id} className="flex justify-between text-sm">
                  <span className="text-slate-600">{p.name}</span>
                  <span className="font-medium text-amber-600">
                    {p.quantity} / min {p.min_threshold}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="font-medium text-sm text-slate-700 mb-3">Activité récente</h2>
        {data.recentActivity.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune activité récente.</p>
        ) : (
          <ul className="space-y-2">
            {data.recentActivity.map((a, i) => (
              <li key={i} className="text-sm text-slate-600 flex justify-between">
                <span>
                  <span className="font-medium">{a.user_name}</span> — {a.action}
                </span>
                <span className="text-slate-400 text-xs">
                  {new Date(a.created_at).toLocaleString("fr-FR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
