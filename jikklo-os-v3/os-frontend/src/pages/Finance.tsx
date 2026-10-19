import { useEffect, useState, FormEvent } from "react";
import { api, ApiError } from "../api/client";

type Summary = { salesRevenue: number; estimatedMargin: number; manualIncome: number; manualExpense: number; disclaimer: string };
type Entry = { id: string; type: string; category: string; amount: number; created_at: string };

export function Finance() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<Summary>("/api/admin/finance/summary").then(setSummary);
    api.get<{ entries: Entry[] }>("/api/admin/finance/entries").then((r) => setEntries(r.entries));
  }
  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/api/admin/finance/entries", { type, category, amount: Number(amount) });
      setCategory(""); setAmount(""); setShowForm(false); load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-jikklo-navy">Finance</h1>
        <button onClick={() => setShowForm((v) => !v)} className="bg-jikklo-navy text-white text-sm px-4 py-2 rounded-lg">
          {showForm ? "Annuler" : "+ Nouvelle entrée"}
        </button>
      </div>
      {summary && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2">{summary.disclaimer}</div>
      )}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border p-4"><div className="text-xs text-slate-500">Ventes</div><div className="text-lg font-semibold">{summary.salesRevenue.toLocaleString()} FC</div></div>
          <div className="bg-white rounded-xl border p-4"><div className="text-xs text-slate-500">Marge estimée</div><div className="text-lg font-semibold">{summary.estimatedMargin.toLocaleString()} FC</div></div>
          <div className="bg-white rounded-xl border p-4"><div className="text-xs text-slate-500">Recettes manuelles</div><div className="text-lg font-semibold">{summary.manualIncome.toLocaleString()} FC</div></div>
          <div className="bg-white rounded-xl border p-4"><div className="text-xs text-slate-500">Dépenses</div><div className="text-lg font-semibold">{summary.manualExpense.toLocaleString()} FC</div></div>
        </div>
      )}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border rounded-xl p-4 space-y-3">
          {error && <div className="text-sm text-red-600">{error}</div>}
          <select value={type} onChange={(e) => setType(e.target.value as "income" | "expense")} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="expense">Dépense</option>
            <option value="income">Recette</option>
          </select>
          <input required placeholder="Catégorie (ex: loyer, achat...)" value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          <input required type="number" placeholder="Montant" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          <button className="bg-jikklo-accent text-white text-sm px-4 py-2 rounded-lg">Enregistrer</button>
        </form>
      )}
      <div className="bg-white border rounded-xl overflow-hidden">
        {entries.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">Aucune entrée manuelle.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr><th className="px-4 py-2 font-medium">Type</th><th className="px-4 py-2 font-medium">Catégorie</th><th className="px-4 py-2 font-medium">Montant</th></tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-4 py-2">{e.type === "income" ? "Recette" : "Dépense"}</td>
                  <td className="px-4 py-2">{e.category}</td>
                  <td className="px-4 py-2">{e.amount.toLocaleString()} FC</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
