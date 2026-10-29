import { useEffect, useState, FormEvent, ChangeEvent } from "react";
import { api, ApiError, API_BASE_URL } from "../api/client";
import { shrinkImage } from "../components/images";

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

// Une image stockée dans R2 est une clé (ex. publications/pub_x/uuid.jpg) ;
// une image saisie à la main est une URL complète.
function imageSrc(stored: string): string {
  return /^https?:\/\//i.test(stored) ? stored : `${API_BASE_URL}/api/public/media/${stored}`;
}

async function uploadPublicationImage(publicationId: string, file: File) {
  const prepared = await shrinkImage(file);
  const form = new FormData();
  form.append("file", prepared);
  form.append("publicationId", publicationId);
  await api.upload("/api/admin/media/publication", form);
}

// Admin → Publications — section "Nouveautés Jikklo" (spécification section
// 6). Publier ici fait apparaître la publication sur le site public sans
// redéploiement — voir GET /api/public/publications.
export function Publications() {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    api
      .get<{ publications: Publication[] }>("/api/admin/publications")
      .then((r) => setPublications(r.publications))
      .catch((err) => setListError(err instanceof ApiError ? err.message : "Impossible de charger les publications."));
  }
  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const created = await api.post<{ id: string }>("/api/admin/publications", {
        title, body: body || undefined,
        ctaLabel: ctaLabel || undefined, ctaUrl: ctaUrl || undefined,
      });
      let imageProblem: string | null = null;
      if (imageFile) {
        try {
          await uploadPublicationImage(created.id, imageFile);
        } catch (err) {
          imageProblem = err instanceof ApiError ? err.message : "Erreur lors de l'envoi de la photo.";
        }
      }
      setTitle(""); setBody(""); setImageFile(null); setCtaLabel(""); setCtaUrl("");
      load();
      if (imageProblem) {
        setListError(`Publication créée, mais la photo n'a pas pu être envoyée : ${imageProblem}`);
      }
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur.");
    }
    setSaving(false);
  }

  async function togglePublish(p: Publication) {
    setListError(null);
    try {
      await api.patch(`/api/admin/publications/${p.id}`, { status: p.status === "published" ? "draft" : "published" });
      load();
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Erreur.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Supprimer définitivement cette publication ?")) return;
    setListError(null);
    try {
      await api.delete(`/api/admin/publications/${id}`);
      load();
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Erreur.");
    }
  }

  async function handleReplaceImage(p: Publication, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setListError(null);
    setBusyId(p.id);
    try {
      await uploadPublicationImage(p.id, file);
      load();
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Erreur lors de l'envoi de la photo.");
    }
    setBusyId(null);
  }

  async function removeImage(p: Publication) {
    if (!confirm("Retirer l'image de cette publication ?")) return;
    setListError(null);
    try {
      await api.patch(`/api/admin/publications/${p.id}`, { imageUrl: null });
      load();
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Erreur.");
    }
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
          <div>
            <label className="inline-block bg-slate-100 text-slate-700 text-sm px-4 py-2 rounded-lg cursor-pointer">
              {imageFile ? "Changer la photo" : "+ Ajouter une photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
            {imageFile && <span className="ml-3 text-xs text-slate-500 break-all">{imageFile.name}</span>}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <input placeholder="Texte du bouton (ex: Découvrir)" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Lien du bouton" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <p className="text-xs text-slate-400">
            Pour une vidéo : mets-la en ligne (YouTube, Facebook…), puis colle son lien dans « Lien du bouton »
            avec un texte comme « Voir la vidéo ». L'envoi direct de vidéos n'est pas encore disponible.
          </p>
          <button disabled={saving} className="bg-jikklo-accent text-white text-sm px-4 py-2 rounded-lg">
            {saving ? "Enregistrement…" : "Enregistrer en brouillon"}
          </button>
        </form>
      )}

      {listError && <div className="text-sm text-red-600">{listError}</div>}

      <div className="bg-white dark:bg-slate-800 border rounded-xl divide-y">
        {publications.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">Aucune publication pour le moment.</p>
        ) : (
          publications.map((p) => (
            <div key={p.id} className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                {p.image_url && (
                  <img src={imageSrc(p.image_url)} alt="" className="w-16 h-16 object-cover rounded shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100 break-words">{p.title}</div>
                  <div className="text-xs text-slate-500">{p.status === "published" ? "Publiée" : "Brouillon"}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <button
                  onClick={() => togglePublish(p)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                    p.status === "published" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {p.status === "published" ? "Dépublier" : "Publier"}
                </button>
                <label className="text-xs text-jikklo-navy underline cursor-pointer">
                  {busyId === p.id ? "Envoi…" : p.image_url ? "Changer la photo" : "Ajouter une photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busyId === p.id}
                    onChange={(e) => handleReplaceImage(p, e)}
                    className="hidden"
                  />
                </label>
                {p.image_url && (
                  <button onClick={() => removeImage(p)} className="text-xs text-slate-500 underline">
                    Retirer la photo
                  </button>
                )}
                <button onClick={() => remove(p.id)} className="text-xs text-red-500 underline">Supprimer</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
