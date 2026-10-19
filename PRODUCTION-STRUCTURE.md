# JIKKLO production structure

- `site/` = the official public JIKKLO.COM frontend. This is the site to deploy publicly.
- `jikklo-os-v3/api/` = JIKKLO OS API / Cloudflare Worker backend.
- `jikklo-os-v3/os-frontend/` = JIKKLO OS administration frontend.
- `archive/public-site-demo/` = old/demo reconstruction; NOT the public production site.

## Product data flow

`site/` -> `https://api.jikklo.com/api/public/products` -> JIKKLO API -> D1.

The production frontend no longer loads `site/js/products.js` as a script. Product prices, stock and availability must come from the API.

## Important

Cloudflare D1, R2, custom domains, WhatsApp credentials and production secrets are intentionally not configured in this archive. They must be configured in the deployment environment.
