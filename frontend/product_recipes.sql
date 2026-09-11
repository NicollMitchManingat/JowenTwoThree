-- ============================================================
-- PRODUCT RECIPES (BOM) FOR AUTOMATIC STOCK DEDUCTION
-- Run once in Supabase SQL Editor. Idempotent (safe to re-run).
-- Links products -> inventory with per-sale quantities.
-- Quantities use the SAME unit as each inventory row's stock_quantity.
-- Amounts are plausible starting points — adjust to taste.
-- ============================================================

CREATE TABLE IF NOT EXISTS product_recipes (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  inventory_id uuid NOT NULL REFERENCES inventory(id) ON DELETE RESTRICT,
  qty_per_sale numeric(10,2) NOT NULL CHECK (qty_per_sale > 0),
  PRIMARY KEY (product_id, inventory_id)
);

CREATE INDEX IF NOT EXISTS idx_recipes_product ON product_recipes(product_id);

ALTER TABLE product_recipes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_recipes' AND policyname='anon_all') THEN
    CREATE POLICY anon_all ON public.product_recipes FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- SEED (invented amounts, resolved by name)
-- ============================================================
WITH r(product_name, inventory_name, qty) AS (
  VALUES
    -- Espresso
    ('Espresso', 'Arabica Beans (Dark)', 0.02),
    ('Espresso', 'Paper Cups (12oz)', 1),
    ('Espresso', 'Napkins', 1),
    -- Latte
    ('Latte', 'Arabica Beans (Dark)', 0.02),
    ('Latte', 'Whole Milk', 0.20),
    ('Latte', 'Vanilla Syrup', 0.02),
    ('Latte', 'Paper Cups (12oz)', 1),
    ('Latte', 'Napkins', 1),
    -- Americano
    ('Americano', 'Arabica Beans (Dark)', 0.02),
    ('Americano', 'Paper Cups (12oz)', 1),
    ('Americano', 'Napkins', 1),
    -- Cappuccino
    ('Cappuccino', 'Arabica Beans (Dark)', 0.02),
    ('Cappuccino', 'Whole Milk', 0.25),
    ('Cappuccino', 'Paper Cups (12oz)', 1),
    ('Cappuccino', 'Napkins', 1),
    -- Iced Matcha (no matcha powder row yet — uses oat milk + sugar)
    ('Iced Matcha', 'Oat Milk', 0.25),
    ('Iced Matcha', 'Sugar (White)', 0.02),
    ('Iced Matcha', 'Paper Cups (16oz)', 1),
    ('Iced Matcha', 'Napkins', 1),
    -- Hot Chocolate
    ('Hot Chocolate', 'Whole Milk', 0.20),
    ('Hot Chocolate', 'Chocolate Chips', 0.05),
    ('Hot Chocolate', 'Sugar (White)', 0.02),
    ('Hot Chocolate', 'Paper Cups (12oz)', 1),
    ('Hot Chocolate', 'Napkins', 1),
    -- Iced Coffee
    ('Iced Coffee', 'Arabica Beans (Dark)', 0.02),
    ('Iced Coffee', 'Sugar (White)', 0.02),
    ('Iced Coffee', 'Vanilla Syrup', 0.03),
    ('Iced Coffee', 'Paper Cups (16oz)', 1),
    ('Iced Coffee', 'Napkins', 1),
    -- Milk Tea
    ('Milk Tea', 'Whole Milk', 0.15),
    ('Milk Tea', 'Sugar (White)', 0.03),
    ('Milk Tea', 'Caramel Syrup', 0.03),
    ('Milk Tea', 'Paper Cups (16oz)', 1),
    ('Milk Tea', 'Napkins', 1),
    -- Club Sandwich
    ('Club Sandwich', 'All-Purpose Flour', 0.10),
    ('Club Sandwich', 'Butter', 0.03),
    ('Club Sandwich', 'Takeaway Bags', 1),
    ('Club Sandwich', 'Napkins', 1),
    -- Bacon & Egg Toast
    ('Bacon & Egg Toast', 'All-Purpose Flour', 0.10),
    ('Bacon & Egg Toast', 'Butter', 0.03),
    ('Bacon & Egg Toast', 'Takeaway Bags', 1),
    ('Bacon & Egg Toast', 'Napkins', 1),
    -- Spaghetti Bolognese
    ('Spaghetti Bolognese', 'All-Purpose Flour', 0.20),
    ('Spaghetti Bolognese', 'Takeaway Bags', 1),
    ('Spaghetti Bolognese', 'Napkins', 1),
    -- Chicken Alfredo
    ('Chicken Alfredo', 'All-Purpose Flour', 0.20),
    ('Chicken Alfredo', 'Butter', 0.05),
    ('Chicken Alfredo', 'Takeaway Bags', 1),
    ('Chicken Alfredo', 'Napkins', 1),
    -- Beef Tacos
    ('Beef Tacos', 'All-Purpose Flour', 0.15),
    ('Beef Tacos', 'Takeaway Bags', 1),
    ('Beef Tacos', 'Napkins', 1),
    -- Croissant
    ('Croissant', 'All-Purpose Flour', 0.15),
    ('Croissant', 'Butter', 0.05),
    ('Croissant', 'Takeaway Bags', 1),
    ('Croissant', 'Napkins', 1),
    -- Blueberry Muffin
    ('Blueberry Muffin', 'All-Purpose Flour', 0.12),
    ('Blueberry Muffin', 'Sugar (White)', 0.05),
    ('Blueberry Muffin', 'Blueberries', 0.08),
    ('Blueberry Muffin', 'Butter', 0.03),
    ('Blueberry Muffin', 'Takeaway Bags', 1),
    -- Banana Bread
    ('Banana Bread', 'All-Purpose Flour', 0.12),
    ('Banana Bread', 'Sugar (White)', 0.05),
    ('Banana Bread', 'Butter', 0.03),
    ('Banana Bread', 'Takeaway Bags', 1),
    -- Cinnamon Roll
    ('Cinnamon Roll', 'All-Purpose Flour', 0.12),
    ('Cinnamon Roll', 'Sugar (White)', 0.05),
    ('Cinnamon Roll', 'Butter', 0.03),
    ('Cinnamon Roll', 'Takeaway Bags', 1),
    -- Chocolate Cake
    ('Chocolate Cake', 'All-Purpose Flour', 0.15),
    ('Chocolate Cake', 'Sugar (White)', 0.08),
    ('Chocolate Cake', 'Chocolate Chips', 0.08),
    ('Chocolate Cake', 'Butter', 0.05),
    ('Chocolate Cake', 'Takeaway Bags', 1),
    -- Strawberry Cheesecake
    ('Strawberry Cheesecake', 'Cream Cheese', 0.12),
    ('Strawberry Cheesecake', 'Sugar (White)', 0.05),
    ('Strawberry Cheesecake', 'Fresh Strawberries', 0.10),
    ('Strawberry Cheesecake', 'Butter', 0.03),
    ('Strawberry Cheesecake', 'Takeaway Bags', 1),
    -- Tiramisu
    ('Tiramisu', 'Cream Cheese', 0.10),
    ('Tiramisu', 'Sugar (White)', 0.05),
    ('Tiramisu', 'Chocolate Chips', 0.03),
    ('Tiramisu', 'Takeaway Bags', 1),
    -- Lemon Tart
    ('Lemon Tart', 'All-Purpose Flour', 0.10),
    ('Lemon Tart', 'Sugar (White)', 0.05),
    ('Lemon Tart', 'Butter', 0.04),
    ('Lemon Tart', 'Takeaway Bags', 1)
)
INSERT INTO product_recipes (product_id, inventory_id, qty_per_sale)
SELECT p.id, i.id, r.qty
FROM r
JOIN products p ON p.product_name = r.product_name
JOIN inventory i ON i.name = r.inventory_name
ON CONFLICT DO NOTHING;
