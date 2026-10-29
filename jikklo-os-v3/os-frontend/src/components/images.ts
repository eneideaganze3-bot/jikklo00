// Réduction d'une photo avant envoi.
// Les photos de téléphone font souvent 3 à 8 Mo. On les réduit (1600 px de
// côté max, JPEG) : envoi plus rapide en 4G et sous la limite de 5 Mo de l'API.
// Si la réduction échoue, on renvoie le fichier d'origine.
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

export async function shrinkImage(file: File): Promise<File> {
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
