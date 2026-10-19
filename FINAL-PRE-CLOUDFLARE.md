# JIKKLO INTEGRATED V3 — FINAL PRE-CLOUDFLARE STATE

This package contains the real public JIKKLO site in `site/`, the JIKKLO OS frontend in
`jikklo-os-v3/os-frontend/`, and the API in `jikklo-os-v3/api/`.

## Production structure

- `site/` = the real public Jikklo.com frontend. Deploy this directory as the public site.
- `jikklo-os-v3/api/` = Cloudflare Worker API. This is intended for `api.jikklo.com`.
- `jikklo-os-v3/os-frontend/` = JIKKLO OS administration. This is intended for `app.jikklo.com`.
- `jikklo-os-v3/database/` = D1 schema/migrations/seeds.
- `archive/` = historical/demo material; do not deploy it as the public site.

## Catalogue source of truth

The production frontend no longer loads the historical `site/js/products.js` catalogue.
Products, prices and stock status come from the public API and therefore from D1.

The historical static catalogue has been moved to:
`archive/legacy-site-data/products.js`

## Important stock behavior

A product with no `inventory` row is treated as having stock tracking disabled.
A product with an `inventory` row is checked and decremented atomically during order creation.
The existing D1 `CHECK (quantity >= 0)` remains the final guard against negative stock.

## Still requires Cloudflare configuration

- D1 database and migrations
- Worker deployment
- `api.jikklo.com`
- public site deployment/domain
- `app.jikklo.com`
- R2, if/when enabled
- production secrets
- WhatsApp Cloud API credentials

No Cloudflare or Meta credentials are included in this package.

## Validation performed

- All frontend JavaScript files passed `node --check`.
- TypeScript/build/test commands were not executed because dependencies (`node_modules`) are not present in this package/environment.


## Mise à jour V4.2.2
Les pages client `site/login.html`, `site/register.html` et `site/account.html` sont présentes dans cette archive. Le guide de référence pour le déploiement est `DEPLOIEMENT-FACILE.md`.
