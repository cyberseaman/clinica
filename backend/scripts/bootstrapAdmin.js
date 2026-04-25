const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const { buildPoolConfig } = require('../shared/postgres');

function requireEnv(name) {
  const value = process.env[name];

  if (!value || !String(value).trim()) {
    throw new Error(`${name} is required.`);
  }

  return String(value).trim();
}

function optionalEnv(name) {
  const value = process.env[name];
  return value ? String(value).trim() : '';
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function ensureNamedReference(pool, tableName, name) {
  await pool.query(
    `INSERT INTO ${tableName} (name)
     VALUES ($1)
     ON CONFLICT (name) DO NOTHING`,
    [name]
  );
}

async function ensureStaffRole(pool, departmentName, roleName) {
  await pool.query(
    `INSERT INTO staff_roles (department_id, name)
     VALUES ((SELECT id FROM departments WHERE name = $1 LIMIT 1), $2)
     ON CONFLICT (name) DO UPDATE
     SET department_id = EXCLUDED.department_id`,
    [departmentName, roleName]
  );
}

async function ensurePermission(pool, code, name, description) {
  await pool.query(
    `INSERT INTO permissions (code, name, description, is_category_scoped)
     VALUES ($1, $2, $3, FALSE)
     ON CONFLICT (code) DO UPDATE
     SET name = EXCLUDED.name,
         description = EXCLUDED.description,
         is_category_scoped = FALSE`,
    [code, name, description]
  );
}

async function seedAdminEmployeeReferenceData(pool) {
  await ensureNamedReference(pool, 'employment_types', 'Full Time');
  await ensureNamedReference(pool, 'provider_types', 'Other');
  await ensureNamedReference(pool, 'departments', 'Administration');
  await ensureNamedReference(pool, 'primary_roles', 'Administrative lead');
  await ensureNamedReference(pool, 'shift_types', 'Day');
  await ensureNamedReference(pool, 'operational_service_lines', 'Office coordination');
  await ensureNamedReference(pool, 'operational_service_lines', 'Internal reporting');
  await ensureNamedReference(pool, 'operational_systems', 'Patient Messaging');
  await ensureNamedReference(pool, 'operational_systems', 'Scheduling Board');
  await ensureNamedReference(pool, 'communication_channels', 'Email');
  await ensureNamedReference(pool, 'communication_channels', 'Secure internal chat');
  await ensureStaffRole(pool, 'Administration', 'Operations Coordinator');
  await ensurePermission(
    pool,
    'employee.create',
    'Create employees',
    'Create new employee accounts and onboarding profiles.'
  );
}

async function bootstrapAdmin() {
  const clinicName = requireEnv('SEED_CLINIC_NAME');
  const clinicSlug = optionalEnv('SEED_CLINIC_SLUG') || slugify(clinicName);
  const adminEmail = requireEnv('SEED_ADMIN_EMAIL').toLowerCase();
  const adminPassword = requireEnv('SEED_ADMIN_PASSWORD');
  const adminFirstName = optionalEnv('SEED_ADMIN_FIRST_NAME') || 'Avery';
  const adminLastName = optionalEnv('SEED_ADMIN_LAST_NAME') || 'Morgan';
  const adminPhone = optionalEnv('SEED_ADMIN_PHONE') || '(555) 010-0311';

  const authPool = new Pool(
    buildPoolConfig({
      databaseEnv: 'AUTH_PGDATABASE',
      hostEnv: 'AUTH_PGHOST',
      passwordEnv: 'AUTH_PGPASSWORD',
      portEnv: 'AUTH_PGPORT',
      sslModeEnv: 'AUTH_PGSSLMODE',
      urlEnv: 'AUTH_DATABASE_URL',
      userEnv: 'AUTH_PGUSER',
    })
  );
  const employeePool = new Pool(
    buildPoolConfig({
      databaseEnv: 'EMPLOYEE_PGDATABASE',
      hostEnv: 'EMPLOYEE_PGHOST',
      passwordEnv: 'EMPLOYEE_PGPASSWORD',
      portEnv: 'EMPLOYEE_PGPORT',
      sslModeEnv: 'EMPLOYEE_PGSSLMODE',
      urlEnv: 'EMPLOYEE_DATABASE_URL',
      userEnv: 'EMPLOYEE_PGUSER',
    })
  );

  try {
    const existingUserResult = await authPool.query(
      `SELECT id
       FROM users
       WHERE email = $1`,
      [adminEmail]
    );

    if (existingUserResult.rows[0]) {
      throw new Error(`A user with email ${adminEmail} already exists in auth-service.`);
    }

    const existingClinicResult = await authPool.query(
      `SELECT id, name, slug
       FROM clinics
       WHERE slug = $1`,
      [clinicSlug]
    );

    let clinic = existingClinicResult.rows[0] || null;

    if (!clinic) {
      const clinicInsert = await authPool.query(
        `INSERT INTO clinics (name, slug)
         VALUES ($1, $2)
         RETURNING id, name, slug`,
        [clinicName, clinicSlug]
      );

      clinic = clinicInsert.rows[0];
    }

    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const authInsert = await authPool.query(
      `INSERT INTO users (
         clinic_id,
         email,
         password_hash,
         first_name,
         last_name,
         role
       )
       VALUES ($1, $2, $3, $4, $5, 'clinic_admin')
       RETURNING id, clinic_id, email, first_name, last_name, role`,
      [
        clinic.id,
        adminEmail,
        passwordHash,
        adminFirstName,
        adminLastName,
      ]
    );

    const user = authInsert.rows[0];
    await seedAdminEmployeeReferenceData(employeePool);

    await authPool.query(
      `INSERT INTO audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'bootstrap_admin_identity', 'user', $2, $3::jsonb)`,
      [
        clinic.id,
        user.id,
        JSON.stringify({ email: user.email, role: user.role }),
      ]
    );

    const employeeInsert = await employeePool.query(
      `INSERT INTO employees (
         auth_user_id,
         clinic_id,
         email,
         first_name,
         last_name,
         phone,
         employee_type
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'non_clinical')
       RETURNING id, uid`,
      [
        user.id,
        clinic.id,
        user.email,
        adminFirstName,
        adminLastName,
        adminPhone,
      ]
    );

    const employee = employeeInsert.rows[0];
    const employeeId = employee.id;

    await employeePool.query(
      `INSERT INTO employee_access_profiles (employee_id, account_role)
       VALUES ($1, 'clinic_admin')
       ON CONFLICT (employee_id) DO UPDATE
       SET account_role = EXCLUDED.account_role,
           updated_at = CURRENT_TIMESTAMP`,
      [employeeId]
    );

    await employeePool.query(
      `INSERT INTO employee_employment_profiles (
         employee_id,
         start_date,
         status,
         employment_type_id,
         provider_type_id,
         department_id,
         primary_role_id,
         staff_role_id,
         role_title
       )
       VALUES (
         $1,
         DATE '2026-03-11',
         'active',
         (SELECT id FROM employment_types WHERE name = 'Full Time' LIMIT 1),
         (SELECT id FROM provider_types WHERE name = 'Other' LIMIT 1),
         (SELECT id FROM departments WHERE name = 'Administration' LIMIT 1),
         (SELECT id FROM primary_roles WHERE name = 'Administrative lead' LIMIT 1),
         (SELECT id FROM staff_roles WHERE name = 'Operations Coordinator' LIMIT 1),
         'Operations Coordinator'
       )
       ON CONFLICT (employee_id) DO UPDATE
       SET start_date = EXCLUDED.start_date,
           status = EXCLUDED.status,
           employment_type_id = EXCLUDED.employment_type_id,
           provider_type_id = EXCLUDED.provider_type_id,
           department_id = EXCLUDED.department_id,
           primary_role_id = EXCLUDED.primary_role_id,
           staff_role_id = EXCLUDED.staff_role_id,
           role_title = EXCLUDED.role_title,
           updated_at = CURRENT_TIMESTAMP`,
      [employeeId]
    );

    await employeePool.query(
      `INSERT INTO employee_operational_profiles (
         employee_id,
         shift_type_id,
         work_location_name,
         supervisor_name,
         notes
       )
       VALUES (
         $1,
         (SELECT id FROM shift_types WHERE name = 'Day' LIMIT 1),
         'Administration Office',
         'Clinic Director',
         'Seeded administrative operator for employee onboarding and clinic operations.'
       )
       ON CONFLICT (employee_id) DO UPDATE
       SET shift_type_id = EXCLUDED.shift_type_id,
           work_location_name = EXCLUDED.work_location_name,
           supervisor_name = EXCLUDED.supervisor_name,
           notes = EXCLUDED.notes,
           updated_at = CURRENT_TIMESTAMP`,
      [employeeId]
    );

    await employeePool.query(
      `INSERT INTO employee_operational_service_lines (employee_id, service_line_id)
       SELECT $1, id
       FROM operational_service_lines
       WHERE name IN ('Office coordination', 'Internal reporting')
       ON CONFLICT DO NOTHING`,
      [employeeId]
    );

    await employeePool.query(
      `INSERT INTO employee_operational_systems (employee_id, system_id)
       SELECT $1, id
       FROM operational_systems
       WHERE name IN ('Patient Messaging', 'Scheduling Board')
       ON CONFLICT DO NOTHING`,
      [employeeId]
    );

    await employeePool.query(
      `INSERT INTO employee_communication_channels (employee_id, communication_channel_id)
       SELECT $1, id
       FROM communication_channels
       WHERE name IN ('Email', 'Secure internal chat')
       ON CONFLICT DO NOTHING`,
      [employeeId]
    );

    await employeePool.query(
      `INSERT INTO employee_permissions (employee_id, permission_id, allowed)
       SELECT $1, id, TRUE
       FROM permissions
       WHERE code = 'employee.create'
       ON CONFLICT (employee_id, permission_id) DO UPDATE
       SET allowed = TRUE,
           updated_at = CURRENT_TIMESTAMP`,
      [employeeId]
    );

    await employeePool.query(
      `INSERT INTO audit_logs (clinic_id, actor_auth_user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'bootstrap_admin_employee', 'employee', $3, $4::jsonb)`,
      [
        clinic.id,
        user.id,
        employeeId,
        JSON.stringify({
          accountRole: user.role,
          authUserId: user.id,
          department: 'Administration',
          email: user.email,
          employeeType: 'non_clinical',
          permission: 'employee.create',
          roleTitle: 'Operations Coordinator',
          startDate: '2026-03-11',
          uid: employee.uid,
        }),
      ]
    );

    console.log('Bootstrap clinic admin created successfully.');
    console.log(`Clinic: ${clinic.name} (${clinic.slug})`);
    console.log(`Admin: ${user.email}`);
  } finally {
    await Promise.allSettled([authPool.end(), employeePool.end()]);
  }
}

bootstrapAdmin().catch((error) => {
  console.error('Failed to bootstrap clinic admin:', error.message);
  process.exit(1);
});
