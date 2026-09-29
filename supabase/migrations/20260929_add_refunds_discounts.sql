-- Refunds + custom discount vouchers.
-- Money-only refunds (no inventory restock). Legacy rows default to COMPLETED.

-- ── Discount vouchers ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('percent', 'flat')),
  value numeric(10,2) NOT NULL CHECK (value > 0),
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Statutory rates are locked (is_system): PWD/Senior 20% cannot be
-- edited, deactivated, or deleted from the admin UI. Promo ships as a
-- regular editable row.
INSERT INTO discounts (name, type, value, is_active, is_system, created_by)
VALUES
  ('PWD', 'percent', 20, true, true, 'seed'),
  ('Senior', 'percent', 20, true, true, 'seed'),
  ('Promo', 'percent', 10, true, false, 'seed')
ON CONFLICT (name) DO NOTHING;

-- ── Transaction status + voucher link ──────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') THEN
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'COMPLETED'
      CHECK (status IN ('COMPLETED', 'REFUNDED', 'PARTIALLY_REFUNDED'));
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS discount_id uuid
      REFERENCES discounts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── Refund records (append-only; transaction rows are never deleted) ──
CREATE TABLE IF NOT EXISTS refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  refund_amount numeric(10,2) NOT NULL CHECK (refund_amount >= 0),
  reason text NOT NULL,
  notes text,
  approved_by text NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_transaction ON refunds(transaction_id);

-- ── RLS policies (anon key app, same anon_all posture as products/transactions) ──
-- Without these, any write to the new tables fails with
-- "new row violates row-level security policy" once RLS is enabled.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'discounts' AND policyname = 'anon_all') THEN
    CREATE POLICY anon_all ON public.discounts FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'refunds' AND policyname = 'anon_all') THEN
    CREATE POLICY anon_all ON public.refunds FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;
