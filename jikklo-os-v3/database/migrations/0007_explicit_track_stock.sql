-- Migration 0007 — track_stock explicite (correction prioritaire V4.1)
-- ---------------------------------------------------------------------
-- PROBLÈME CORRIGÉ : la migration 0006 a rendu la création de la ligne
-- `inventory` conditionnelle selon `offer_type` (un service/une recharge
-- n'en ont pas). Mais `routes/orders.ts` contenait encore une vérification
-- héritée du schéma d'avant 0006 : "l'absence de ligne inventory est une
-- incohérence de données" → elle REJETAIT la commande avec
-- INVENTORY_NOT_CONFIGURED pour tout produit sans stock suivi. Un service
-- ou une recharge créés via 0006 ne pouvaient donc jamais être commandés.
--
-- CORRECTION : au lieu de déduire "stock suivi ou non" depuis la simple
-- présence/absence d'une ligne inventory (ambigu : elle peut être absente
-- par bug OU par design), on rend l'intention EXPLICITE avec une colonne
-- dédiée. C'est cette colonne, et uniquement elle, qui pilote désormais la
-- décision "faut-il vérifier/décrémenter le stock ?" dans orders.ts.
-- ---------------------------------------------------------------------

ALTER TABLE products ADD COLUMN track_stock INTEGER NOT NULL DEFAULT 1;

-- Backfill cohérent avec les données existantes :
--   - Un produit qui a déjà une ligne inventory a évidemment un stock suivi.
--   - Un produit sans ligne inventory (impossible avant 0006, mais possible
--     pour les offres de type service/topup/package/subscription/other
--     créées après 0006) est marqué comme non suivi.
UPDATE products SET track_stock = 1
  WHERE id IN (SELECT product_id FROM inventory);
UPDATE products SET track_stock = 0
  WHERE id NOT IN (SELECT product_id FROM inventory);

-- Index utile : les requêtes de commande filtrent souvent par cette colonne.
CREATE INDEX IF NOT EXISTS idx_products_track_stock ON products(track_stock);
