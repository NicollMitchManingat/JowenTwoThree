-- Unit of measure for inventory rows (kg, L, pcs, ...).
-- Older databases predate this column, which hard-failed embedded selects
-- ("column inventory_1.unit does not exist"). All reads/writes fall back
-- gracefully until this is run. Existing rows default to 'units'.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory') THEN
    ALTER TABLE inventory ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'units';
  END IF;
END $$;
