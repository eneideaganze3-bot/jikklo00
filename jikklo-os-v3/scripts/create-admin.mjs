#!/usr/bin/env node
// =====================================================================
// Crée le premier compte Super Admin de JIKKLO OS.
// Corrige le risque V1 (placeholders REPLACE_WITH_GENERATED_HASH dans un
// fichier seed committable). Ce script ne touche à AUCUN fichier — il
// génère juste la commande `wrangler d1 execute` à copier-coller, avec un
// hash calculé localement. Le mot de passe en clair ne quitte jamais ta
// machine et n'est jamais écrit sur le disque.
//
// Usage :
//   node scripts/create-admin.mjs "Nom Complet" "email@jikklo.com" "MotDePasseSolide123!" --remote
//   (retirer --remote pour cibler la base locale)
// =====================================================================
import crypto from "node:crypto";

const [, , fullName, email, password, envFlag] = process.argv;

if (!fullName || !email || !password) {
  console.error("Usage: node scripts/create-admin.mjs \"Nom Complet\" \"email@jikklo.com\" \"MotDePasse\" [--remote]");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Le mot de passe doit contenir au moins 8 caractères.");
  process.exit(1);
}

const ITERATIONS = 100_000;
const salt = crypto.randomBytes(16).toString("hex");
const hash = crypto
  .pbkdf2Sync(password, Buffer.from(salt, "hex"), ITERATIONS, 32, "sha256")
  .toString("hex");

const userId = "user_" + crypto.randomUUID();
const target = envFlag === "--remote" ? "--remote" : "--local";

const sql = `INSERT INTO users (id, full_name, email, password_hash, password_salt, role_id, status) VALUES ('${userId}', '${fullName.replace(/'/g, "''")}', '${email.toLowerCase().trim()}', '${hash}', '${salt}', 'role_super_admin', 'active');`;

console.log("\nCopie-colle et exécute cette commande :\n");
console.log(`npx wrangler d1 execute jikklo-db ${target} --command="${sql}"`);
console.log("\n(Le mot de passe en clair n'a été ni stocké ni affiché ci-dessus.)\n");
