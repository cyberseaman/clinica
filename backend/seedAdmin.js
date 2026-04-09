const bcrypt = require('bcryptjs');

const db = require('./db');

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

async function seedAdmin() {
  const clinicName = requireEnv('SEED_CLINIC_NAME');
  const clinicSlug = optionalEnv('SEED_CLINIC_SLUG') || slugify(clinicName);
  const adminEmail = requireEnv('SEED_ADMIN_EMAIL').toLowerCase();
  const adminPassword = requireEnv('SEED_ADMIN_PASSWORD');
  const adminFirstName = optionalEnv('SEED_ADMIN_FIRST_NAME') || null;
  const adminLastName = optionalEnv('SEED_ADMIN_LAST_NAME') || null;

  await db.initializeDatabase();

  const existingUserResult = await db.query(
    `SELECT id
     FROM users
     WHERE email = $1`,
    [adminEmail]
  );

  if (existingUserResult.rows[0]) {
    throw new Error(`A user with email ${adminEmail} already exists.`);
  }

  const existingClinicResult = await db.query(
    `SELECT id
     FROM clinics
     WHERE slug = $1`,
    [clinicSlug]
  );

  if (existingClinicResult.rows[0]) {
    throw new Error(`A clinic with slug ${clinicSlug} already exists.`);
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const result = await db.withTransaction(async (client) => {
    const clinicInsert = await client.query(
      `INSERT INTO clinics (name, slug)
       VALUES ($1, $2)
       RETURNING id, name, slug`,
      [clinicName, clinicSlug]
    );

    const clinic = clinicInsert.rows[0];

    const userInsert = await client.query(
      `INSERT INTO users (
         clinic_id,
         email,
         password_hash,
         first_name,
         last_name,
         role
       )
       VALUES ($1, $2, $3, $4, $5, 'clinic_admin')
       RETURNING id, clinic_id, email, first_name, last_name, role, is_active`,
      [
        clinic.id,
        adminEmail,
        passwordHash,
        adminFirstName,
        adminLastName,
      ]
    );

    const user = userInsert.rows[0];

    await client.query(
      `INSERT INTO audit_logs (clinic_id, actor_user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'seed_admin', 'user', $2, $3::jsonb)`,
      [
        clinic.id,
        user.id,
        JSON.stringify({ email: user.email, role: user.role }),
      ]
    );

    return {
      clinic,
      user,
    };
  });

  console.log('Initial clinic admin created successfully.');
  console.log(`Clinic: ${result.clinic.name} (${result.clinic.slug})`);
  console.log(`Admin: ${result.user.email}`);
}

seedAdmin()
  .catch((error) => {
    console.error('Failed to seed clinic admin:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.pool.end();
  });
