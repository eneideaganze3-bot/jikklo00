import { Fragment, useEffect, useState, FormEvent } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ProductPhotos } from "../components/ProductPhotos";

type Product = {
  id: string;
  name: string;
  status: string;
  unit: string;
  sale_price: number | null;
  stock_quantity: number | null;
  category_name: string | null;
  offer_type?: string;
  track_stock?: number;
};

type Category = { id: string; name: string; parent_id: string | null; parent_name: string | null };

const OFFER_TYPES = [
  { value: "product", label: "Produit physique" },
  { value: "service", label: "Service" },
  { value: "topup", label: "Recharge" },
  { value: "package", label: "Forfait" },
  { value: "subscription", label: "Abonnement" },
  { value: "other", label: "Autre" },
];

export function Products() {
  const { hasPermission } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [photosFor, setPhotosFor] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [unit, setUnit] = useState("unit");
  const [categoryId, setCategoryId] = useState("");
  const [offerType, setOfferType] = useState("product");
  const [trackStock, setTrackStock] = useState(true);

  function load() {
    api.get<{ products: Product[] }>("/api/admin/products").then((r) => setProducts(r.products));
    api.get<{ categories: Category[] }>("/api/admin/categories").then((r) => setCategories(r.categories));
  }

  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/api/admin/products", {
        name, salePrice: Number(salePrice), unit,
        categoryId: categoryId || undefined,
        offerType,
        trackStock,
      });
      setName("");
      setSalePrice("");
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de la création.");
    }
  }

  async function togglePublish(p: Product) {
    setListError(null);
    try {
      await api.patch(`/api/admin/products/${p.id}`, {
        status: p.status === "published" ? "draft" : "published",
      });
      load();
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Impossible de modifier le statut.");
    }
  }

  async function removeProduct(p: Product) {
    if (!window.confirm(`Supprimer « ${p.name} » ? Il ne sera plus visible sur le site ni dans cette liste.`)) return;
    setListError(null);
    try {
      await api.delete(`/api/admin/products/${p.id}`);
      if (photosFor === p.id) setPhotosFor(null);
      load();
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Impossible de supprimer le produit.");
    }
  }

  // Un produit « supprimé » est archivé côté API : on ne l'affiche plus.
  const visibleProducts = products.filter((p) => p.status !== "archived");
  const canEdit = hasPermission("products.edit");
  const canPhotos = hasPermission("media.upload");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-jikklo-navy">Produits</h1>
        {hasPermission("products.edit") && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-jikklo-navy text-white text-sm px-4 py-2 rounded-lg"
          >
            {showForm ? "Annuler" : "+ Nouveau produit"}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border rounded-xl p-4 space-y-3">
          {error && <div className="text-sm text-red-600">{error}</div>}
          <input
            required
            placeholder="Nom du produit"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              type="number"
              placeholder="Prix de vente (FC)"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="unit">Unité</option>
              <option value="L">Litre</option>
              <option value="kg">Kg</option>
              <option value="service">Service</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Sans catégorie</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.parent_name ? `${cat.parent_name} / ${cat.name}` : cat.name}
                </option>
              ))}
            </select>
            <select
              value={offerType}
              onChange={(e) => setOfferType(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              {OFFER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={trackStock} onChange={(e) => setTrackStock(e.target.checked)} />
            Gérer un stock pour cette offre (à décocher pour un service, une recharge, un abonnement...)
          </label>
          <p className="text-xs text-slate-400">
            Pas de catégorie qui convient ? Crée-la d'abord depuis <span className="font-medium">Catégories</span> dans le menu.
          </p>
          <button className="bg-jikklo-accent text-white text-sm px-4 py-2 rounded-lg">
            Créer le produit (brouillon)
          </button>
        </form>
      )}

      {listError && <div className="text-sm text-red-600">{listError}</div>}

      <div className="bg-white border rounded-xl overflow-x-auto">
        {visibleProducts.length === 0 ? (
          <p className="text-sm text-slate-400 p-6 text-center">Aucun produit disponible.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Nom</th>
                <th className="px-4 py-2 font-medium">Catégorie</th>
                <th className="px-4 py-2 font-medium">Prix</th>
                <th className="px-4 py-2 font-medium">Stock</th>
                <th className="px-4 py-2 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((p) => (
                <Fragment key={p.id}>
                <tr className="border-t">
                  <td className="px-4 py-2">
                    <div>{p.name}</div>
                    {(canEdit || canPhotos) && (
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => togglePublish(p)}
                            className="text-xs text-jikklo-navy underline"
                          >
                            {p.status === "published" ? "Retirer du site" : "Publier"}
                          </button>
                        )}
                        {canPhotos && (
                          <button
                            type="button"
                            onClick={() => setPhotosFor(photosFor === p.id ? null : p.id)}
                            className="text-xs text-jikklo-navy underline"
                          >
                            {photosFor === p.id ? "Fermer les photos" : "Photos"}
                          </button>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => removeProduct(p)}
                            className="text-xs text-red-600 underline"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-500">{p.category_name ?? "—"}</td>
                  <td className="px-4 py-2">
                    {p.sale_price !== null ? `${p.sale_price.toLocaleString()} FC` : "—"}
                  </td>
                  <td className="px-4 py-2">
                    {p.track_stock === 0
                      ? <span className="text-xs text-slate-400 italic">Sans stock ({OFFER_TYPES.find((t) => t.value === p.offer_type)?.label ?? p.offer_type})</span>
                      : <>{p.stock_quantity ?? "—"} {p.unit}</>}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        p.status === "published"
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
                {photosFor === p.id && (
                  <tr className="border-t bg-slate-50">
                    <td colSpan={5} className="px-4 py-3">
                      <ProductPhotos productId={p.id} />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
