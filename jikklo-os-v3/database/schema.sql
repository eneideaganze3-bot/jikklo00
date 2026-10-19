-- ⚠️ RÉFÉRENCE UNIQUEMENT : la source de vérité du déploiement est le dossier
-- migrations/ (0001 à 0007). Ce fichier ne contient PAS les tables ajoutées par
-- 0006 (payment_methods, order_payments, publications). Ne pas l'utiliser pour
-- initialiser la base de production.

-- =====================================================================
-- JIKKLO OS — Schéma de base de données (Cloudflare D1 / SQLite)
-- =====================================================================
-- Convention : IDs uniques (TEXT, générés en UUID côté API),
-- created_at / updated_at / created_by / updated_by quand pertinent.
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- RÔLES & PERMISSIONS (RBAC)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,      -- super_admin, admin, manager, agent, client
  label         TEXT NOT NULL,             -- libellé affiché
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS permissions (
  id            TEXT PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,      -- ex: products.edit, orders.view
  label         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ---------------------------------------------------------------------
-- UTILISATEURS (staff JIKKLO OS)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  full_name      TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  phone          TEXT,
  password_hash  TEXT NOT NULL,
  password_salt  TEXT NOT NULL,
  role_id        TEXT NOT NULL REFERENCES roles(id),
  status         TEXT NOT NULL DEFAULT 'active', -- active | suspended
  last_login_at  TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  created_by     TEXT
);

-- ---------------------------------------------------------------------
-- CLIENTS (espace client public)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id             TEXT PRIMARY KEY,
  full_name      TEXT NOT NULL,
  email          TEXT UNIQUE,
  phone          TEXT NOT NULL,
  password_hash  TEXT,
  password_salt  TEXT,
  address        TEXT,
  city           TEXT DEFAULT 'Bukavu',
  status         TEXT NOT NULL DEFAULT 'active',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- CATÉGORIES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  parent_id      TEXT REFERENCES categories(id),
  activity       TEXT NOT NULL DEFAULT 'energy', -- energy | digital
  display_order  INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- PRODUITS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id               TEXT PRIMARY KEY,
  sku              TEXT UNIQUE,               -- référence
  name             TEXT NOT NULL,
  category_id      TEXT REFERENCES categories(id),
  activity         TEXT NOT NULL DEFAULT 'energy', -- energy | digital
  description      TEXT,
  brand            TEXT,
  unit             TEXT NOT NULL DEFAULT 'unit',   -- L, kg, unit, service...
  packaging        TEXT,
  weight_volume    REAL,
  featured         INTEGER NOT NULL DEFAULT 0,     -- 0/1
  status           TEXT NOT NULL DEFAULT 'draft',  -- draft | published | archived
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  created_by       TEXT,
  updated_by       TEXT
);

CREATE TABLE IF NOT EXISTS product_images (
  id           TEXT PRIMARY KEY,
  product_id   TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url          TEXT NOT NULL,          -- clé R2 ou URL
  is_primary   INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------
-- PRIX & HISTORIQUE
-- ---------------------------------------------------------------------
-- "prices" = prix ACTUEL et ACTIF d'un produit (une ligne active par produit)
CREATE TABLE IF NOT EXISTS prices (
  id             TEXT PRIMARY KEY,
  product_id     TEXT NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  purchase_price REAL NOT NULL DEFAULT 0,   -- prix d'achat
  sale_price     REAL NOT NULL,             -- prix de vente actuel
  currency       TEXT NOT NULL DEFAULT 'CDF',
  effective_date TEXT NOT NULL DEFAULT (datetime('now')),
  active         INTEGER NOT NULL DEFAULT 1,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by     TEXT
);

-- Historique : une ligne par changement de prix, JAMAIS modifiée après coup
CREATE TABLE IF NOT EXISTS price_history (
  id             TEXT PRIMARY KEY,
  product_id     TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  old_sale_price REAL,
  new_sale_price REAL NOT NULL,
  old_purchase_price REAL,
  new_purchase_price REAL,
  changed_by     TEXT,                 -- user_id
  changed_at     TEXT NOT NULL DEFAULT (datetime('now')),
  reason         TEXT
);

-- ---------------------------------------------------------------------
-- STOCK
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory (
  id             TEXT PRIMARY KEY,
  product_id     TEXT NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  quantity       REAL NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_threshold  REAL NOT NULL DEFAULT 5,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id             TEXT PRIMARY KEY,
  product_id     TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type           TEXT NOT NULL,       -- entree | vente | correction | perte | retour | transfert
  quantity       REAL NOT NULL,       -- positif = entrée, négatif = sortie
  resulting_stock REAL NOT NULL,
  reason         TEXT,
  reference      TEXT,                -- ex: numéro de commande lié
  created_by     TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- COMMANDES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id               TEXT PRIMARY KEY,
  order_number     TEXT NOT NULL UNIQUE,  -- ex: JKK-2026-000001
  customer_id      TEXT REFERENCES customers(id),
  customer_name    TEXT NOT NULL,          -- copie au moment de la commande
  customer_phone   TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'new',
  -- new | confirmed | preparing | ready | delivering | delivered | completed | cancelled
  delivery_mode    TEXT DEFAULT 'pickup',  -- pickup | delivery
  delivery_address TEXT,
  delivery_fee     REAL NOT NULL DEFAULT 0,
  subtotal         REAL NOT NULL DEFAULT 0,
  total            REAL NOT NULL DEFAULT 0,
  currency         TEXT NOT NULL DEFAULT 'CDF',
  channel          TEXT NOT NULL DEFAULT 'web', -- web | whatsapp | os
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id             TEXT PRIMARY KEY,
  order_id       TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id     TEXT NOT NULL REFERENCES products(id),
  product_name   TEXT NOT NULL,          -- copie au moment de la commande
  unit_price     REAL NOT NULL CHECK (unit_price >= 0),  -- prix appliqué à CETTE commande (historique figé)
  quantity       REAL NOT NULL CHECK (quantity > 0),
  line_total     REAL NOT NULL CHECK (line_total >= 0)
);

-- Compteur atomique pour générer JKK-YYYY-000001 sans collision possible
-- (INSERT ... ON CONFLICT DO UPDATE ... RETURNING = opération atomique unique)
CREATE TABLE IF NOT EXISTS order_counters (
  year        INTEGER PRIMARY KEY,
  next_value  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS finance_entries (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category      TEXT NOT NULL,
  amount        REAL NOT NULL CHECK (amount > 0),
  currency      TEXT NOT NULL DEFAULT 'CDF',
  activity      TEXT,
  reference     TEXT,
  notes         TEXT,
  created_by    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id            TEXT PRIMARY KEY,
  order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  old_status    TEXT,
  new_status    TEXT NOT NULL,
  changed_by    TEXT,
  changed_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- FOURNISSEURS (structure prête, module minimal en Phase 1)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  contact_name  TEXT,
  phone         TEXT,
  email         TEXT,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- JIKKLO DIGITAL — structure extensible, désactivable
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS digital_services (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  price         REAL,
  enabled       INTEGER NOT NULL DEFAULT 0,  -- désactivé par défaut tant que non validé légalement
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS digital_transactions (
  id             TEXT PRIMARY KEY,
  service_id     TEXT NOT NULL REFERENCES digital_services(id),
  customer_id    TEXT REFERENCES customers(id),
  amount         REAL NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- NOTIFICATIONS (internes, JIKKLO OS)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL,   -- new_order | low_stock | out_of_stock | new_customer | price_change | system_error
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  reference_id  TEXT,            -- ex: order_id, product_id
  read          INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- JOURNAL D'AUDIT
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id),
  user_name     TEXT,
  action        TEXT NOT NULL,     -- ex: product.update, price.change, order.status_change
  entity_type   TEXT,
  entity_id     TEXT,
  details       TEXT,              -- JSON stringifié
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- PARAMÈTRES (settings clé/valeur)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by    TEXT
);

-- ---------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
