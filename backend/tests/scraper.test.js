import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCompanyUrl } from '../src/services/scraperService.js';

test('validates absolute HTTP/HTTPS URLs', () => {
  assert.ok(validateCompanyUrl('https://vercel.com/careers'));
  assert.ok(validateCompanyUrl('http://example.com'));
  
  assert.throws(() => validateCompanyUrl('ftp://example.com'), /HTTP or HTTPS/);
  assert.throws(() => validateCompanyUrl('not-a-url'), /absolute HTTP\(S\) URL/);
});

test('blocks loopback and private IPs in production', () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  
  assert.throws(() => validateCompanyUrl('http://localhost:3000'), /Private and loopback/);
  assert.throws(() => validateCompanyUrl('http://127.0.0.1'), /Private and loopback/);
  assert.throws(() => validateCompanyUrl('https://192.168.1.5'), /Private and loopback/);
  assert.throws(() => validateCompanyUrl('http://10.0.0.1'), /Private and loopback/);
  
  assert.ok(validateCompanyUrl('https://google.com'));
  
  process.env.NODE_ENV = originalEnv;
});