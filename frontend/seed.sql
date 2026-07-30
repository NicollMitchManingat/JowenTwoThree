-- ============================================================
-- SEED DATA FOR JOWEN'S KITCHEN & CAFE
-- ============================================================

INSERT INTO product_categories (name, description) VALUES
  ('Drinks', 'Hot and cold beverages including coffee, tea, and specialty drinks'),
  ('Meals', 'Sandwiches, pasta, and hearty breakfast meals'),
  ('Pastries', 'Freshly baked breads, croissants, and muffins'),
  ('Desserts', 'Cakes, cheesecakes, and sweet treats');

WITH cats AS (SELECT id, name FROM product_categories)
INSERT INTO products (category_id, product_name, selling_price, status)
SELECT c.id, p.name, p.price, 'ACTIVE'
FROM cats c, (
  VALUES
    ('Drinks', 'Espresso', 150), ('Drinks', 'Latte', 180),
    ('Drinks', 'Americano', 160), ('Drinks', 'Cappuccino', 180),
    ('Drinks', 'Iced Matcha', 220), ('Drinks', 'Hot Chocolate', 170),
    ('Drinks', 'Iced Coffee', 140), ('Drinks', 'Milk Tea', 190),
    ('Meals', 'Club Sandwich', 250), ('Meals', 'Bacon & Egg Toast', 190),
    ('Meals', 'Spaghetti Bolognese', 280), ('Meals', 'Chicken Alfredo', 290),
    ('Meals', 'Beef Tacos', 220),
    ('Pastries', 'Croissant', 120), ('Pastries', 'Blueberry Muffin', 140),
    ('Pastries', 'Banana Bread', 130), ('Pastries', 'Cinnamon Roll', 150),
    ('Desserts', 'Chocolate Cake', 150), ('Desserts', 'Strawberry Cheesecake', 180),
    ('Desserts', 'Tiramisu', 200), ('Desserts', 'Lemon Tart', 160)
) AS p(cat_name, name, price)
WHERE c.name = p.cat_name;

INSERT INTO inventory (name, category, stock_quantity) VALUES
  ('Arabica Beans (Dark)', 'Ingredients', 12), ('Whole Milk', 'Dairy', 8),
  ('Oat Milk', 'Dairy', 15), ('Vanilla Syrup', 'Syrups', 2),
  ('Caramel Syrup', 'Syrups', 5), ('Paper Cups (12oz)', 'Packaging', 450),
  ('Paper Cups (16oz)', 'Packaging', 300), ('Fresh Strawberries', 'Fruits', 1.5),
  ('Blueberries', 'Fruits', 3), ('All-Purpose Flour', 'Ingredients', 10),
  ('Sugar (White)', 'Ingredients', 8), ('Butter', 'Dairy', 4),
  ('Cream Cheese', 'Dairy', 3), ('Chocolate Chips', 'Ingredients', 6),
  ('Napkins', 'Packaging', 600), ('Takeaway Bags', 'Packaging', 200);

INSERT INTO customer_traffic (number_of_customer, created_at) VALUES
  (15, NOW() - INTERVAL '7 days' + TIME '07:00:00'),
  (28, NOW() - INTERVAL '7 days' + TIME '10:00:00'),
  (35, NOW() - INTERVAL '7 days' + TIME '12:00:00'),
  (22, NOW() - INTERVAL '7 days' + TIME '15:00:00'),
  (18, NOW() - INTERVAL '7 days' + TIME '18:00:00'),
  (20, NOW() - INTERVAL '6 days' + TIME '08:00:00'),
  (32, NOW() - INTERVAL '6 days' + TIME '11:00:00'),
  (40, NOW() - INTERVAL '6 days' + TIME '13:00:00'),
  (25, NOW() - INTERVAL '6 days' + TIME '16:00:00'),
  (12, NOW() - INTERVAL '5 days' + TIME '09:00:00'),
  (30, NOW() - INTERVAL '5 days' + TIME '12:00:00'),
  (38, NOW() - INTERVAL '5 days' + TIME '14:00:00'),
  (20, NOW() - INTERVAL '5 days' + TIME '17:00:00'),
  (10, NOW() - INTERVAL '4 days' + TIME '07:30:00'),
  (22, NOW() - INTERVAL '4 days' + TIME '10:30:00'),
  (45, NOW() - INTERVAL '4 days' + TIME '12:30:00'),
  (30, NOW() - INTERVAL '4 days' + TIME '15:30:00'),
  (15, NOW() - INTERVAL '4 days' + TIME '19:00:00'),
  (18, NOW() - INTERVAL '3 days' + TIME '08:00:00'),
  (35, NOW() - INTERVAL '3 days' + TIME '11:00:00'),
  (42, NOW() - INTERVAL '3 days' + TIME '13:00:00'),
  (28, NOW() - INTERVAL '3 days' + TIME '16:00:00'),
  (8,  NOW() - INTERVAL '2 days' + TIME '07:00:00'),
  (25, NOW() - INTERVAL '2 days' + TIME '10:00:00'),
  (50, NOW() - INTERVAL '2 days' + TIME '12:00:00'),
  (35, NOW() - INTERVAL '2 days' + TIME '15:00:00'),
  (12, NOW() - INTERVAL '1 day'  + TIME '08:30:00'),
  (30, NOW() - INTERVAL '1 day'  + TIME '11:30:00'),
  (48, NOW() - INTERVAL '1 day'  + TIME '13:30:00'),
  (32, NOW() - INTERVAL '1 day'  + TIME '16:30:00'),
  (5,  NOW() + TIME '07:00:00'), (12, NOW() + TIME '09:00:00'),
  (20, NOW() + TIME '11:00:00'), (8,  NOW() + TIME '14:00:00');

DO $$
DECLARE
  espresso_id    UUID; latte_id      UUID; americano_id  UUID;
  matcha_id      UUID; club_id       UUID; bacon_id      UUID;
  croissant_id   UUID; muffin_id     UUID; choc_cake_id  UUID;
  cheesecake_id  UUID;
  txn_id         UUID;
  strawberry_id  UUID; milk_id       UUID; blueberries_id UUID;
BEGIN
  SELECT id INTO espresso_id   FROM products WHERE product_name = 'Espresso' LIMIT 1;
  SELECT id INTO latte_id      FROM products WHERE product_name = 'Latte' LIMIT 1;
  SELECT id INTO americano_id  FROM products WHERE product_name = 'Americano' LIMIT 1;
  SELECT id INTO matcha_id     FROM products WHERE product_name = 'Iced Matcha' LIMIT 1;
  SELECT id INTO club_id       FROM products WHERE product_name = 'Club Sandwich' LIMIT 1;
  SELECT id INTO bacon_id      FROM products WHERE product_name = 'Bacon & Egg Toast' LIMIT 1;
  SELECT id INTO croissant_id  FROM products WHERE product_name = 'Croissant' LIMIT 1;
  SELECT id INTO muffin_id     FROM products WHERE product_name = 'Blueberry Muffin' LIMIT 1;
  SELECT id INTO choc_cake_id  FROM products WHERE product_name = 'Chocolate Cake' LIMIT 1;
  SELECT id INTO cheesecake_id FROM products WHERE product_name = 'Strawberry Cheesecake' LIMIT 1;

  INSERT INTO transactions (transaction_number, idempotency_key, subtotal, discount, total, payment_method, cash_received, change_amount, customer_count, discount_type, discount_value, cart, created_at)
  VALUES ('TXN-1001', gen_random_uuid()::text, 450, 0, 450, 'CASH', 500, 50, 3, NULL, 0,
    jsonb_build_array(
      jsonb_build_object('productId', espresso_id, 'name', 'Espresso', 'price', 150, 'qty', 2),
      jsonb_build_object('productId', croissant_id, 'name', 'Croissant', 'price', 120, 'qty', 1),
      jsonb_build_object('productId', muffin_id, 'name', 'Blueberry Muffin', 'price', 140, 'qty', 1)
    ), NOW() - INTERVAL '2 hours')
  RETURNING id INTO txn_id;
  INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price, subtotal) VALUES
    (txn_id, espresso_id, 2, 150, 300), (txn_id, croissant_id, 1, 120, 120), (txn_id, muffin_id, 1, 140, 140);

  INSERT INTO transactions (transaction_number, idempotency_key, subtotal, discount, total, payment_method, cash_received, change_amount, customer_count, discount_type, discount_value, cart, created_at)
  VALUES ('TXN-1002', gen_random_uuid()::text, 360, 72, 288, 'CASH', 300, 12, 2, 'senior', 72,
    jsonb_build_array(jsonb_build_object('productId', latte_id, 'name', 'Latte', 'price', 180, 'qty', 2)),
    NOW() - INTERVAL '90 minutes')
  RETURNING id INTO txn_id;
  INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price, subtotal) VALUES (txn_id, latte_id, 2, 180, 360);

  INSERT INTO transactions (transaction_number, idempotency_key, subtotal, discount, total, payment_method, cash_received, change_amount, customer_count, discount_type, discount_value, cart, created_at)
  VALUES ('TXN-1003', gen_random_uuid()::text, 600, 0, 600, 'CASH', 600, 0, 4, NULL, 0,
    jsonb_build_array(
      jsonb_build_object('productId', club_id, 'name', 'Club Sandwich', 'price', 250, 'qty', 1),
      jsonb_build_object('productId', bacon_id, 'name', 'Bacon & Egg Toast', 'price', 190, 'qty', 1),
      jsonb_build_object('productId', americano_id, 'name', 'Americano', 'price', 160, 'qty', 1)
    ), NOW() - INTERVAL '60 minutes')
  RETURNING id INTO txn_id;
  INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price, subtotal) VALUES
    (txn_id, club_id, 1, 250, 250), (txn_id, bacon_id, 1, 190, 190), (txn_id, americano_id, 1, 160, 160);

  INSERT INTO transactions (transaction_number, idempotency_key, subtotal, discount, total, payment_method, cash_received, change_amount, customer_count, discount_type, discount_value, cart, created_at)
  VALUES ('TXN-1004', gen_random_uuid()::text, 370, 37, 333, 'CASH', 400, 67, 1, 'promo', 37,
    jsonb_build_array(
      jsonb_build_object('productId', matcha_id, 'name', 'Iced Matcha', 'price', 220, 'qty', 1),
      jsonb_build_object('productId', choc_cake_id, 'name', 'Chocolate Cake', 'price', 150, 'qty', 1)
    ), NOW() - INTERVAL '30 minutes')
  RETURNING id INTO txn_id;
  INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price, subtotal) VALUES (txn_id, matcha_id, 1, 220, 220), (txn_id, choc_cake_id, 1, 150, 150);

  INSERT INTO transactions (transaction_number, idempotency_key, subtotal, discount, total, payment_method, cash_received, change_amount, customer_count, discount_type, discount_value, cart, created_at)
  VALUES ('TXN-1005', gen_random_uuid()::text, 360, 0, 360, 'CARD', NULL, NULL, 2, NULL, 0,
    jsonb_build_array(
      jsonb_build_object('productId', cheesecake_id, 'name', 'Strawberry Cheesecake', 'price', 180, 'qty', 1),
      jsonb_build_object('productId', latte_id, 'name', 'Latte', 'price', 180, 'qty', 1)
    ), NOW() - INTERVAL '15 minutes')
  RETURNING id INTO txn_id;
  INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price, subtotal) VALUES (txn_id, cheesecake_id, 1, 180, 180), (txn_id, latte_id, 1, 180, 180);

  INSERT INTO transactions (transaction_number, idempotency_key, subtotal, discount, total, payment_method, cash_received, change_amount, customer_count, discount_type, discount_value, cart, created_at)
  VALUES ('TXN-1006', gen_random_uuid()::text, 820, 0, 820, 'CASH', 1000, 180, 5, NULL, 0,
    jsonb_build_array(
      jsonb_build_object('productId', club_id, 'name', 'Club Sandwich', 'price', 250, 'qty', 2),
      jsonb_build_object('productId', espresso_id, 'name', 'Espresso', 'price', 150, 'qty', 2),
      jsonb_build_object('productId', cheesecake_id, 'name', 'Strawberry Cheesecake', 'price', 180, 'qty', 1)
    ), NOW() - INTERVAL '1 day')
  RETURNING id INTO txn_id;
  INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price, subtotal) VALUES
    (txn_id, club_id, 2, 250, 500), (txn_id, espresso_id, 2, 150, 300), (txn_id, cheesecake_id, 1, 180, 180);

  INSERT INTO transactions (transaction_number, idempotency_key, subtotal, discount, total, payment_method, cash_received, change_amount, customer_count, discount_type, discount_value, cart, created_at)
  VALUES ('TXN-1007', gen_random_uuid()::text, 350, 0, 350, 'CARD', NULL, NULL, 1, NULL, 0,
    jsonb_build_array(
      jsonb_build_object('productId', bacon_id, 'name', 'Bacon & Egg Toast', 'price', 190, 'qty', 1),
      jsonb_build_object('productId', americano_id, 'name', 'Americano', 'price', 160, 'qty', 1)
    ), NOW() - INTERVAL '1 day' + INTERVAL '3 hours')
  RETURNING id INTO txn_id;
  INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price, subtotal) VALUES (txn_id, bacon_id, 1, 190, 190), (txn_id, americano_id, 1, 160, 160);

  INSERT INTO transactions (transaction_number, idempotency_key, subtotal, discount, total, payment_method, cash_received, change_amount, customer_count, discount_type, discount_value, cart, created_at)
  VALUES ('TXN-1008', gen_random_uuid()::text, 440, 0, 440, 'CASH', 500, 60, 4, NULL, 0,
    jsonb_build_array(
      jsonb_build_object('productId', choc_cake_id, 'name', 'Chocolate Cake', 'price', 150, 'qty', 1),
      jsonb_build_object('productId', matcha_id, 'name', 'Iced Matcha', 'price', 220, 'qty', 1),
      jsonb_build_object('productId', muffin_id, 'name', 'Blueberry Muffin', 'price', 140, 'qty', 1)
    ), NOW() - INTERVAL '2 days')
  RETURNING id INTO txn_id;
  INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price, subtotal) VALUES
    (txn_id, choc_cake_id, 1, 150, 150), (txn_id, matcha_id, 1, 220, 200), (txn_id, muffin_id, 1, 140, 140);

  -- Wastage / Inventory Adjustments
  SELECT id INTO strawberry_id FROM inventory WHERE name = 'Fresh Strawberries' LIMIT 1;
  SELECT id INTO milk_id FROM inventory WHERE name = 'Whole Milk' LIMIT 1;
  SELECT id INTO blueberries_id FROM inventory WHERE name = 'Blueberries' LIMIT 1;

  INSERT INTO inventory_adjustments (inventory_id, previous_quantity, new_quantity, change_amount, reason, notes, created_at)
  VALUES
    (strawberry_id, 1.5, 0.5, -1, 'spoiled', 'Left out overnight', NOW() - INTERVAL '3 hours'),
    (milk_id, 8, 6, -2, 'expired', 'Past expiry date', NOW() - INTERVAL '1 day'),
    (blueberries_id, 3, 1, -2, 'damaged', 'Container leaked', NOW() - INTERVAL '2 days');
END $$;
