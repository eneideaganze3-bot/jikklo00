import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";

type InvRow = {
  product_id: string;
  name: string;
  unit: string;
  quantity: number;
  min_threshold: number;
  stock_status: "ok" | "low_stock" | "out_of_stock";
};

const STATUS_STYLES: Record<string, string> = {
  ok: "bg-green-100 text-green-700",
  low_stock: "bg-amber-100 text-amber-700",
  out_of_stock: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  ok: "OK",
  low_stock: "Stock faible",
  out_of_stock: "Rupture",
};

export function Inventory() {
  const [rows, setRows] = useState<InvRow[]>([]);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .get<{ inventory: InvRow[] }>("/api/admin/inventory")
      .then((r) => setRows(r.inventory))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Impossible de charger le stock."));
  }

  useEffect(load, []);

  // « entree » ajoute au stock ; « sortie » retire (perte, casse, correction).
  async function handleMovement(productId: string, kind: "entree" | "sortie") {
    setError(null);
    const qty = Math.abs(Number(quantity));
    if (!qty) {
      setError("Saisis une quantité.");
      return;
    }
    try {
      await api.post("/api/admin/inventory/movement", {
        productId,
        type: kind === "entree" ? "entree" : "correction",
        quantity: kind === "entree" ? qty : -qty,
        reason: kind === "entree" ? "Réapprovisionnement" : "Sortie / correction manuelle",
      });
      setMovingId(null);
      setQuantity("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors du mouvement.");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-jikklo-navy">Stock</h1>
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="bg-white border rounded-xl overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">Aucune donnée de stock.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Produit</th>
                <th className="px-4 py-2 font-medium">Quantité</th>
                <th className="px-4 py-2 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.product_id} className="border-t align-top">
                  <td className="px-4 py-2">
                    <div>{r.name}</div>
                    {movingId === r.product_id ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          autoFocus
                          type="number"
                          min="0"
                          inputMode="decimal"
                          placeholder="Quantité"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          className="border rounded px-2 py-1 w-24 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => handleMovement(r.product_id, "entree")}
                          className="text-xs font-medium px-3 py-1.5 rounded bg-jikklo-accent text-white"
                        >
                          + Entrée
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMovement(r.product_id, "sortie")}
                          className="text-xs font-medium px-3 py-1.5 rounded bg-red-600 text-white"
                        >
                          − Sortie
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMovingId(null);
                            setQuantity("");
                          }}
                          className="text-slate-500 text-xs underline"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setMovingId(r.product_id);
                          setQuantity("");
                          setError(null);
                        }}
                        className="mt-1 text-jikklo-navy text-xs font-medium underline"
                      >
                        Ajuster le stock
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {r.quantity} {r.unit}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLES[r.stock_status]}`}>
                      {STATUS_LABELS[r.stock_status]}
                    </span>
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
