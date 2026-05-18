const request = require('supertest');
const { buildTestApp, truncateAll, closeApp } = require('../helpers/testApp');
const { signTestToken, expiredToken, bearer } = require('../helpers/auth');

// Stub email service — never let real SMTP attempts happen during tests.
jest.mock('../../src/services/email', () => ({
  sendLeadNotification: jest.fn().mockResolvedValue(undefined),
  sendTestEmail: jest.fn().mockResolvedValue(undefined),
  sendBookingConfirmation: jest.fn().mockResolvedValue(undefined),
  sendBookingReminder: jest.fn().mockResolvedValue(undefined),
  getTransport: jest.fn(),
  formatLeadBody: jest.requireActual('../../src/services/email').formatLeadBody,
}));

// Market is now derived from the phone's country code on the server (no more `market` field
// in the payload). preferredDateTime is required because the form forces a time pick.
const VALID_LEAD = {
  name: 'Aisha Ali',
  company: 'Acme Co',
  industry: 'Retail',
  goal: 'Generate qualified leads',
  services: ['Social Media', 'SEO'],
  budget: '$5k-$10k',
  phone: '+201000000000',
  email: 'aisha@acme.test',
  note: 'Looking forward to working together.',
  preferredDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  timezone: 'Africa/Cairo',
};

describe('Leads endpoints', () => {
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

  describe('POST /api/leads (public)', () => {
    test('happy path persists lead and returns 201', async () => {
      const res = await request(app).post('/api/leads').send(VALID_LEAD);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.id).toBe('number');
    });

    test('rejects malformed email with 400', async () => {
      const res = await request(app)
        .post('/api/leads')
        .send({ ...VALID_LEAD, email: 'not-an-email' });
      expect(res.status).toBe(400);
    });

    test('honeypot field present → 400', async () => {
      // The honeypot was renamed from "website" to "nv_check_x" because browsers
      // were autofilling fields named "website" with the visitor's saved homepage,
      // rejecting legitimate users.
      const res = await request(app)
        .post('/api/leads')
        .send({ ...VALID_LEAD, nv_check_x: 'http://spam.example' });
      expect(res.status).toBe(400);
    });

    test('email service failure does NOT block lead capture', async () => {
      const email = require('../../src/services/email');
      email.sendLeadNotification.mockRejectedValueOnce(new Error('SMTP down'));
      const res = await request(app).post('/api/leads').send(VALID_LEAD);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/leads (admin)', () => {
    test('401 without token', async () => {
      const res = await request(app).get('/api/leads');
      expect(res.status).toBe(401);
    });

    test('401 with expired token', async () => {
      const res = await request(app).get('/api/leads').set('Authorization', bearer(expiredToken()));
      expect(res.status).toBe(401);
    });

    test('lists leads sorted newest-first', async () => {
      await request(app).post('/api/leads').send({ ...VALID_LEAD, email: 'a@example.test' });
      await new Promise((r) => setTimeout(r, 10));
      await request(app).post('/api/leads').send({ ...VALID_LEAD, email: 'b@example.test' });

      const res = await request(app).get('/api/leads').set('Authorization', bearer(signTestToken()));
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.leads[0].email).toBe('b@example.test');
    });
  });

  describe('GET /api/leads/:id', () => {
    test('first GET sets read_at; second GET preserves it', async () => {
      const created = await request(app).post('/api/leads').send(VALID_LEAD);
      const token = bearer(signTestToken());

      const first = await request(app).get(`/api/leads/${created.body.id}`).set('Authorization', token);
      expect(first.status).toBe(200);
      expect(first.body.readAt).toBeTruthy();
      const firstReadAt = first.body.readAt;

      const second = await request(app).get(`/api/leads/${created.body.id}`).set('Authorization', token);
      expect(second.body.readAt).toBe(firstReadAt);
    });

    test('404 on unknown id', async () => {
      const res = await request(app).get('/api/leads/9999').set('Authorization', bearer(signTestToken()));
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/leads/:id/status', () => {
    test('updates valid status', async () => {
      const created = await request(app).post('/api/leads').send(VALID_LEAD);
      const res = await request(app)
        .patch(`/api/leads/${created.body.id}/status`)
        .set('Authorization', bearer(signTestToken()))
        .send({ status: 'contacted' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('contacted');
    });

    test('rejects invalid status with 400', async () => {
      const created = await request(app).post('/api/leads').send(VALID_LEAD);
      const res = await request(app)
        .patch(`/api/leads/${created.body.id}/status`)
        .set('Authorization', bearer(signTestToken()))
        .send({ status: 'bogus' });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/leads/:id', () => {
    test('removes lead and returns 204', async () => {
      const created = await request(app).post('/api/leads').send(VALID_LEAD);
      const token = bearer(signTestToken());
      const del = await request(app).delete(`/api/leads/${created.body.id}`).set('Authorization', token);
      expect(del.status).toBe(204);
      const get = await request(app).get(`/api/leads/${created.body.id}`).set('Authorization', token);
      expect(get.status).toBe(404);
    });
  });
});
