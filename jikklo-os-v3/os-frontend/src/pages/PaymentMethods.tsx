import { useEffect, useState, FormEvent } from "react";
import { api, ApiError } from "../api/client";

type PaymentMethod = {
  id: string;
  code: string;
  name: string;
  kind: "manual" | "api";
  enabled: number;
  currency: string;
  display_order: number;
  instructions: string | null;
  config: Record<string, unknown> | null;
};

// Admin → Paramètres → Paiements (spécification section 5). Activer un
// moyen ici le fait apparaître immédiatement au checkout du site public,
// sans redéploiement — voir GET /api/public/payment-methods.
export function PaymentMethods() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Champs du formulaire de création
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"manual" | "api">("manual");
  const [currency, setCurrency] = useState("CDF");

  function load() {
    api.get<{ paymentMethods: PaymentMethod[] }>("/api/admin/payment-methods").then((r) => setMethods(r.paymentMethods));
  }
  useEffect(load, []);

  async function toggleEnabled(m: PaymentMethod) {
    setError(null);
    try {
      await api.patch(`/api/admin/payment-methods/${m.id}`, { enabled: m.enabled === 0 });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de modifier ce moyen de paiement.");
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/api/admin/payment-methods", { code, name, kind, currency });
      setCode(""); setName(""); setKind("manual"); setCurrency("CDF"); setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur.");
    }
  }

  async function saveEditing(field: "instructions" | "config", value: string) {
    if (!editing) return;
    setError(null);
    try {
      if (field === "instructions") {
        await api.patch(`/api/admin/payment-methods/${editing.id}`, { instructions: value });
      } else {
        let parsed: Record<string, unknown> = {};
        if (value.trim()) parsed = JSON.parse(value);
        await api.patch(`/api/admin/payment-methods/${editing.id}`, { config: parsed });
      }
      load();
      setEditing(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "JSON invalide ou erreur d'enregistrement.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-jikklo-navy dark:text-white">Moyens de paiement</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Seuls les moyens activés apparaissent au checkout du site public. Aucune clé API secrète ne se configure ici.
          </p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="bg-jikklo-navy text-white text-sm px-4 py-2 rounded-lg shrink-0">
          {showForm ? "Annuler" : "+ Nouveau moyen"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-800 border rounded-xl p-4 space-y-3">
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="grid sm:grid-cols-2 gap-3">
            <input required placeholder="Code (ex: airtel_money)" value={code} onChange={(e) => setCode(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm" />
            <input required placeholder="Nom affiché" value={name} onChange={(e) => setName(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm" />
            <select value={kind} onChange={(e) => setKind(e.target.value as "manual" | "api")} className="border rounded-lg px-3 py-2 text-sm">
              <option value="manual">Manuel (instructions affichées au client)</option>
              <option value="api">API / automatique (nécessite intégration technique)</option>
            </select>
            <input placeholder="Devise (CDF, USD...)" value={currency} onChange={(e) => setCurrency(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <button className="bg-jikklo-accent text-white text-sm px-4 py-2 rounded-lg">Créer (désactivé par défaut)</button>
        </form>
      )}

      {error && !showForm && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      <div className="bg-white dark:bg-slate-800 border rounded-xl divide-y">
        {methods.map((m) => (
          <div key={m.id} className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {m.name} <span className="text-xs text-slate-400">({m.code})</span>
                </div>
                <div className="text-xs text-slate-500">
                  {m.kind === "manual" ? "Manuel" : "API"} · {m.currency}
                  {m.kind === "api" && <span className="ml-1 text-amber-600">— intégration technique requise avant activation réelle</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={() => setEditing(editing?.id === m.id ? null : m)} className="text-xs text-jikklo-accent underline">
                  Configurer
                </button>
                <button
                  onClick={() => toggleEnabled(m)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                    m.enabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {m.enabled ? "Activé" : "Désactivé"}
                </button>
              </div>
            </div>

            {editing?.id === m.id && (
              <div className="pt-2 border-t space-y-3">
                <div>
                  <label className="text-xs text-slate-500">Instructions affichées au client (paiement manuel)</label>
                  <textarea
                    defaultValue={m.instructions ?? ""}
                    onBlur={(e) => saveEditing("instructions", e.target.value)}
                    rows={2}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                    placeholder="Ex: Envoyez le montant au 09xx xxx xxx puis indiquez la référence."
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">
                    Configuration (JSON non sensible — numéro marchand, titulaire, IBAN... jamais de clé API/secret)
                  </label>
                  <textarea
                    defaultValue={m.config ? JSON.stringify(m.config, null, 2) : ""}
                    onBlur={(e) => saveEditing("config", e.target.value)}
                    rows={4}
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono"
                    placeholder='{"merchantNumber": "09xx xxx xxx"}'
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
