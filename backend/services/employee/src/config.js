const path = require('path');

module.exports = {
  authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://auth-service:3000',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  internalServiceToken:
    process.env.INTERNAL_SERVICE_TOKEN || 'development-internal-service-token',
  jwtAudience: process.env.JWT_AUDIENCE || 'clinic-resource-services',
  jwtIssuer: process.env.JWT_ISSUER || 'clinic-auth-service',
  jwtPublicKeyPath:
    process.env.JWT_PUBLIC_KEY_PATH ||
    path.join(__dirname, '../../../certs/dev-public.pem'),
  port: Number(process.env.PORT || 3001),
};
