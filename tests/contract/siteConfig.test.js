const request = require('supertest');
const { buildTestApp, truncateAll, closeApp } = require('../helpers/testApp');
const { signTestToken, bearer } = require('../helpers/auth');

describe('Site config endpoints', () => {
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

  test('GET /api/site-config returns nested {global, eg, ksa}', async () => {
    const res = await request(app).get('/api/site-config');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('global');
    expect(res.body).toHaveProperty('eg');
    expect(res.body).toHaveProperty('ksa');
    expect(res.body.eg.office).toBe('Cairo, Egypt');
    expect(res.body.ksa.office).toBe('Riyadh, KSA');
  });

  test('PUT /api/site-config without token → 401', async () => {
    const res = await request(app).put('/api/site-config').send({ ksa: { phone: '+966 123' } });
    expect(res.status).toBe(401);
  });

  test('partial PUT preserves unspecified fields (FR-021)', async () => {
    const token = bearer(signTestToken());
    const res = await request(app)
      .put('/api/site-config')
      .set('Authorization', token)
      .send({ ksa: { phone: '+966 50 999 0000' } });
    expect(res.status).toBe(200);
    expect(res.body.ksa.phone).toBe('+966 50 999 0000');
    // Egypt block preserved from seed
    expect(res.body.eg.office).toBe('Cairo, Egypt');
  });

  test('singleton: writes never create duplicate rows', async () => {
    const token = bearer(signTestToken());
    await request(app).put('/api/site-config').set('Authorization', token).send({ ksa: { phone: 'a' } });
    await request(app).put('/api/site-config').set('Authorization', token).send({ ksa: { phone: 'b' } });
    const { SiteConfig } = require('../../src/models');
    const count = await SiteConfig.count();
    expect(count).toBe(1);
  });
});
