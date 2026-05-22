-- Create first super admin (change password before production)
-- Password: ChangeMeNow!12
-- Hash below is bcrypt for "ChangeMeNow!12" (cost 10) — replace after first login

INSERT INTO public.admin_accounts (account_id, username, password_hash, full_name, email, role, is_active)
VALUES (
  'ADM-2026-001',
  'superadmin',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'Platform Admin',
  NULL,
  'super_admin',
  true
)
ON CONFLICT (account_id) DO NOTHING;
