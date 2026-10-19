import { useEffect, useState, FormEvent } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";

type Category = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  parent_name: string | null;
  activity: string;
  display_order: number;
};

// Admin → Catalogue → Catégories (spécification section 1). Créer une
// catégorie ici (avec ou sans parente, pour une sous-catégorie) la rend
// immédiatement disponible dans le sélecteur de la page Produits, et sur
// le site public dès qu'un produit lui est rattaché — sans toucher au code.
export function Categories() {
  const { hasPermission } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [activity, setActivity] = useState("energy");

  function load() {
    api.get<{ categories: Category[] }>("/api/admin/categories").then((r) => setCategories(r.categories));
  }
  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/api/admin/categories", { name, parentId: parentId || undefined, activity });
      setName(""); setParentId(""); setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Supprimer cette catégorie ?")) return;
    try {
      await api.delete(`/api/admin/categories/${id}`);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Impossible de supprimer cette catégorie.");
    }
  }

  const topLevel = categories.filter((c) => !c.parent_id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-jikklo-navy dark:text-white">Catégories</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Illimitées, avec sous-catégories. Une catégorie apparaît sur le site public dès qu'un produit lui est rattaché.
          </p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="bg-jikklo-navy text-white text-sm px-4 py-2 rounded-lg shrink-0">
          {showForm ? "Annuler" : "+ Nouvelle catégorie"}
        </button>
      </div>

      {!hasPermission("products.edit") && (
        <p className="text-xs text-amber-600">Lecture seule — la création/suppression nécessite la permission "products.edit".</p>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-800 border rounded-xl p-4 space-y-3">
          {error && <div className="text-sm text-red-600">{error}</div>}
          <input required placeholder="Nom (ex: Jikklo Market)" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm" />
          <div className="grid sm:grid-cols-2 gap-3">
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">Catégorie principale (sans parente)</option>
              {topLevel.map((c) => (
                <option key={c.id} value={c.id}>Sous-catégorie de : {c.name}</option>
              ))}
            </select>
            <select value={activity} onChange={(e) => setActivity(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
              <option value="energy">Energy</option>
              <option value="digital">Digital</option>
              <option value="other">Autre activité</option>
            </select>
          </div>
          <button className="bg-jikklo-accent text-white text-sm px-4 py-2 rounded-lg">Créer</button>
        </form>
      )}

      <div className="bg-white dark:bg-slate-800 border rounded-xl divide-y">
        {categories.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">Aucune catégorie pour le moment.</p>
        ) : (
          categories.map((c) => (
            <div key={c.id} className="p-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {c.parent_name ? `${c.parent_name} / ${c.name}` : c.name}
                </div>
                <div className="text-xs text-slate-500">{c.activity} · /{c.slug}</div>
              </div>
              <button onClick={() => remove(c.id)} className="text-xs text-red-500 underline shrink-0">Supprimer</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
