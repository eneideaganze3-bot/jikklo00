// Client API centralisé pour JIKKLO OS.
// V2 : l'authentification passe par un cookie HttpOnly posé par l'API
// (voir api/src/routes/auth.ts) — plus de token en localStorage, qui était
// exposé aux attaques XSS. Toutes les requêtes envoient `credentials:
// "include"` pour que le navigateur transmette automatiquement le cookie.
const API_BASE_URL = import.meta.env.VITE_API_URL ?? "https://api.jikklo.com";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
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
    throw new ApiError(res.status, data.error ?? "Une erreur est survenue.");
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
};
