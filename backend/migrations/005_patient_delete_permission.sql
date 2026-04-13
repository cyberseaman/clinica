INSERT INTO permissions (key, description)
VALUES ('patients.delete', 'Delete patient profiles.')
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key = 'patients.delete'
WHERE r.name = 'clinic_admin'
ON CONFLICT DO NOTHING;

DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND p.key = 'patients.delete'
  AND r.name <> 'clinic_admin';
