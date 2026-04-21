function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function parseBearerToken(headerValue) {
  if (!headerValue || !headerValue.startsWith('Bearer ')) {
    return null;
  }

  return headerValue.slice('Bearer '.length).trim();
}

function parsePositiveInteger(value) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}

function sendJsonError(res, statusCode, error) {
  return res.status(statusCode).json({ error });
}

module.exports = {
  normalizeEmail,
  parseBearerToken,
  parsePositiveInteger,
  sendJsonError,
};
