export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function sendError(res, error) {
  const known = error instanceof ApiError;
  const payload = {
    error: known ? error.message : 'Internal server error',
    code: known ? error.code : 'INTERNAL_ERROR'
  };

  if (known && error.details !== undefined) payload.details = error.details;

  return res.status(known ? error.status : 500).json(payload);
}