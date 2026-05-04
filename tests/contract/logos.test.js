const request = require('supertest');
const { buildTestApp, truncateAll, closeApp } = require('../helpers/testApp');
const { signTestToken, bearer } = require('../helpers/auth');

describe('Logos endpoints', () => {
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

  test('public list returns clients and partners split', async () => {
    const token = bearer(signTestToken());
    await request(app).post('/api/logos').set('Authorization', token).send({ name: 'A', type: 'client', image: 'https://r/a.png', sortOrder: 0 });
    await request(app).post('/api/logos').set('Authorization', token).send({ name: 'B', type: 'partner', image: 'https://r/b.png', sortOrder: 0 });
    const res = await request(app).get('/api/logos');
    expect(res.status).toBe(200);
    expect(res.body.clients).toHaveLength(1);
    expect(res.body.partners).toHaveLength(1);
  });

  test('DELETE skips cloudinary destroy when no public_id', async () => {
    const { cloudinary } = require('../../src/config/cloudinary');
    const spy = jest.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' });
    const token = bearer(signTestToken());
    const created = await request(app)
      .post('/api/logos')
      .set('Authorization', token)
      .send({ name: 'External', type: 'client', image: 'https://external/cdn/logo.png' });
    const del = await request(app).delete(`/api/logos/${created.body.id}`).set('Authorization', token);
    expect(del.status).toBe(204);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
