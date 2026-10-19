-- =====================================================================
-- SEED DE DÉVELOPPEMENT — DONNÉES FICTIVES, NE JAMAIS EXÉCUTER EN PRODUCTION
-- =====================================================================
-- Ne contient plus de compte admin pré-haché (risque corrigé en V2,
-- règle #37). Pour créer un admin, utiliser : node scripts/create-admin.mjs
-- Toutes les valeurs ci-dessous (prix, stock, noms) sont des EXEMPLES.

INSERT INTO categories (id, name, slug, activity, display_order) VALUES
  ('cat_fuel', '[DEMO] Carburant', 'carburant', 'energy', 1),
  ('cat_oil', '[DEMO] Huiles moteur', 'huiles-moteur', 'energy', 2);

INSERT INTO products (id, sku, name, category_id, activity, unit, status) VALUES
  ('prod_essence', '[DEMO]-ESS-01', '[DEMO] Essence', 'cat_fuel', 'energy', 'L', 'published'),
  ('prod_huile', '[DEMO]-HUI-01', '[DEMO] Huile moteur 1L', 'cat_oil', 'energy', 'unit', 'published');

INSERT INTO prices (id, product_id, purchase_price, sale_price, currency) VALUES
  ('price_essence', 'prod_essence', 5000, 5500, 'CDF'),
  ('price_huile', 'prod_huile', 10000, 15000, 'CDF');

INSERT INTO inventory (id, product_id, quantity, min_threshold) VALUES
  ('inv_essence', 'prod_essence', 100, 20),
  ('inv_huile', 'prod_huile', 15, 5);
