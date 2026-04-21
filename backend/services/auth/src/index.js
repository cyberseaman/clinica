const express = require('express');

const { createJwtSigner, createJwtVerifier } = require('../../../shared/jwt');
const { createAuthApi } = require('./authApi');
const config = require('./config');
const db = require('./db');

const app = express();

const jwtSigner = createJwtSigner({
  audience: config.jwtAudience,
  expiresIn: config.jwtExpiresIn,
  issuer: config.jwtIssuer,
  privateKeyPath: config.jwtPrivateKeyPath,
});

const jwtVerifier = createJwtVerifier({
  audience: config.jwtAudience,
  issuer: config.jwtIssuer,
  publicKeyPath: config.jwtPublicKeyPath,
});

const auth = createAuthApi({
  db,
  internalServiceToken: config.internalServiceToken,
  jwtExpiresIn: config.jwtExpiresIn,
  jwtSigner,
  jwtVerifier,
});

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', config.clientOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Service-Token');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});

app.use(express.json());
app.use(auth.router);

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
    console.log(`Auth service listening on port ${config.port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start auth service:', error);
  process.exit(1);
});
