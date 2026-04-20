export class AppError extends Error {
  constructor(statusCode, message, details = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function toErrorResponse(error) {
  const statusCode = error.statusCode || 500;
  const message =
    statusCode >= 500 ? 'Internal ERP backend error.' : error.message || 'Request failed.';

  return {
    error: {
      message,
      statusCode,
      details: sanitizeDetails(error.details || {}),
    },
  };
}

function sanitizeDetails(details) {
  const blockedKeys = ['token', 'secret', 'authorization', 'client_secret'];
  const result = {};

  for (const [key, value] of Object.entries(details)) {
    if (blockedKeys.includes(key.toLowerCase())) {
      result[key] = '[redacted]';
      continue;
    }

    result[key] = value;
  }

  return result;
}
