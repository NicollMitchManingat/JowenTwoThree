-- ============================================================
-- PRODUCT RECIPES V2 — realistic pantry + meal remap
-- Run AFTER frontend/product_recipes.sql, in Supabase SQL Editor.
-- Idempotent (safe to re-run).
-- Adds ~11 real ingredient rows, then swaps flour-proxy recipe
-- lines for the meals onto the real ingredients.
-- Past deductions / adjustments are untouched (no backfill).
-- ============================================================

-- ── 1. New pantry rows (invented opening stocks) ────────────
INSERT INTO inventory (name, category, stock_quantity)
SELECT v.name, v.category, v.qty
FROM (VALUES
  ('Matcha Powder', 'Ingredients', 2),
  ('Black Tea Leaves', 'Ingredients', 2),
  ('Sandwich Bread', 'Ingredients', 40),
  ('Pasta', 'Ingredients', 10),
  ('Taco Shells', 'Ingredients', 30),
  ('Bacon', 'Ingredients', 5),
  ('Eggs', 'Ingredients', 60),
  ('Chicken Breast', 'Ingredients', 8),
  ('Ground Beef', 'Ingredients', 8),
  ('Bananas', 'Fruits', 15),
  ('Lemons', 'Fruits', 20)
) AS v(name, category, qty)
WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE name = v.name);

-- ── 2. Drop obsolete flour-proxy lines for the remapped meals ──
DELETE FROM product_recipes
USING products p, inventory i
WHERE product_recipes.product_id = p.id
  AND product_recipes.inventory_id = i.id
  AND (
    -- Meals move off flour entirely (drinks keep their lines;
    -- the new tea/meat rows below are pure additions)
    p.product_name IN ('Club Sandwich', 'Bacon & Egg Toast', 'Spaghetti Bolognese',
                        'Chicken Alfredo', 'Beef Tacos') AND i.name = 'All-Purpose Flour'
  );

-- ── 3. New mappings (insert-only, ON CONFLICT DO NOTHING) ──
WITH r(product_name, inventory_name, qty) AS (
  VALUES
    -- Iced Matcha: real matcha powder
    ('Iced Matcha', 'Matcha Powder', 0.03),
    ('Iced Matcha', 'Oat Milk', 0.25),
    -- Milk Tea: real black tea
    ('Milk Tea', 'Black Tea Leaves', 0.02),
    ('Milk Tea', 'Whole Milk', 0.15),
    -- Club Sandwich: real bread
    ('Club Sandwich', 'Sandwich Bread', 2),
    ('Club Sandwich', 'Butter', 0.02),
    -- Bacon & Egg Toast: real bacon + eggs + bread
    ('Bacon & Egg Toast', 'Sandwich Bread', 2),
    ('Bacon & Egg Toast', 'Bacon', 2),
    ('Bacon & Egg Toast', 'Eggs', 2),
    ('Bacon & Egg Toast', 'Butter', 0.02),
    -- Spaghetti Bolognese: pasta + beef
    ('Spaghetti Bolognese', 'Pasta', 0.20),
    ('Spaghetti Bolognese', 'Ground Beef', 0.15),
    -- Chicken Alfredo: pasta + chicken
    ('Chicken Alfredo', 'Pasta', 0.20),
    ('Chicken Alfredo', 'Chicken Breast', 0.15),
    ('Chicken Alfredo', 'Butter', 0.05),
    -- Beef Tacos: shells + beef
    ('Beef Tacos', 'Taco Shells', 3),
    ('Beef Tacos', 'Ground Beef', 0.15),
    -- Banana Bread: + bananas
    ('Banana Bread', 'Bananas', 1),
    -- Lemon Tart: + lemons
    ('Lemon Tart', 'Lemons', 1)
)
INSERT INTO product_recipes (product_id, inventory_id, qty_per_sale)
SELECT p.id, i.id, r.qty
FROM r
JOIN products p ON p.product_name = r.product_name
JOIN inventory i ON i.name = r.inventory_name
ON CONFLICT DO NOTHING;
