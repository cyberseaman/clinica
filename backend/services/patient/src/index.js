const express = require('express');

const { createAuthClient } = require('./authClient');
const config = require('./config');
const db = require('./db');
const { createPatientApi } = require('./patientApi');

const app = express();

const authClient = createAuthClient({
  authServiceUrl: config.authServiceUrl,
  internalServiceToken: config.internalServiceToken,
});

const patientApi = createPatientApi({
  authClient,
  db,
  jwtAudience: config.jwtAudience,
  jwtIssuer: config.jwtIssuer,
  jwtPublicKeyPath: config.jwtPublicKeyPath,
});

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', config.clientOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});

app.use(express.json());
app.use(patientApi.router);

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

  app.listen(config.port, () => {
    console.log(`Patient service listening on port ${config.port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start patient service:', error);
  process.exit(1);
});
