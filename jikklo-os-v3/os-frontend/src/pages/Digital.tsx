import { useEffect, useState, FormEvent } from "react";
import { api, ApiError } from "../api/client";

type Service = { id: string; name: string; description: string | null; price: number | null; enabled: number };

export function Digital() {
  const [services, setServices] = useState<Service[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<{ services: Service[] }>("/api/admin/digital/services").then((r) => setServices(r.services));
  }
  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/api/admin/digital/services", { name });
      setName(""); setShowForm(false); load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur.");
    }
  }

  async function toggle(id: string, enabled: number) {
    await api.patch(`/api/admin/digital/services/${id}/enabled`, { enabled: enabled === 0 });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-jikklo-navy">Jikklo Digital</h1>
        <button onClick={() => setShowForm((v) => !v)} className="bg-jikklo-navy text-white text-sm px-4 py-2 rounded-lg">
          {showForm ? "Annuler" : "+ Nouveau service"}
        </button>
      </div>
      <p className="text-sm text-slate-500">
        Les nouveaux services sont créés désactivés par défaut — à activer explicitement une fois la conformité légale validée.
      </p>
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border rounded-xl p-4 space-y-3">
          {error && <div className="text-sm text-red-600">{error}</div>}
          <input required placeholder="Nom du service" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          <button className="bg-jikklo-accent text-white text-sm px-4 py-2 rounded-lg">Créer (désactivé)</button>
        </form>
      )}
      <div className="bg-white border rounded-xl overflow-hidden">
        {services.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">Aucun service Digital pour le moment.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr><th className="px-4 py-2 font-medium">Nom</th><th className="px-4 py-2 font-medium">Statut</th><th className="px-4 py-2"></th></tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-2">{s.name}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.enabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {s.enabled ? "Activé" : "Désactivé"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => toggle(s.id, s.enabled)} className="text-jikklo-navy text-xs font-medium underline">
                      {s.enabled ? "Désactiver" : "Activer"}
                    </button>
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
