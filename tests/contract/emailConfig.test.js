const request = require('supertest');
const { buildTestApp, truncateAll, closeApp } = require('../helpers/testApp');
const { signTestToken, bearer } = require('../helpers/auth');

jest.mock('../../src/services/email', () => {
  const actual = jest.requireActual('../../src/services/email');
  return {
    ...actual,
    sendTestEmail: jest.fn().mockResolvedValue(undefined),
  };
});

const MASK = '••••••••';

describe('Email config endpoints', () => {
  let app;
  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterEach(async () => {
    await truncateAll();
  });
  afterAll(async () => {
    await closeApp();
  });

  test('GET masks smtpPass', async () => {
    const res = await request(app).get('/api/email-config').set('Authorization', bearer(signTestToken()));
    expect(res.status).toBe(200);
    expect(res.body.smtpPass).toBe(MASK);
  });

  test('GET without token → 401', async () => {
    const res = await request(app).get('/api/email-config');
    expect(res.status).toBe(401);
  });

  test('PUT with mask sentinel does NOT overwrite stored password (FR-022)', async () => {
    const token = bearer(signTestToken());
    await request(app)
      .put('/api/email-config')
      .set('Authorization', token)
      .send({ smtpHost: 'smtp.new.example', smtpPass: MASK });
    const { EmailConfig } = require('../../src/models');
    const row = await EmailConfig.findByPk(1);
    expect(row.smtpHost).toBe('smtp.new.example');
    expect(row.smtpPass).toBe('test-pass'); // unchanged from seed
  });

  test('PUT with real new password overwrites', async () => {
    const token = bearer(signTestToken());
    await request(app)
      .put('/api/email-config')
      .set('Authorization', token)
      .send({ smtpPass: 'brand-new-secret' });
    const { EmailConfig } = require('../../src/models');
    const row = await EmailConfig.findByPk(1);
    expect(row.smtpPass).toBe('brand-new-secret');
  });

  test('POST /test happy path returns success', async () => {
    const res = await request(app).post('/api/email-config/test').set('Authorization', bearer(signTestToken()));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /test failure returns underlying error', async () => {
    const email = require('../../src/services/email');
    email.sendTestEmail.mockRejectedValueOnce(new Error('SMTP refused connection'));
    const res = await request(app).post('/api/email-config/test').set('Authorization', bearer(signTestToken()));
    expect(res.status).toBe(502);
    expect(res.body.error).toContain('SMTP');
  });
});
