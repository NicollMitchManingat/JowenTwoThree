-- Admin-managed accounts (replaces hardcoded logins).
-- Passwords are bcrypt hashes (cost 10), generated at build time from the
-- legacy passwords so admin/admin123, cashier/cashier123,
-- stockist/stockist123 keep working with zero manual steps.
--
-- SECURITY: RLS is enabled with NO anon/authenticated policies on purpose.
-- Password hashes must never be readable with the frontend anon key.
-- All access goes through backend endpoints using the service-role key.
-- Do NOT add an anon_all policy here like the other tables have.

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL CHECK (role IN ('admin', 'cashier', 'stockist')),
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

INSERT INTO app_users (username, email, full_name, role, password_hash, is_active, created_by)
VALUES
  ('admin', 'admin@jowen.com', 'Admin User', 'admin', '$2b$10$cFi.g184mACrQztiF.y0wuXbNw1QcNXEjUQkgCffGEc4E25gU6Poq', true, 'seed'),
  ('cashier', 'cashier@jowen.com', 'Cashier', 'cashier', '$2b$10$ajWjB1qlp6sFymahI2w3X.ZdCyjY8dUOFO5wMSyDfLYYxn5Dz3zpG', true, 'seed'),
  ('stockist', 'stockist@jowen.com', 'Stockist', 'stockist', '$2b$10$hIDxKrHHVNtiad59NXHYZOziZyqRfwiBwt32s3TPXdPfm5J3TI70i', true, 'seed')
ON CONFLICT (username) DO NOTHING;
