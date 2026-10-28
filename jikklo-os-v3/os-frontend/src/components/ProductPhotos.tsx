import { useEffect, useState, ChangeEvent } from "react";
import { api, ApiError, API_BASE_URL } from "../api/client";

type ProductImage = { id: string; url: string; is_primary: number };

// Les photos de téléphone font souvent 3 à 8 Mo. On les réduit avant l'envoi
// (1600 px de côté max, JPEG) : envoi plus rapide en 4G et sous la limite de
// 5 Mo de l'API. Si la réduction échoue, on envoie le fichier d'origine.
const MAX_SIDE = 1600;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image illisible."));
    };
    img.src = objectUrl;
  });
}

async function shrinkImage(file: File): Promise<File> {
  try {
    const img = await loadImage(file);
    const longestSide = Math.max(img.naturalWidth, img.naturalHeight);
    if (longestSide === 0) return file;
    const scale = Math.min(1, MAX_SIDE / longestSide);
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#ffffff"; // fond blanc pour les PNG à fond transparent
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], "photo.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function ProductPhotos({ productId, onChanged }: { productId: string; onChanged?: () => void }) {
  const [images, setImages] = useState<ProductImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadImages() {
    api
      .get<{ images: ProductImage[] }>(`/api/admin/products/${productId}`)
      .then((r) => setImages(r.images))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Impossible de charger les photos."));
  }

  useEffect(loadImages, [productId]);

  async function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // permet de rechoisir la même photo ensuite
    if (files.length === 0) return;

    setBusy(true);
    setError(null);
    try {
      for (const file of files) {
        const prepared = await shrinkImage(file);
        const form = new FormData();
        form.append("file", prepared);
        form.append("productId", productId);
        await api.upload("/api/admin/media/upload", form);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'envoi de la photo.");
    }
    setBusy(false);
    loadImages();
    onChanged?.();
  }

  async function makePrimary(imageId: string) {
    setError(null);
    try {
      await api.patch(`/api/admin/media/${imageId}/primary`);
      loadImages();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur.");
    }
  }

  async function remove(imageId: string) {
    if (!window.confirm("Supprimer cette photo ?")) return;
    setError(null);
    try {
      await api.delete(`/api/admin/media/${imageId}`);
      loadImages();
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur.");
    }
  }

  return (
    <div className="space-y-3">
      {error && <div className="text-sm text-red-600">{error}</div>}

      {images.length === 0 ? (
        <p className="text-sm text-slate-400">Aucune photo pour ce produit.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {images.map((img) => (
            <div key={img.id} className="border rounded-lg p-2 space-y-2 bg-white">
              <img
                src={`${API_BASE_URL}/api/public/media/${img.url}`}
                alt=""
                className="w-full h-28 object-cover rounded"
              />
              {img.is_primary === 1 ? (
                <div className="text-xs text-green-700 font-medium">Photo principale</div>
              ) : (
                <button
                  type="button"
                  onClick={() => makePrimary(img.id)}
                  className="text-xs text-jikklo-navy underline"
                >
                  Définir comme principale
                </button>
              )}
              <button type="button" onClick={() => remove(img.id)} className="block text-xs text-red-600 underline">
                Supprimer
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="inline-block bg-jikklo-accent text-white text-sm px-4 py-2 rounded-lg cursor-pointer">
        {busy ? "Envoi en cours…" : "+ Ajouter des photos"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={busy}
          onChange={handleFiles}
          className="hidden"
        />
      </label>
      <p className="text-xs text-slate-400">
        JPEG, PNG ou WEBP. Les photos sont réduites automatiquement avant l'envoi. La photo principale est celle affichée sur le site.
      </p>
    </div>
  );
}
