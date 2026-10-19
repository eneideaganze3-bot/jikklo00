// Client API pour JIKKLO.COM. Se connecte à la même API que JIKKLO OS
// (source de vérité unique — règle #46 V1 / architecture centrale V2).
window.JIKKLO_API_BASE = window.location.hostname === "localhost"
  ? "http://localhost:8787"
  : "https://api.jikklo.com";

async function jikkloApiRequest(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const res = await fetch(`${window.JIKKLO_API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include", // envoie le cookie client (jikklo_customer_session) si présent
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Une erreur est survenue.");
    err.status = res.status;
    throw err;
  }
  return data;
}

window.jikkloApi = {
  get: (path) => jikkloApiRequest(path, { method: "GET" }),
  post: (path, body) => jikkloApiRequest(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: (path, body) => jikkloApiRequest(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
};

window.formatMoney = function (amount, currency = "CDF") {
  return `${Number(amount).toLocaleString("fr-FR")} ${currency}`;
};
