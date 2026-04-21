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

async function bootstrapAdmin() {
  const clinicName = requireEnv('SEED_CLINIC_NAME');
  const clinicSlug = optionalEnv('SEED_CLINIC_SLUG') || slugify(clinicName);
  const adminEmail = requireEnv('SEED_ADMIN_EMAIL').toLowerCase();
  const adminPassword = requireEnv('SEED_ADMIN_PASSWORD');
  const adminFirstName = optionalEnv('SEED_ADMIN_FIRST_NAME') || null;
  const adminLastName = optionalEnv('SEED_ADMIN_LAST_NAME') || null;

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

    await authPool.query(
      `INSERT INTO audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'bootstrap_admin_identity', 'user', $2, $3::jsonb)`,
      [
        clinic.id,
        user.id,
        JSON.stringify({ email: user.email, role: user.role }),
      ]
    );

    await employeePool.query(
      `INSERT INTO employees (
         auth_user_id,
         clinic_id,
         email,
         first_name,
         last_name,
         role
       )
       VALUES ($1, $2, $3, $4, $5, 'clinic_admin')
       RETURNING id`,
      [
        user.id,
        clinic.id,
        user.email,
        adminFirstName,
        adminLastName,
      ]
    );

    await employeePool.query(
      `INSERT INTO audit_logs (clinic_id, actor_auth_user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'bootstrap_admin_employee', 'employee', NULL, $3::jsonb)`,
      [
        clinic.id,
        user.id,
        JSON.stringify({ authUserId: user.id, email: user.email, role: user.role }),
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
