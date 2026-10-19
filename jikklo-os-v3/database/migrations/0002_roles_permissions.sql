-- Migration 0002 — Rôles et permissions par défaut
-- Ces données sont NÉCESSAIRES au fonctionnement (pas des données de démo).

INSERT INTO roles (id, name, label) VALUES
  ('role_super_admin', 'super_admin', 'Super Admin'),
  ('role_admin',       'admin',       'Admin'),
  ('role_manager',     'manager',     'Manager'),
  ('role_agent',       'agent',       'Agent / Vendeur')
ON CONFLICT(id) DO NOTHING;

INSERT INTO permissions (id, code, label) VALUES
  ('perm_dashboard_view',    'dashboard.view',    'Voir le dashboard'),
  ('perm_products_view',     'products.view',     'Voir les produits'),
  ('perm_products_edit',     'products.edit',     'Modifier les produits'),
  ('perm_pricing_view',      'pricing.view',       'Voir les prix'),
  ('perm_pricing_edit',      'pricing.edit',       'Modifier les prix'),
  ('perm_inventory_view',    'inventory.view',    'Voir le stock'),
  ('perm_inventory_edit',    'inventory.edit',    'Modifier le stock'),
  ('perm_orders_view',       'orders.view',       'Voir les commandes'),
  ('perm_orders_edit',       'orders.edit',       'Modifier les commandes'),
  ('perm_customers_view',    'customers.view',    'Voir les clients'),
  ('perm_reports_view',      'reports.view',      'Voir les rapports'),
  ('perm_users_manage',      'users.manage',      'Gérer les utilisateurs'),
  ('perm_settings_manage',   'settings.manage',   'Gérer les paramètres'),
  ('perm_audit_view',        'audit.view',        'Voir le journal d''audit')
ON CONFLICT(id) DO NOTHING;

-- Super Admin : toutes les permissions
INSERT INTO role_permissions (role_id, permission_id)
  SELECT 'role_super_admin', id FROM permissions WHERE true
  ON CONFLICT DO NOTHING;

-- Admin : tout sauf gestion des utilisateurs/paramètres système
INSERT INTO role_permissions (role_id, permission_id)
  SELECT 'role_admin', id FROM permissions
  WHERE code NOT IN ('users.manage', 'settings.manage')
  ON CONFLICT DO NOTHING;

-- Manager : opérationnel (produits, prix, stock, commandes, clients, rapports)
INSERT INTO role_permissions (role_id, permission_id)
  SELECT 'role_manager', id FROM permissions
  WHERE code IN (
    'dashboard.view','products.view','products.edit','pricing.view',
    'inventory.view','inventory.edit','orders.view','orders.edit',
    'customers.view','reports.view'
  )
  ON CONFLICT DO NOTHING;

-- Agent : commandes et consultation
INSERT INTO role_permissions (role_id, permission_id)
  SELECT 'role_agent', id FROM permissions
  WHERE code IN (
    'dashboard.view','products.view','pricing.view','inventory.view',
    'orders.view','orders.edit','customers.view'
  )
  ON CONFLICT DO NOTHING;

-- Paramètres par défaut
INSERT INTO settings (key, value) VALUES
  ('company_name', 'JIKKLO SAS'),
  ('currency', 'CDF'),
  ('order_number_prefix', 'JKK'),
  ('whatsapp_enabled', 'false'),
  ('delivery_enabled', 'true')
ON CONFLICT(key) DO NOTHING;
