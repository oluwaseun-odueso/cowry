// Global environment variables required by the application under test.
// vi.mock() calls belong in individual test files — setup files run after
// module resolution so hoisting does not apply here.

process.env['JWT_SECRET'] = 'test-jwt-secret-32-characters-minimum-ok!!';
process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-32-chars-minimum-ok!!';
// 64 hex chars = 32-byte AES-256 key
process.env['CARD_ENCRYPTION_KEY'] =
  'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
process.env['NODE_ENV'] = 'test';
process.env['MAX_LOGIN_ATTEMPTS'] = '5';
process.env['LOGIN_ATTEMPT_WINDOW'] = '15';
process.env['UNUSUAL_LOCATION_THRESHOLD'] = '50';
process.env['VELOCITY_IP_THRESHOLD'] = '2';
process.env['MAX_CONCURRENT_SESSIONS'] = '5';
