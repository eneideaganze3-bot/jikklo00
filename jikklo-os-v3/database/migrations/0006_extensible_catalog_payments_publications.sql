-- Migration 0006 — Extensibilité catalogue + paiements configurables + publications
-- ---------------------------------------------------------------------
-- CONTEXTE : évolution architecturale majeure demandée pour que Jikklo
-- puisse lancer de nouveaux produits/services/moyens de paiement depuis
-- l'Admin, sans jamais toucher au code source.
--
-- Cette migration est 100% ADDITIVE (ALTER ... ADD COLUMN et CREATE TABLE
-- uniquement) : aucune colonne existante n'est renommée ni supprimée,
-- aucune donnée existante n'est perdue, aucune route existante n'est
-- cassée. Elle réutilise ce qui existe déjà plutôt que de le remplacer :
--   - `categories` a déjà `parent_id` -> les sous-catégories illimitées
--     existent DÉJÀ structurellement, aucun changement nécessaire ici.
--   - `settings` (clé/valeur) reste pour la config globale (devise, nom
--     société...) ; les moyens de paiement, plus structurés (logo, statut,
--     instructions par provider), obtiennent leur propre table dédiée.
--   - Le stock "optionnel selon le type d'offre" est déjà implémenté par
--     l'absence/présence d'une ligne `inventory` (voir routes/orders.ts,
--     commentaire "Le LEFT JOIN permet de détecter... stock non suivi").
--     Aucun nouveau flag n'est nécessaire, on documente juste l'existant.
-- ---------------------------------------------------------------------

-- 1. TYPE D'OFFRE — permet à un produit de représenter autre chose qu'un
--    bien physique (service, recharge, forfait, abonnement...) sans avoir
--    à créer de nouvelles tables par type d'activité future.
ALTER TABLE products ADD COLUMN offer_type TEXT NOT NULL DEFAULT 'product';
-- Valeurs prévues (contrôlées côté API, pas de CHECK SQL pour rester
-- extensible sans nouvelle migration à chaque nouveau type) :
-- product | service | topup | package | subscription | other

-- ---------------------------------------------------------------------
-- 2. MOYENS DE PAIEMENT — pilotables depuis Admin → Paramètres → Paiements.
-- Aucun secret/clé API n'est stocké ici : `config` ne contient que des
-- réglages opérationnels non sensibles affichables/utilisables tels quels
-- (numéro Airtel/Orange marchand, nom de banque, IBAN...). Les vraies clés
-- API de providers futurs (webhooks signés, etc.) resteront des secrets
-- Cloudflare Worker (wrangler secret), jamais dans cette table.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_methods (
  id             TEXT PRIMARY KEY,
  code           TEXT NOT NULL UNIQUE,        -- ex: 'airtel_money', 'orange_money', 'bank_transfer'
  name           TEXT NOT NULL,               -- libellé affiché
  logo_url       TEXT,
  kind           TEXT NOT NULL DEFAULT 'manual', -- manual | api
  enabled        INTEGER NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'CDF',
  display_order  INTEGER NOT NULL DEFAULT 0,
  instructions   TEXT,                        -- affiché au client si kind='manual'
  config         TEXT,                        -- JSON non sensible (numéro, titulaire, IBAN...)
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by     TEXT
);

-- Rattache une commande à un moyen de paiement + trace l'historique des
-- statuts (règle #12 : journalisation). Une commande peut avoir plusieurs
-- lignes si le client change de moyen après un échec.
CREATE TABLE IF NOT EXISTS order_payments (
  id                 TEXT PRIMARY KEY,
  order_id           TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method_id  TEXT NOT NULL REFERENCES payment_methods(id),
  status             TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | failed | cancelled
  amount             REAL NOT NULL,
  currency           TEXT NOT NULL DEFAULT 'CDF',
  reference          TEXT,                     -- référence transaction (saisie manuelle ou renvoyée par un provider API)
  raw_callback       TEXT,                     -- JSON brut du webhook/callback si paiement API (audit)
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at       TEXT
);

-- Statut de paiement consolidé sur la commande elle-même, pour affichage
-- rapide côté Admin sans jointure (la table order_payments reste la
-- source détaillée/historique).
ALTER TABLE orders ADD COLUMN payment_method_id TEXT REFERENCES payment_methods(id);
ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pending';
-- pending | confirmed | failed | cancelled

-- ---------------------------------------------------------------------
-- 3. PUBLICATIONS — section "Nouveautés Jikklo", gérée comme un fil
-- d'actualité depuis l'Admin, sans toucher au code du site public.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS publications (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  body           TEXT,
  image_url      TEXT,
  product_id     TEXT REFERENCES products(id),   -- offre associée, optionnelle
  category_id    TEXT REFERENCES categories(id), -- optionnelle
  cta_label      TEXT,
  cta_url        TEXT,
  price_override REAL,                           -- affichage seulement, jamais utilisé pour la commande
  status         TEXT NOT NULL DEFAULT 'draft',   -- draft | published
  display_order  INTEGER NOT NULL DEFAULT 0,
  published_at   TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  created_by     TEXT,
  updated_by     TEXT
);

-- ---------------------------------------------------------------------
-- 4. Permissions Admin pour les deux nouveaux modules.
-- Réutilise le mécanisme RBAC existant (migration 0002) plutôt que d'en
-- créer un nouveau. super_admin et admin les reçoivent automatiquement
-- (mêmes règles d'attribution que les permissions existantes).
-- ---------------------------------------------------------------------
INSERT INTO permissions (id, code, label) VALUES
  ('perm_payments_manage',     'payments.manage',     'Gérer les moyens de paiement'),
  ('perm_publications_manage', 'publications.manage', 'Gérer les publications')
ON CONFLICT(id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
  SELECT 'role_super_admin', id FROM permissions
  WHERE code IN ('payments.manage', 'publications.manage')
  ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
  SELECT 'role_admin', id FROM permissions
  WHERE code IN ('payments.manage', 'publications.manage')
  ON CONFLICT DO NOTHING;

-- Manager : peut gérer les publications (contenu marketing) mais pas les
-- moyens de paiement (sensible, réservé admin/super_admin).
INSERT INTO role_permissions (role_id, permission_id)
  SELECT 'role_manager', id FROM permissions
  WHERE code = 'publications.manage'
  ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 5. Moyens de paiement de départ — créés DÉSACTIVÉS (enabled = 0).
-- L'Admin les active et les configure (numéro, IBAN...) depuis
-- Admin → Paramètres → Paiements avant leur apparition sur le site public.
-- Rien n'apparaît publiquement tant qu'un moyen n'est pas activé.
-- ---------------------------------------------------------------------
INSERT INTO payment_methods (id, code, name, kind, enabled, currency, display_order, instructions) VALUES
  ('pm_airtel_money',   'airtel_money',   'Airtel Money',      'manual', 0, 'CDF', 1, 'Envoyez le montant au numéro Airtel Money indiqué, puis renseignez la référence de transaction.'),
  ('pm_orange_money',   'orange_money',   'Orange Money',      'manual', 0, 'CDF', 2, 'Envoyez le montant au numéro Orange Money indiqué, puis renseignez la référence de transaction.'),
  ('pm_afrimoney',      'afrimoney',      'Afri Money',        'manual', 0, 'CDF', 3, 'Envoyez le montant au numéro Afri Money indiqué, puis renseignez la référence de transaction.'),
  ('pm_mpesa',          'mpesa',          'M-Pesa',            'manual', 0, 'CDF', 4, 'Envoyez le montant au numéro M-Pesa indiqué, puis renseignez la référence de transaction.'),
  ('pm_bank_transfer',  'bank_transfer',  'Virement bancaire', 'manual', 0, 'CDF', 5, 'Effectuez le virement vers les coordonnées bancaires indiquées, puis renseignez la référence.'),
  ('pm_paypal',         'paypal',         'PayPal',            'api',    0, 'USD', 6, NULL),
  ('pm_visa',           'visa',           'Visa',              'api',    0, 'USD', 7, NULL),
  ('pm_mastercard',     'mastercard',     'Mastercard',        'api',    0, 'USD', 8, NULL)
ON CONFLICT(id) DO NOTHING;
