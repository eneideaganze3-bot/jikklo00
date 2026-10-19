-- Migration 0005 — Contenu bilingue (FR/EN) pour le catalogue public
-- ---------------------------------------------------------------------
-- CONTEXTE (intégration du vrai site jikklo.com, août 2026) :
-- Le vrai frontend jikklo.com est bilingue français/anglais pour CHAQUE
-- produit (nom, description courte, description longue, liste de
-- caractéristiques). Le schéma V1/V2/V3 ne stockait qu'une seule langue
-- par produit (colonnes `name`, `description`).
--
-- Cette migration AJOUTE des colonnes nullables — elle ne supprime et ne
-- renomme rien, donc aucune donnée existante n'est perdue et aucune API
-- existante n'est cassée. La convention retenue :
--   - `products.name` / `products.description` restent la version FRANÇAISE
--     (comportement historique, l'équipe JIKKLO opère en français).
--   - Les nouvelles colonnes `*_en` portent la version anglaise.
--   - `details_fr` / `details_en` portent la description longue (fiche
--     produit), distincte de la description courte (carte produit).
--   - `characteristics_fr` / `characteristics_en` sont des tableaux JSON
--     stringifiés (ex: '["Vendu au litre","Quantité personnalisable"]').
--   - `subcategory` reprend la sous-catégorie libre utilisée par le vrai
--     site (ex: "fuel", "engine-oil", "grease", "accessories", "care",
--     "topup") pour le choix de l'icône de repli et certains filtres.
--
-- Tant qu'un produit n'a pas de valeur `_en`, l'API publique retombe sur
-- la version française plutôt que d'afficher un champ vide (voir
-- routes/misc.ts). C'est un compromis honnête : mieux vaut du français
-- affiché côté anglais que rien du tout, en attendant la traduction.
-- ---------------------------------------------------------------------

ALTER TABLE products ADD COLUMN name_en TEXT;
ALTER TABLE products ADD COLUMN description_en TEXT;
ALTER TABLE products ADD COLUMN details_fr TEXT;
ALTER TABLE products ADD COLUMN details_en TEXT;
ALTER TABLE products ADD COLUMN characteristics_fr TEXT; -- JSON array stringifié
ALTER TABLE products ADD COLUMN characteristics_en TEXT; -- JSON array stringifié
ALTER TABLE products ADD COLUMN subcategory TEXT;
