import { useEffect, useState } from "react";
import { api } from "../api/client";

type Customer = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  order_count: number;
  total_spent: number;
  last_order_at: string | null;
};

export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    api.get<{ customers: Customer[] }>("/api/admin/customers").then((r) => setCustomers(r.customers));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-jikklo-navy">Clients</h1>
      <div className="bg-white border rounded-xl overflow-hidden">
        {customers.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">Aucun client pour le moment.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Nom</th>
                <th className="px-4 py-2 font-medium">Téléphone</th>
                <th className="px-4 py-2 font-medium">Commandes</th>
                <th className="px-4 py-2 font-medium">Total dépensé</th>
                <th className="px-4 py-2 font-medium">Dernière commande</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-2">{c.full_name}</td>
                  <td className="px-4 py-2">{c.phone}</td>
                  <td className="px-4 py-2">{c.order_count}</td>
                  <td className="px-4 py-2">{c.total_spent.toLocaleString()} FC</td>
                  <td className="px-4 py-2 text-slate-400 text-xs">
                    {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString("fr-FR") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
