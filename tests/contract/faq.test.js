const request = require('supertest');
const { buildTestApp, truncateAll, closeApp } = require('../helpers/testApp');
const { signTestToken, bearer } = require('../helpers/auth');

const VALID = {
  questionEn: 'What services do you offer?',
  answerEn: 'Marketing services',
  questionAr: 'ما الخدمات التي تقدمونها؟',
  answerAr: 'خدمات تسويقية',
  enabled: true,
  sortOrder: 0,
};

describe('FAQ endpoints', () => {
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

  test('public list excludes disabled items', async () => {
    const token = bearer(signTestToken());
    await request(app).post('/api/faq').set('Authorization', token).send(VALID);
    await request(app).post('/api/faq').set('Authorization', token).send({ ...VALID, enabled: false });
    const res = await request(app).get('/api/faq');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  test('rejects FAQ missing Arabic fields (Principle V)', async () => {
    const token = bearer(signTestToken());
    const { questionAr, answerAr, ...partial } = VALID; // eslint-disable-line no-unused-vars
    const res = await request(app).post('/api/faq').set('Authorization', token).send(partial);
    expect(res.status).toBe(400);
  });
});
