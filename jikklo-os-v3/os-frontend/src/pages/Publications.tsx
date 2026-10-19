import { useEffect, useState, FormEvent } from "react";
import { api, ApiError } from "../api/client";

type Publication = {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  status: "draft" | "published";
  display_order: number;
  published_at: string | null;
};

// Admin → Publications — section "Nouveautés Jikklo" (spécification section
// 6). Publier ici fait apparaître la publication sur le site public sans
// redéploiement — voir GET /api/public/publications.
export function Publications() {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");

  function load() {
    api.get<{ publications: Publication[] }>("/api/admin/publications").then((r) => setPublications(r.publications));
  }
  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/api/admin/publications", {
        title, body: body || undefined, imageUrl: imageUrl || undefined,
        ctaLabel: ctaLabel || undefined, ctaUrl: ctaUrl || undefined,
      });
      setTitle(""); setBody(""); setImageUrl(""); setCtaLabel(""); setCtaUrl(""); setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur.");
    }
  }

  async function togglePublish(p: Publication) {
    await api.patch(`/api/admin/publications/${p.id}`, { status: p.status === "published" ? "draft" : "published" });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Supprimer définitivement cette publication ?")) return;
    await api.delete(`/api/admin/publications/${id}`);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-jikklo-navy dark:text-white">Publications</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Apparaît dans la section « Nouveautés Jikklo » du site public une fois publiée.
          </p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="bg-jikklo-navy text-white text-sm px-4 py-2 rounded-lg shrink-0">
          {showForm ? "Annuler" : "+ Nouvelle publication"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-800 border rounded-xl p-4 space-y-3">
          {error && <div className="text-sm text-red-600">{error}</div>}
          <input required placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          <textarea placeholder="Texte" value={body} onChange={(e) => setBody(e.target.value)} rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          <input placeholder="URL de l'image" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          <div className="grid sm:grid-cols-2 gap-3">
            <input placeholder="Texte du bouton (ex: Découvrir)" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Lien du bouton" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <button className="bg-jikklo-accent text-white text-sm px-4 py-2 rounded-lg">Enregistrer en brouillon</button>
        </form>
      )}

      <div className="bg-white dark:bg-slate-800 border rounded-xl divide-y">
        {publications.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">Aucune publication pour le moment.</p>
        ) : (
          publications.map((p) => (
            <div key={p.id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{p.title}</div>
                <div className="text-xs text-slate-500">{p.status === "published" ? "Publiée" : "Brouillon"}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => togglePublish(p)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                    p.status === "published" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {p.status === "published" ? "Dépublier" : "Publier"}
                </button>
                <button onClick={() => remove(p.id)} className="text-xs text-red-500 underline">Supprimer</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
