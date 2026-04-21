const path = require('path');

module.exports = {
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  internalServiceToken:
    process.env.INTERNAL_SERVICE_TOKEN || 'development-internal-service-token',
  jwtAudience: process.env.JWT_AUDIENCE || 'clinic-resource-services',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtIssuer: process.env.JWT_ISSUER || 'clinic-auth-service',
  jwtPrivateKeyPath:
    process.env.JWT_PRIVATE_KEY_PATH ||
    path.join(__dirname, '../../../certs/dev-private.pem'),
  jwtPublicKeyPath:
    process.env.JWT_PUBLIC_KEY_PATH ||
    path.join(__dirname, '../../../certs/dev-public.pem'),
  port: Number(process.env.PORT || 3000),
};
