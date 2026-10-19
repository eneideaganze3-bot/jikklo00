# D1_SETUP.md — Base de données

## Création de la base

```bash
cd api
npx wrangler d1 create jikklo-db
```

Copie le `database_id` retourné dans `api/wrangler.toml` (remplace
`REMPLACER_PAR_TON_DATABASE_ID`).

## Migrations — système officiel Wrangler (V3)

Contrairement à la V2 (fichiers exécutés un par un à la main), la V3 utilise
le vrai système de migrations de Wrangler, qui suit un historique dans une
table `d1_migrations` et n'applique jamais deux fois la même migration.

```bash
# Voir les migrations en attente
npm run migrations:list:local     # ou :remote

# Appliquer toutes les migrations en attente
npm run db:migrate:local          # ou :remote
```

Les fichiers de migration vivent dans `database/migrations/`, numérotés
(`0001_...`, `0002_...`, etc.) — c'est exactement la convention attendue par
Wrangler (`migrations_dir` est configuré dans `wrangler.toml`).

## Ajouter une nouvelle migration plus tard

```bash
cd api
npx wrangler d1 migrations create jikklo-db "nom_de_la_migration"
```

Ça crée un nouveau fichier numéroté dans `database/migrations/` — édite-le,
puis applique avec `npm run db:migrate:local` / `:remote`.

## Créer le premier administrateur

```bash
node scripts/create-admin.mjs "Ton Nom" "admin@jikklo.com" "MotDePasseSolide123!"
```

Le script affiche la commande `wrangler d1 execute` à exécuter — aucun mot de
passe n'est écrit sur disque.

## Séparer développement et production

Wrangler gère ça nativement via `--local` (base SQLite locale, dans
`.wrangler/state/`) et `--remote` (vraie base D1 sur Cloudflare). Les deux
bases sont physiquement séparées — il n'y a aucun risque de mélanger des
données de test avec la production tant que tu utilises le bon flag.

**Ne jamais exécuter `database/seed.dev.sql` avec `--remote`.**

## Sauvegardes

```bash
npx wrangler d1 export jikklo-db --remote --output=backup-$(date +%Y%m%d).sql
```
Recommandé : une fois par semaine minimum, à conserver hors de Cloudflare
(Google Drive, disque externe...).
