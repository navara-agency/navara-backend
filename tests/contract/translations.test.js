const request = require('supertest');
const { buildTestApp, truncateAll, closeApp } = require('../helpers/testApp');
const { signTestToken, bearer } = require('../helpers/auth');

describe('Translations endpoints', () => {
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

  test('GET unknown lang → 404', async () => {
    const res = await request(app).get('/api/translations/de');
    expect(res.status).toBe(404);
  });

  test('PUT then GET returns merged keys', async () => {
    const token = bearer(signTestToken());
    await request(app)
      .put('/api/translations/en')
      .set('Authorization', token)
      .send({ keys: { nav: { home: 'Home', about: 'About' } } });

    await request(app)
      .put('/api/translations/en')
      .set('Authorization', token)
      .send({ keys: { nav: { home: 'Welcome' } } });

    const get = await request(app).get('/api/translations/en');
    expect(get.status).toBe(200);
    expect(get.body.keys.nav.home).toBe('Welcome');
    expect(get.body.keys.nav.about).toBe('About');
  });

  test('PUT without auth → 401', async () => {
    const res = await request(app).put('/api/translations/en').send({ keys: { x: 'y' } });
    expect(res.status).toBe(401);
  });

  test('PUT with non-object body → 400', async () => {
    const token = bearer(signTestToken());
    const res = await request(app).put('/api/translations/en').set('Authorization', token).send({ keys: ['a'] });
    expect(res.status).toBe(400);
  });
});
