-- Gender breakdown for customer traffic counts.
-- Existing rows keep M/F at 0 and count toward total only (treated as unspecified).

-- customer_traffic walk-ins (may not exist on all environments — guard with DO blocks)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_traffic') THEN
    ALTER TABLE customer_traffic ADD COLUMN IF NOT EXISTS male_count integer NOT NULL DEFAULT 0 CHECK (male_count >= 0);
    ALTER TABLE customer_traffic ADD COLUMN IF NOT EXISTS female_count integer NOT NULL DEFAULT 0 CHECK (female_count >= 0);
    ALTER TABLE customer_traffic ADD COLUMN IF NOT EXISTS unspecified_count integer NOT NULL DEFAULT 0 CHECK (unspecified_count >= 0);
    -- Backfill legacy rows: total lives in number_of_customer → unspecified bucket
    UPDATE customer_traffic
    SET unspecified_count = COALESCE(number_of_customer, 0)
    WHERE COALESCE(male_count, 0) = 0
      AND COALESCE(female_count, 0) = 0
      AND COALESCE(unspecified_count, 0) = 0;
  END IF;
END $$;

-- transactions attached to sales
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') THEN
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS male_count integer NOT NULL DEFAULT 0 CHECK (male_count >= 0);
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS female_count integer NOT NULL DEFAULT 0 CHECK (female_count >= 0);
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS unspecified_count integer NOT NULL DEFAULT 0 CHECK (unspecified_count >= 0);
    -- Legacy rows only have customer_count → treat as unspecified
    UPDATE transactions
    SET unspecified_count = COALESCE(customer_count, 0)
    WHERE COALESCE(male_count, 0) = 0
      AND COALESCE(female_count, 0) = 0
      AND COALESCE(unspecified_count, 0) = 0;
  END IF;
END $$;
