-- Migration 0004 — V2 : livraison configurable, module Finance, nouvelles permissions

-- Livraison configurable (règle #15) — remplace le deliveryFee = 0 codé en dur
INSERT INTO settings (key, value) VALUES
  ('delivery_mode', 'fixed'),          -- fixed | free | by_zone
  ('delivery_fixed_fee', '0'),
  ('delivery_free_above', '0'),        -- 0 = désactivé
  ('business_whatsapp_number', ''),    -- numéro WhatsApp de l'entreprise (sans +, ex: 243900000000)
  ('currency', 'CDF')
ON CONFLICT(key) DO NOTHING;

-- ---------------------------------------------------------------------
-- FINANCE (règle #29) — première couche, pas une comptabilité certifiée
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finance_entries (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category      TEXT NOT NULL,          -- ex: sale, purchase, salary, rent, other
  amount        REAL NOT NULL CHECK (amount > 0),
  currency      TEXT NOT NULL DEFAULT 'CDF',
  activity      TEXT,                   -- energy | digital | general
  reference     TEXT,                   -- ex: order_number lié
  notes         TEXT,
  created_by    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_finance_entries_type ON finance_entries(type, created_at);

-- ---------------------------------------------------------------------
-- Nouvelles permissions (Digital, Fournisseurs, Finance, Images)
-- ---------------------------------------------------------------------
INSERT INTO permissions (id, code, label) VALUES
  ('perm_digital_view',   'digital.view',   'Voir Jikklo Digital'),
  ('perm_digital_edit',   'digital.edit',   'Gérer Jikklo Digital'),
  ('perm_suppliers_view', 'suppliers.view', 'Voir les fournisseurs'),
  ('perm_suppliers_edit', 'suppliers.edit', 'Gérer les fournisseurs'),
  ('perm_finance_view',   'finance.view',   'Voir les finances'),
  ('perm_finance_edit',   'finance.edit',   'Gérer les finances'),
  ('perm_media_upload',   'media.upload',   'Uploader des images produits')
ON CONFLICT(id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
  SELECT 'role_super_admin', id FROM permissions
  WHERE code IN ('digital.view','digital.edit','suppliers.view','suppliers.edit','finance.view','finance.edit','media.upload')
  ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
  SELECT 'role_admin', id FROM permissions
  WHERE code IN ('digital.view','digital.edit','suppliers.view','suppliers.edit','finance.view','media.upload')
  ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
  SELECT 'role_manager', id FROM permissions
  WHERE code IN ('digital.view','suppliers.view','finance.view','media.upload')
  ON CONFLICT DO NOTHING;
