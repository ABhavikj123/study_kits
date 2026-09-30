import { ApiError } from './apiError.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCredentials(body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const details = {};

  if (!EMAIL.test(email) || email.length > 254) {
    details.email = 'Provide a valid email address.';
  }

  if (password.length < 8 || password.length > 128) {
    details.password = 'Password must be 8–128 characters.';
  }

  if (Object.keys(details).length) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid credentials.', details);
  }

  return { email, password };
}