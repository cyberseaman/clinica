const fs = require('fs');
const jwt = require('jsonwebtoken');

function loadKey({ value, path, label }) {
  if (value) {
    return String(value);
  }

  if (path) {
    return fs.readFileSync(path, 'utf8');
  }

  throw new Error(`${label} is required.`);
}

function createJwtSigner(options = {}) {
  const privateKey = loadKey({
    value: options.privateKey,
    path: options.privateKeyPath,
    label: 'JWT private key',
  });
  const issuer = options.issuer;
  const audience = options.audience;
  const expiresIn = options.expiresIn || '15m';

  if (!issuer || !audience) {
    throw new Error('JWT issuer and audience are required.');
  }

  function signAccessToken(payload) {
    return jwt.sign(payload, privateKey, {
      algorithm: 'RS256',
      issuer,
      audience,
      expiresIn,
    });
  }

  return {
    signAccessToken,
  };
}

function createJwtVerifier(options = {}) {
  const publicKey = loadKey({
    value: options.publicKey,
    path: options.publicKeyPath,
    label: 'JWT public key',
  });
  const issuer = options.issuer;
  const audience = options.audience;

  if (!issuer || !audience) {
    throw new Error('JWT issuer and audience are required.');
  }

  function verifyAccessToken(token) {
    return jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer,
      audience,
    });
  }

  function decodeToken(token) {
    return jwt.decode(token);
  }

  return {
    decodeToken,
    verifyAccessToken,
  };
}

module.exports = {
  createJwtSigner,
  createJwtVerifier,
};
