-- Migration 0003 — V2 : sécurité transactionnelle
-- =====================================================================
-- Problème corrigé : le stock pouvait devenir négatif en cas de commandes
-- simultanées, et la génération du numéro de commande (COUNT(*)+1) pouvait
-- produire des collisions.
-- =====================================================================

-- SQLite/D1 ne permet pas d'ajouter un CHECK sur une table existante via
-- ALTER TABLE. On recrée la table inventory avec la contrainte.
PRAGMA foreign_keys = OFF;

CREATE TABLE inventory_new (
  id             TEXT PRIMARY KEY,
  product_id     TEXT NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  quantity       REAL NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_threshold  REAL NOT NULL DEFAULT 5,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO inventory_new SELECT * FROM inventory;
DROP TABLE inventory;
ALTER TABLE inventory_new RENAME TO inventory;

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- Compteur de commande atomique (évite COUNT(*)+1, sujet aux collisions
-- en cas d'écritures concurrentes). Une ligne par année.
-- Le numéro final est généré via :
--   INSERT ... ON CONFLICT DO UPDATE SET next_value = next_value + 1
--   RETURNING next_value
-- qui est une opération atomique unique en SQLite.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_counters (
  year        INTEGER PRIMARY KEY,
  next_value  INTEGER NOT NULL DEFAULT 0
);

-- Contrainte supplémentaire : une quantité de ligne de commande ne peut
-- jamais être négative ou nulle (règle #6 de la V2).
-- (order_items.quantity n'avait pas de CHECK — on la recrée aussi.)
CREATE TABLE order_items_new (
  id             TEXT PRIMARY KEY,
  order_id       TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id     TEXT NOT NULL REFERENCES products(id),
  product_name   TEXT NOT NULL,
  unit_price     REAL NOT NULL CHECK (unit_price >= 0),
  quantity       REAL NOT NULL CHECK (quantity > 0),
  line_total     REAL NOT NULL CHECK (line_total >= 0)
);
INSERT INTO order_items_new SELECT * FROM order_items;
DROP TABLE order_items;
ALTER TABLE order_items_new RENAME TO order_items;
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
