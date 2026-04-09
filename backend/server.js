const express = require('express');
const { createAuthApi } = require('./authApi');
const { createClinicApi } = require('./clinicApi');
const db = require('./db');

const app = express();
const port = process.env.PORT || 3000;
const jwtSecret = process.env.JWT_SECRET || 'development-secret-change-me';
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1h';
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:3001';

const auth = createAuthApi({
  db,
  jwtSecret,
  jwtExpiresIn,
});

const clinic = createClinicApi({
  db,
  authenticateToken: auth.authenticateToken,
  authorizeRoles: auth.authorizeRoles,
  staffRoles: auth.STAFF_ROLES,
});

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', clientOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Server is running!');
});

app.use(auth.router);
app.use(clinic.router);

app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({
    error: 'Internal server error.',
  });
});

async function startServer() {
  await db.initializeDatabase();

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
