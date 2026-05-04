const request = require('supertest');
const { buildTestApp, truncateAll, closeApp } = require('../helpers/testApp');
const { signTestToken, bearer } = require('../helpers/auth');

const VALID = {
  quote: 'Outstanding work',
  author: 'Jane Smith',
  title: 'Marketing Director',
  company: 'Acme',
  rating: 5,
  status: 'published',
  sortOrder: 1,
};

describe('Testimonials endpoints', () => {
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

  test('public list excludes drafts', async () => {
    const token = bearer(signTestToken());
    await request(app).post('/api/testimonials').set('Authorization', token).send(VALID);
    await request(app).post('/api/testimonials').set('Authorization', token).send({ ...VALID, status: 'draft' });
    const res = await request(app).get('/api/testimonials');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  test('photo+publicId pair validation rejects mismatched payload', async () => {
    const token = bearer(signTestToken());
    const res = await request(app)
      .post('/api/testimonials')
      .set('Authorization', token)
      .send({ ...VALID, photo: 'https://r/p.jpg' });
    expect(res.status).toBe(400);
  });
});
