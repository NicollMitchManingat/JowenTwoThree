-- Per-item special instructions for POS cart lines.
-- Run ONCE in Supabase: Dashboard → SQL → New query → paste → Run.
-- Safe to re-run (IF NOT EXISTS). Required before taking orders with the
-- quick-add + cart-note flow, otherwise checkout inserts will fail on the
-- unknown `note` column.
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS note TEXT;
