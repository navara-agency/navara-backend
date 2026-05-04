const request = require('supertest');
const { buildTestApp, truncateAll, closeApp } = require('../helpers/testApp');
const { signTestToken, bearer } = require('../helpers/auth');

const VALID = {
  client: 'Acme',
  title: 'Q4 Growth',
  industry: 'Retail',
  market: 'Egypt',
  services: ['Social Media'],
  challenge: 'Low brand awareness',
  outcome: '3x organic reach',
  slug: 'acme-q4-growth',
  status: 'published',
  sortOrder: 1,
};

describe('Case studies endpoints', () => {
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

  test('public list excludes drafts and honours sort_order', async () => {
    const token = bearer(signTestToken());
    await request(app).post('/api/case-studies').set('Authorization', token).send({ ...VALID, slug: 'a-pub', sortOrder: 2 });
    await request(app).post('/api/case-studies').set('Authorization', token).send({ ...VALID, slug: 'b-pub', sortOrder: 1 });
    await request(app).post('/api/case-studies').set('Authorization', token).send({ ...VALID, slug: 'c-draft', status: 'draft', sortOrder: 0 });

    const res = await request(app).get('/api/case-studies');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].slug).toBe('b-pub');
    expect(res.body[1].slug).toBe('a-pub');
  });

  test('admin endpoint requires auth', async () => {
    const res = await request(app).get('/api/case-studies/admin');
    expect(res.status).toBe(401);
  });

  test('duplicate slug returns 409', async () => {
    const token = bearer(signTestToken());
    await request(app).post('/api/case-studies').set('Authorization', token).send(VALID);
    const dup = await request(app).post('/api/case-studies').set('Authorization', token).send(VALID);
    expect(dup.status).toBe(409);
  });

  test('DELETE attempts cloudinary destroy and removes row', async () => {
    const { cloudinary } = require('../../src/config/cloudinary');
    const spy = jest.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' });
    const token = bearer(signTestToken());
    const created = await request(app)
      .post('/api/case-studies')
      .set('Authorization', token)
      .send({ ...VALID, slug: 'with-media', coverImage: 'https://r/img.jpg', coverPublicId: 'navara/images/abc' });
    const del = await request(app).delete(`/api/case-studies/${created.body.id}`).set('Authorization', token);
    expect(del.status).toBe(204);
    expect(spy).toHaveBeenCalledWith('navara/images/abc');
    spy.mockRestore();
  });
});
