const request = require('supertest');
const { buildTestApp, closeApp } = require('../helpers/testApp');

const geoService = require('../../src/services/geo');

describe('GET /api/geo', () => {
  let app;
  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await closeApp();
  });

  beforeEach(() => {
    geoService._cache.clear();
  });

  test('SA → KSA market and ksa block', async () => {
    jest.spyOn(geoService, 'lookupMarket').mockResolvedValueOnce({ market: 'KSA', countryCode: 'SA' });
    const res = await request(app).get('/api/geo');
    expect(res.status).toBe(200);
    expect(res.body.market).toBe('KSA');
    expect(res.body.config.officeAddress).toContain('Riyadh');
  });

  test('EG → Egypt market and eg block', async () => {
    jest.spyOn(geoService, 'lookupMarket').mockResolvedValueOnce({ market: 'Egypt', countryCode: 'EG' });
    const res = await request(app).get('/api/geo');
    expect(res.status).toBe(200);
    expect(res.body.market).toBe('Egypt');
    expect(res.body.config.officeAddress).toContain('Cairo');
  });

  test('unknown country falls back to Egypt', async () => {
    jest.spyOn(geoService, 'lookupMarket').mockResolvedValueOnce({ market: 'Egypt', countryCode: null });
    const res = await request(app).get('/api/geo');
    expect(res.status).toBe(200);
    expect(res.body.market).toBe('Egypt');
  });
});
