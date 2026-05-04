const request = require('supertest');
const jwt = require('jsonwebtoken');
const { buildTestApp, closeApp } = require('../helpers/testApp');

describe('POST /api/auth/login', () => {
  let app;
  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await closeApp();
  });

  test('happy path returns JWT signed with JWT_SECRET', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'test-password-123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.expiresIn).toBe('7d');
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.admin).toBe(true);
  });

  test('wrong password returns 401 with generic error (no enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

  test('unknown username returns the same generic error', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'anything' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });
});
