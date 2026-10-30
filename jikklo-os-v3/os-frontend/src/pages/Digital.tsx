import { useEffect, useState, FormEvent } from "react";
import { api, ApiError } from "../api/client";

type Service = { id: string; name: string; description: string | null; price: number | null; enabled: number };

// Convertit la saisie d'un prix : vide = « prix sur demande » (null).
function parsePrice(input: string): number | null | "invalid" {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : "invalid";
}

export function Digital() {
  const [services, setServices] = useState<Service[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  function load() {
    api
      .get<{ services: Service[] }>("/api/admin/digital/services")
      .then((r) => setServices(r.services))
      .catch((err) => setListError(err instanceof ApiError ? err.message : "Impossible de charger les services."));
  }
  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = parsePrice(price);
    if (parsed === "invalid") {
      setError("Le prix doit être un nombre positif (ou vide pour « prix sur demande »).");
      return;
    }
    try {
      await api.post("/api/admin/digital/services", {
        name,
        description: description || undefined,
        price: parsed ?? undefined,
      });
      setName("");
      setDescription("");
      setPrice("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur.");
    }
  }

  async function toggle(id: string, enabled: number) {
    setListError(null);
    try {
      await api.patch(`/api/admin/digital/services/${id}/enabled`, { enabled: enabled === 0 });
      load();
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Erreur.");
    }
  }

  function startEdit(s: Service) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditDescription(s.description ?? "");
    setEditPrice(s.price === null ? "" : String(s.price));
    setEditError(null);
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditError(null);
    const parsed = parsePrice(editPrice);
    if (parsed === "invalid") {
      setEditError("Le prix doit être un nombre positif (ou vide pour « prix sur demande »).");
      return;
    }
    try {
      await api.patch(`/api/admin/digital/services/${editingId}`, {
        name: editName,
        description: editDescription,
        price: parsed,
      });
      setEditingId(null);
      load();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Erreur lors de la modification.");
    }
  }

  async function remove(s: Service) {
    if (!window.confirm(`Supprimer le service « ${s.name} » ?`)) return;
    setListError(null);
    try {
      await api.delete(`/api/admin/digital/services/${s.id}`);
      if (editingId === s.id) setEditingId(null);
      load();
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Erreur lors de la suppression.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-jikklo-navy">Jikklo Digital</h1>
        <button onClick={() => setShowForm((v) => !v)} className="bg-jikklo-navy text-white text-sm px-4 py-2 rounded-lg shrink-0">
          {showForm ? "Annuler" : "+ Nouveau service"}
        </button>
      </div>
      <p className="text-sm text-slate-500">
        Un service apparaît sur la page Digital du site uniquement lorsqu'il est <strong>activé</strong>. Les nouveaux
        services sont créés désactivés : active-les explicitement une fois la conformité légale validée.
      </p>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border rounded-xl p-4 space-y-3">
          {error && <div className="text-sm text-red-600">{error}</div>}
          <input required placeholder="Nom du service" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          <textarea placeholder="Description (affichée sur le site)" value={description} rows={3}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Prix en CDF (laisser vide = prix sur demande)" value={price} inputMode="decimal"
            onChange={(e) => setPrice(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          <button className="bg-jikklo-accent text-white text-sm px-4 py-2 rounded-lg">Créer (désactivé)</button>
        </form>
      )}

      {listError && <div className="text-sm text-red-600">{listError}</div>}

      <div className="bg-white border rounded-xl divide-y">
        {services.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">Aucun service Digital pour le moment.</p>
        ) : (
          services.map((s) => (
            <div key={s.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800 break-words">{s.name}</div>
                  {s.description && <div className="text-xs text-slate-500 break-words">{s.description}</div>}
                  <div className="text-xs text-slate-500">
                    {s.price === null ? "Prix sur demande" : `${s.price.toLocaleString()} CDF`}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${s.enabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                  {s.enabled ? "Activé" : "Désactivé"}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <button onClick={() => toggle(s.id, s.enabled)} className="text-jikklo-navy text-xs font-medium underline">
                  {s.enabled ? "Désactiver (retirer du site)" : "Activer (afficher sur le site)"}
                </button>
                <button
                  type="button"
                  onClick={() => (editingId === s.id ? setEditingId(null) : startEdit(s))}
                  className="text-jikklo-navy text-xs font-medium underline"
                >
                  {editingId === s.id ? "Fermer" : "Modifier"}
                </button>
                <button type="button" onClick={() => remove(s)} className="text-red-600 text-xs font-medium underline">
                  Supprimer
                </button>
              </div>

              {editingId === s.id && (
                <form onSubmit={handleSaveEdit} className="bg-slate-50 border rounded-lg p-3 space-y-3">
                  {editError && <div className="text-sm text-red-600">{editError}</div>}
                  <input required placeholder="Nom du service" value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                  <textarea placeholder="Description" value={editDescription} rows={3}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="Prix en CDF (vide = prix sur demande)" value={editPrice} inputMode="decimal"
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                  <button className="bg-jikklo-accent text-white text-sm px-4 py-2 rounded-lg">
                    Enregistrer les modifications
                  </button>
                </form>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
