const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function buildPoolConfig() {
  const sslMode = process.env.PGSSLMODE;
  const baseConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || '127.0.0.1',
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER || 'richelsantiago',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'clinic_backend',
      };

  if (sslMode === 'require') {
    return {
      ...baseConfig,
      ssl: {
        rejectUnauthorized: false,
      },
    };
  }

  return baseConfig;
}

const pool = new Pool(buildPoolConfig());

async function query(text, params) {
  return pool.query(text, params);
}

async function withTransaction(work) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function initializeDatabase() {
  const migrationDirectory = path.join(__dirname, 'migrations');
  const migrationFiles = fs
    .readdirSync(migrationDirectory)
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort();

  for (const fileName of migrationFiles) {
    const migrationPath = path.join(migrationDirectory, fileName);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(sql);
  }
}

module.exports = {
  pool,
  query,
  withTransaction,
  initializeDatabase,
};
