const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function buildPoolConfig(options = {}) {
  const urlEnv = options.urlEnv || 'DATABASE_URL';
  const hostEnv = options.hostEnv || 'PGHOST';
  const portEnv = options.portEnv || 'PGPORT';
  const userEnv = options.userEnv || 'PGUSER';
  const passwordEnv = options.passwordEnv || 'PGPASSWORD';
  const databaseEnv = options.databaseEnv || 'PGDATABASE';
  const sslModeEnv = options.sslModeEnv || 'PGSSLMODE';

  const sslMode = process.env[sslModeEnv];
  const connectionString = process.env[urlEnv];
  const baseConfig = connectionString
    ? { connectionString }
    : {
        host: process.env[hostEnv] || '127.0.0.1',
        port: Number(process.env[portEnv] || 5432),
        user: process.env[userEnv] || 'postgres',
        password: process.env[passwordEnv] || 'postgres',
        database: process.env[databaseEnv] || 'postgres',
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

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createDatabase(options = {}) {
  const pool = new Pool(buildPoolConfig(options.env));
  const migrationsDir = options.migrationsDir;

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

  async function waitUntilReady(retries = 20, delayMs = 2000) {
    let lastError = null;

    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        await pool.query('SELECT 1');
        return;
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          await delay(delayMs);
        }
      }
    }

    throw lastError;
  }

  async function initializeDatabase() {
    if (!migrationsDir) {
      throw new Error('migrationsDir is required.');
    }

    await waitUntilReady();

    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((fileName) => fileName.endsWith('.sql'))
      .sort();

    for (const fileName of migrationFiles) {
      const migrationPath = path.join(migrationsDir, fileName);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      await pool.query(sql);
    }
  }

  return {
    initializeDatabase,
    pool,
    query,
    withTransaction,
  };
}

module.exports = {
  buildPoolConfig,
  createDatabase,
};
