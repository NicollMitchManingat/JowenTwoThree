-- RLS write-gap fix (run in Supabase SQL Editor, idempotent).
-- Live DB already has RLS enabled + anon read policies; DO NOT DISABLE RLS.
-- This only adds the missing inventory INSERT/DELETE needed by InventoryPage Add/Delete.
-- Existing policies (products/transactions anon_all, inventory SELECT/UPDATE) are left untouched.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='inventory' AND policyname='Allow public insert access on inventory') THEN
    CREATE POLICY "Allow public insert access on inventory" ON public.inventory FOR INSERT TO public WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='inventory' AND policyname='Allow public delete access on inventory') THEN
    CREATE POLICY "Allow public delete access on inventory" ON public.inventory FOR DELETE TO public USING (true);
  END IF;
END $$;

-- Refunds + discount vouchers (supabase/migrations/20260929_add_refunds_discounts.sql).
-- New tables need the same anon_all posture as products/transactions,
-- otherwise writes fail with "new row violates row-level security policy".
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='discounts' AND policyname='anon_all') THEN
    CREATE POLICY anon_all ON public.discounts FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='refunds' AND policyname='anon_all') THEN
    CREATE POLICY anon_all ON public.refunds FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;
