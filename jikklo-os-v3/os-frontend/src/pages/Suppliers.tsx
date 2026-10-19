import { useEffect, useState, FormEvent } from "react";
import { api, ApiError } from "../api/client";

type Supplier = { id: string; name: string; contact_name: string | null; phone: string | null; email: string | null };

export function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<{ suppliers: Supplier[] }>("/api/admin/suppliers").then((r) => setSuppliers(r.suppliers));
  }
  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/api/admin/suppliers", { name, phone });
      setName(""); setPhone(""); setShowForm(false); load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-jikklo-navy">Fournisseurs</h1>
        <button onClick={() => setShowForm((v) => !v)} className="bg-jikklo-navy text-white text-sm px-4 py-2 rounded-lg">
          {showForm ? "Annuler" : "+ Nouveau fournisseur"}
        </button>
      </div>
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border rounded-xl p-4 space-y-3">
          {error && <div className="text-sm text-red-600">{error}</div>}
          <input required placeholder="Nom du fournisseur" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Téléphone" value={phone} onChange={(e) => setPhone(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          <button className="bg-jikklo-accent text-white text-sm px-4 py-2 rounded-lg">Créer</button>
        </form>
      )}
      <div className="bg-white border rounded-xl overflow-hidden">
        {suppliers.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">Aucun fournisseur enregistré.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr><th className="px-4 py-2 font-medium">Nom</th><th className="px-4 py-2 font-medium">Téléphone</th></tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="border-t"><td className="px-4 py-2">{s.name}</td><td className="px-4 py-2">{s.phone ?? "—"}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
