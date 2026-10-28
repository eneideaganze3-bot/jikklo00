import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, Variables } from "./types";
import { apiError } from "./lib/apiResponse";

import { authRoutes } from "./routes/auth";
import { productRoutes } from "./routes/products";
import { categoryRoutes } from "./routes/categories";
import { pricingRoutes } from "./routes/pricing";
import { inventoryRoutes } from "./routes/inventory";
import { orderRoutes } from "./routes/orders";
import { customerRoutes } from "./routes/customers";
import { customerAccountRoutes } from "./routes/customerAccount";
import { dashboardRoutes } from "./routes/dashboard";
import { userRoutes } from "./routes/users";
import { digitalRoutes } from "./routes/digital";
import { supplierRoutes } from "./routes/suppliers";
import { financeRoutes } from "./routes/finance";
import { mediaRoutes, publicMediaRoutes } from "./routes/media";
import { paymentMethodRoutes } from "./routes/paymentMethods";
import { publicationRoutes } from "./routes/publications";
import {
  notificationRoutes,
  auditLogRoutes,
  settingsRoutes,
  publicCatalogRoutes,
} from "./routes/misc";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ---------------------------------------------------------------------
// Sécurité (règle #33, #34 V2)
// ---------------------------------------------------------------------
const ALLOWED_ORIGINS = [
  "https://jikklo.com",
  "https://www.jikklo.com",
  "https://app.jikklo.com",
  "http://localhost:5173",
  "http://localhost:4321", // public-site en dev
];

app.use(
  "*",
  cors({
    // CORRIGÉ (règle #22 du brief d'intégration jikklo.com) : une origine
    // absente de la liste doit être REFUSÉE, jamais recevoir silencieusement
    // l'en-tête Access-Control-Allow-Origin de la première origine autorisée.
    // Retourner une chaîne vide fait que le middleware `cors` de Hono
    // n'ajoute aucun en-tête d'autorisation pour cette requête : le
    // navigateur bloque alors la lecture de la réponse côté client, ce qui
    // est le comportement de refus attendu.
    origin: (origin) => (ALLOWED_ORIGINS.includes(origin) ? origin : ""),
    credentials: true, // requis pour que le cookie de session soit envoyé/reçu cross-subdomain
    allowMethods: ["GET", "POST", "PATCH", "DELETE"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  c.header("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  // L'API ne sert que du JSON — CSP restrictive par défaut, pas de risque
  // d'injection de script puisqu'aucun HTML n'est jamais rendu ici.
  // Les photos produit (GET /api/public/media/*) doivent pouvoir s'afficher
  // aussi quand on ouvre leur adresse directement : seule `img-src 'self'`
  // est ajoutée pour ce chemin, tout le reste reste interdit.
  c.header(
    "Content-Security-Policy",
    c.req.path.startsWith("/api/public/media/")
      ? "default-src 'none'; img-src 'self'; frame-ancestors 'none'"
      : "default-src 'none'; frame-ancestors 'none'"
  );
});

// ---------------------------------------------------------------------
// Rate limiting — protection basique en mémoire de Worker.
// LIMITE CONNUE (documentée en toute transparence, règle #35) : ce compteur
// vit dans l'instance du Worker et n'est PAS partagé entre les différentes
// instances que Cloudflare peut faire tourner en parallèle à travers le
// monde. Ce n'est donc qu'une protection d'appoint contre un client
// insistant, pas une protection anti-abus robuste. Pour une vraie
// protection de production, activer les "Rate Limiting Rules" natives de
// Cloudflare (Dashboard → Security → WAF → Rate limiting rules), qui elles
// sont appliquées au niveau du edge, de façon globale et fiable.
// ---------------------------------------------------------------------
const requestCounts = new Map<string, { count: number; resetAt: number }>();
app.use("*", async (c, next) => {
  // Les photos produit ne comptent pas dans la limite : une seule page du
  // catalogue en charge des dizaines à la fois, et elles sont mises en cache.
  if (c.req.path.startsWith("/api/public/media/")) return next();
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  const now = Date.now();
  const entry = requestCounts.get(ip);
  if (!entry || entry.resetAt < now) {
    requestCounts.set(ip, { count: 1, resetAt: now + 60_000 });
  } else {
    entry.count++;
    if (entry.count > 120) {
      return apiError(c, 429, "RATE_LIMITED", "Trop de requêtes. Réessaie dans un instant.");
    }
  }
  await next();
});

// ---------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------
app.get("/", (c) => c.json({ name: "JIKKLO API", status: "ok", version: "2.0" }));
app.get("/health", (c) => c.json({ status: "ok", environment: c.env.ENVIRONMENT }));

app.route("/api/auth", authRoutes);
app.route("/api/admin/products", productRoutes);
app.route("/api/admin/categories", categoryRoutes);
app.route("/api/admin/pricing", pricingRoutes);
app.route("/api/admin/inventory", inventoryRoutes);
app.route("/api/orders", orderRoutes); // contient /public/* et /admin/*
app.route("/api/admin/customers", customerRoutes);
app.route("/api/admin/dashboard", dashboardRoutes);
app.route("/api/admin/users", userRoutes);
app.route("/api/admin/digital", digitalRoutes);
app.route("/api/admin/suppliers", supplierRoutes);
app.route("/api/admin/finance", financeRoutes);
app.route("/api/admin/media", mediaRoutes);
app.route("/api/admin/payment-methods", paymentMethodRoutes);
app.route("/api/admin/publications", publicationRoutes);
app.route("/api/admin/notifications", notificationRoutes);
app.route("/api/admin/audit-logs", auditLogRoutes);
app.route("/api/settings", settingsRoutes); // contient /public et /admin/*
app.route("/api/public/media", publicMediaRoutes);
app.route("/api/public", publicCatalogRoutes);
app.route("/api/customer", customerAccountRoutes); // espace client public (register/login/me/orders)

// ---------------------------------------------------------------------
// Gestion des erreurs — jamais de détails techniques exposés au client
// (règle #53 V1 / #33 V2). Les détails techniques vont dans les logs.
// ---------------------------------------------------------------------
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return apiError(c, 500, "INTERNAL_ERROR", "Une erreur est survenue. Veuillez réessayer.");
});

app.notFound((c) => apiError(c, 404, "NOT_FOUND", "Route introuvable."));

export default app;
