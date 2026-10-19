import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";

type PriceRow = {
  product_id: string;
  name: string;
  unit: string;
  sale_price: number;
  purchase_price: number;
  currency: string;
  updated_at: string;
};

export function Pricing() {
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<{ prices: PriceRow[] }>("/api/admin/pricing").then((r) => setPrices(r.prices));
  }

  useEffect(load, []);

  async function handleSave(productId: string) {
    setError(null);
    try {
      await api.patch(`/api/admin/pricing/${productId}`, { salePrice: Number(newPrice) });
      setEditingId(null);
      setNewPrice("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur de mise à jour.");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-jikklo-navy">Prix</h1>
      <p className="text-sm text-slate-500">
        Chaque modification est enregistrée dans l'historique et se répercute automatiquement sur jikklo.com.
      </p>
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="bg-white border rounded-xl overflow-hidden">
        {prices.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">Aucun prix enregistré.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Produit</th>
                <th className="px-4 py-2 font-medium">Prix actuel</th>
                <th className="px-4 py-2 font-medium">Dernière mise à jour</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {prices.map((p) => (
                <tr key={p.product_id} className="border-t">
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-4 py-2">
                    {editingId === p.product_id ? (
                      <input
                        autoFocus
                        type="number"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        className="border rounded px-2 py-1 w-28 text-sm"
                      />
                    ) : (
                      `${p.sale_price.toLocaleString()} ${p.currency}`
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-400 text-xs">
                    {new Date(p.updated_at).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {editingId === p.product_id ? (
                      <div className="space-x-2">
                        <button
                          onClick={() => handleSave(p.product_id)}
                          className="text-jikklo-accent text-xs font-medium"
                        >
                          Enregistrer
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-slate-400 text-xs"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(p.product_id);
                          setNewPrice(String(p.sale_price));
                        }}
                        className="text-jikklo-navy text-xs font-medium underline"
                      >
                        Modifier
                      </button>
                    )}
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
