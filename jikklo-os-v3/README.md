# JIKKLO — V3 (technique complète, prête pour la configuration externe)

Système complet de JIKKLO SAS : site public, JIKKLO OS (admin), API centrale
et base de données partagée. La V3 corrige, sécurise et documente en
profondeur le travail des versions précédentes — voir `AUDIT-V3.md` pour un
état honnête de ce qui est fait, prêt-mais-à-configurer, ou en attente
d'informations que je n'ai pas.

## Démarrage rapide

1. **Installation locale** → `docs/INSTALLATION.md`
2. **Déploiement production** → `docs/DEPLOYMENT.md`
3. **Connecter les domaines Cloudflare** → `docs/CLOUDFLARE_SETUP.md`
4. **Configurer WhatsApp** → `docs/WHATSAPP_SETUP.md`
5. **Configurer R2 (images)** → `docs/R2_SETUP.md`
6. **Base de données** → `docs/D1_SETUP.md`
7. **Intégrer le vrai jikklo.com** → `docs/REAL_SITE_INTEGRATION.md` ⚠️ **FAIT** — voir aussi `INTEGRATION-AUDIT.md` à la racine du livrable. (`docs/JIKKLO_PUBLIC_SITE_INTEGRATION.md` décrivait l'ancien plan avant intégration réelle et est conservé pour l'historique uniquement — `docs/REAL_SITE_INTEGRATION.md` fait foi.)
8. **Référence API complète** → `docs/API.md`
9. **État de la sécurité** → `docs/SECURITY.md`

## Structure du projet

```
jikklo-os-v3/
├── database/            → schéma, migrations (système officiel wrangler), seed dev
├── api/                 → API centrale (Cloudflare Workers + Hono + D1)
├── os-frontend/          → JIKKLO OS (React + Vite)
├── public-site/          → ⚠️ ancienne reconstruction de démonstration, NON UTILISÉE — le vrai site est dans `../site/` (voir docs/REAL_SITE_INTEGRATION.md)
├── scripts/              → création propre du premier administrateur
├── api/tests/            → tests automatisés, dont concurrence réelle sur D1
├── docs/                 → toute la documentation détaillée
├── AUDIT-V3.md           → 🟢 terminé / 🟡 prêt à configurer / 🔴 info manquante / 🔵 prochaine étape
└── README.md             → ce fichier
```

## Tests

```bash
cd api
npm install   # une seule fois
npm run typecheck
npm test
```

## Important

Ce projet ne prétend jamais qu'une intégration externe (WhatsApp, R2, le
vrai jikklo.com) est opérationnelle tant qu'elle ne l'est pas réellement.
Chaque fois qu'une information externe manque, le code est prêt à la
recevoir et le document correspondant dans `docs/` explique exactement quoi
faire.
