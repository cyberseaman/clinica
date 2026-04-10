CREATE TABLE IF NOT EXISTS roles (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id)
);

INSERT INTO roles (name, description)
VALUES
  ('clinic_admin', 'Full clinic administration and staff management access.'),
  ('clinic_staff', 'Clinical staff with access to patient and record workflows.'),
  ('front_desk', 'Front desk staff with patient intake and profile management access.'),
  ('billing_staff', 'Billing-focused staff with read access to patient identity details.')
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description;

INSERT INTO permissions (key, description)
VALUES
  ('users.read', 'View clinic users.'),
  ('users.create', 'Create clinic users.'),
  ('users.assign.clinic_admin', 'Assign the clinic_admin role to a user.'),
  ('users.assign.clinic_staff', 'Assign the clinic_staff role to a user.'),
  ('users.assign.front_desk', 'Assign the front_desk role to a user.'),
  ('users.assign.billing_staff', 'Assign the billing_staff role to a user.'),
  ('patients.read', 'View patient profiles inside the clinic scope.'),
  ('patients.create', 'Create patient profiles.'),
  ('patients.update', 'Update patient profiles.'),
  ('records.read', 'View medical records.'),
  ('records.create', 'Create medical records.')
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
  ON (
    (r.name = 'clinic_admin' AND p.key IN (
      'users.read',
      'users.create',
      'users.assign.clinic_admin',
      'users.assign.clinic_staff',
      'users.assign.front_desk',
      'users.assign.billing_staff',
      'patients.read',
      'patients.create',
      'patients.update',
      'records.read',
      'records.create'
    )) OR
    (r.name = 'clinic_staff' AND p.key IN (
      'patients.read',
      'patients.create',
      'patients.update',
      'records.read',
      'records.create'
    )) OR
    (r.name = 'front_desk' AND p.key IN (
      'patients.read',
      'patients.create',
      'patients.update'
    )) OR
    (r.name = 'billing_staff' AND p.key IN (
      'patients.read'
    ))
  )
ON CONFLICT DO NOTHING;

DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND (
    (r.name = 'clinic_admin' AND p.key NOT IN (
      'users.read',
      'users.create',
      'users.assign.clinic_admin',
      'users.assign.clinic_staff',
      'users.assign.front_desk',
      'users.assign.billing_staff',
      'patients.read',
      'patients.create',
      'patients.update',
      'records.read',
      'records.create'
    )) OR
    (r.name = 'clinic_staff' AND p.key NOT IN (
      'patients.read',
      'patients.create',
      'patients.update',
      'records.read',
      'records.create'
    )) OR
    (r.name = 'front_desk' AND p.key NOT IN (
      'patients.read',
      'patients.create',
      'patients.update'
    )) OR
    (r.name = 'billing_staff' AND p.key NOT IN (
      'patients.read'
    ))
  );

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('clinic_admin', 'clinic_staff', 'front_desk', 'billing_staff'));

ALTER TABLE user_invitations DROP CONSTRAINT IF EXISTS user_invitations_role_check;
ALTER TABLE user_invitations
  ADD CONSTRAINT user_invitations_role_check
  CHECK (role IN ('clinic_admin', 'clinic_staff', 'front_desk', 'billing_staff'));
