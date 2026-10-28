// Client API centralisé pour JIKKLO OS.
// V2 : l'authentification passe par un cookie HttpOnly posé par l'API
// (voir api/src/routes/auth.ts) — plus de token en localStorage, qui était
// exposé aux attaques XSS. Toutes les requêtes envoient `credentials:
// "include"` pour que le navigateur transmette automatiquement le cookie.
export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? "https://api.jikklo.com";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// L'API renvoie deux formes d'erreur : { error: "texte" } et
// { success: false, error: { code, message } }. Dans les deux cas, on
// retourne toujours un texte lisible (jamais "[object Object]").
function errorMessage(data: unknown): string {
  const fallback = "Une erreur est survenue.";
  if (typeof data !== "object" || data === null) return fallback;
  const error = (data as { error?: unknown }).error;
  if (typeof error === "string" && error) return error;
  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include", // envoie/reçoit le cookie de session HttpOnly
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, errorMessage(data));
  }
  return data as T;
}

// Envoi de fichier (multipart/form-data). Pas d'en-tête Content-Type ici :
// le navigateur le fixe lui-même, avec la frontière propre au formulaire.
async function upload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, errorMessage(data));
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload,
};
