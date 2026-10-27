# JIKKLO V4.2 — Guide de déploiement (iPhone + GitHub Codespaces) n

Tout se fait dans le terminal d'un Codespace. Copie-colle les commandes **dans
l'ordre**, sans rien modifier. Aucun fichier de configuration à éditer à la
main : l'Account ID et le `database_id` de `jikklo-db` sont déjà dans
`jikklo-os-v3/api/wrangler.toml`.

Toutes les commandes partent de la **racine du repo** (le dossier qui contient
`site/`, `jikklo-os-v3/` et ce fichier). Si tu changes de dossier, reviens-y avec :

```bash
cd /workspaces/$(basename "$PWD")   # ou : cd "$(git rev-parse --show-toplevel)"
```

---

## Étape 0 — Mettre le code dans GitHub

1. Dézippe l'archive avec l'app Fichiers de l'iPhone.
2. Envoie le contenu dans ton repo (GitHub Mobile, ou upload dans un Codespace),
   **à la racine du repo**, puis commit + push.
3. Ouvre un Codespace sur ce repo (Code → Codespaces → Create codespace).

Le fichier `.gitignore` fourni empêche de committer `node_modules`, `dist` et
les fichiers de secrets.

---

## Étape 1 — Authentification Cloudflare (méthode compatible Codespaces)

`npx wrangler login` ne fonctionne pas dans un Codespace (le retour OAuth pointe
vers `localhost`, inaccessible depuis l'iPhone). Utilise un token API :

1. Dashboard Cloudflare → **My Profile → API Tokens → Create Token**.
2. Modèle **Edit Cloudflare Workers**. Vérifie que le token a bien les droits
   **D1 : Edit** et **Cloudflare Pages : Edit** sur ton compte (ajoute-les sinon).
3. Copie le token, puis dans le terminal du Codespace :

```bash
export CLOUDFLARE_API_TOKEN="colle_ton_token_ici"
export CLOUDFLARE_ACCOUNT_ID="b3a0785ba3c5830f24b4368c1a67cc88"
```

Ces variables ne vivent que dans ce terminal. Si le Codespace redémarre,
refais ces deux lignes.

---

## Étape 2 — Installer, vérifier le code

```bash
cd jikklo-os-v3/api
npm install
npm run typecheck
npm test
```

`typecheck` et `npm test` doivent se terminer sans erreur. Si l'un échoue,
**arrête-toi** et envoie-moi le message d'erreur.

Ensuite le frontend (le build lance aussi `tsc`) :

```bash
cd ../os-frontend
npm install
npm run build
cd ../..
```

---

## Étape 3 — Migrations de la base D1 (jikklo-db existante)

Ne recrée pas la base. Les migrations `0001` à `0007` s'appliquent dans
l'ordre ; celles déjà appliquées sont ignorées automatiquement.

```bash
cd jikklo-os-v3/api
npx wrangler d1 migrations list jikklo-db --remote
npx wrangler d1 migrations apply jikklo-db --remote
npx wrangler d1 execute jikklo-db --remote --command "SELECT code, enabled FROM payment_methods;"
```

Tu dois voir les 8 moyens de paiement. Ils sont à `enabled = 0` sur une base
neuve ; sur ta base existante, ils gardent les valeurs que tu as déjà réglées.

> Correction V4.2 : la migration `0002` contenait une erreur de syntaxe SQL qui
> bloquait toute installation sur une base vierge. Elle est corrigée. Sur ta
> base existante elle est déjà marquée comme appliquée, donc rien ne change.

---

## Étape 4 — Secrets de l'API

Toujours dans `jikklo-os-v3/api` :

```bash
npx wrangler secret list
```

- Si `JWT_SECRET` apparaît dans la liste : **ne le remplace pas** (cela
  déconnecterait tous les utilisateurs).
- Sinon :

```bash
openssl rand -base64 48 | npx wrangler secret put JWT_SECRET
```

WhatsApp Cloud API (seulement si tu l'utilises, sinon saute) :

```bash
npx wrangler secret put WHATSAPP_API_TOKEN
npx wrangler secret put WHATSAPP_PHONE_NUMBER_ID
```

---

## Étape 5 — Déployer l'API

```bash
npx wrangler deploy
cd ../..
```

Le Worker `jikklo-api` est publié. Pour qu'il réponde sur `api.jikklo.com`
(URL utilisée par le site et par l'Admin) : Dashboard Cloudflare → Workers &
Pages → `jikklo-api` → Settings → Domains & Routes → **Add → Custom domain** →
`api.jikklo.com`. Cela suppose que la zone `jikklo.com` est sur ce compte
Cloudflare.

Vérifie :

```bash
curl https://api.jikklo.com/health
```

Réponse attendue : `{"status":"ok","environment":"production"}`.

---

## Étape 6 — Déployer JIKKLO OS (app.jikklo.com)

```bash
cd jikklo-os-v3/os-frontend
npx wrangler pages project create jikklo-os --production-branch=main
npx wrangler pages deploy dist --project-name=jikklo-os --branch=main
cd ../..
```

La première commande échoue simplement avec « project already exists » si le
projet existe déjà : ignore-le et continue. Ensuite, Dashboard → Workers & Pages
→ `jikklo-os` → Custom domains → ajoute `app.jikklo.com` (une seule fois).

---

## Étape 7 — Déployer le site public (jikklo.com)

```bash
cd site
npx wrangler pages project create jikklo-site --production-branch=main
npx wrangler pages deploy . --project-name=jikklo-site --branch=main
cd ..
```

Même remarque pour « project already exists ». Dashboard → `jikklo-site` →
Custom domains → ajoute `jikklo.com` et `www.jikklo.com` (une seule fois).

---

## Étape 8 — Premier compte Super Admin (seulement si la base est neuve)

Si tu as déjà un compte super_admin, saute cette étape. Sinon :

```bash
node jikklo-os-v3/scripts/create-admin.mjs "Ton Nom" "toi@jikklo.com" "MotDePasseSolide123!" --remote
```

Le script affiche une commande `wrangler d1 execute` : copie-la, exécute-la
depuis `jikklo-os-v3/api`.

---

## Étape 9 — Parcours de vérification

1. `app.jikklo.com` → connexion → **Catégories** : crée une catégorie de test.
2. **Produits** : un produit avec stock et un service sans stock, publie-les.
3. **Paiements** : active au moins un moyen manuel (ex. Airtel Money) et
   renseigne numéro et instructions.
4. **Publications** : crée et publie une annonce.
5. `jikklo.com` : le catalogue, la section « Nouveautés Jikklo » et le bouton
   de thème (Clair → Sombre → Miroir) apparaissent.
6. Commande un panier mixte (produit + service), choisis le moyen de paiement.
7. Dans l'Admin → **Commandes** : la commande est là, « En attente ». Utilise
   **Confirmer** / **Rejeter** sur le paiement.
8. `jikklo.com/register.html` : crée un compte test, vérifie que la commande
   apparaît dans `account.html` avec le bon statut.

---

## Dépannage

- **`curl .../health` ne répond pas** : le domaine personnalisé de l'étape 5
  n'est pas encore actif ; teste d'abord l'URL `*.workers.dev` affichée par
  `wrangler deploy`.
- **Erreur d'authentification wrangler** : refais les deux `export` de l'étape 1.
- **Erreur 401/403 dans l'Admin sur Catégories/Paiements/Publications** :
  la migration `0006` n'est pas appliquée (étape 3).
- **Service ou recharge impossible à commander** : la migration `0007` n'est pas
  appliquée (étape 3).
- **Le site public n'affiche pas les changements** : vide le cache du navigateur.

---

## Ce qui n'est pas implémenté (inchangé)

- Aucun paiement automatique (PayPal / Visa / Mastercard) : laisse ces moyens
  désactivés tant qu'aucun fournisseur réel n'est branché.
- Pas de livraison automatique des recharges / abonnements.
- Cloudflare R2 (images produits) non activé : l'upload d'images répond 501
  tant que le binding commenté dans `wrangler.toml` n'est pas activé.
