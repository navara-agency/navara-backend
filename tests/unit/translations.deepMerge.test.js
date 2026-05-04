const { buildTestApp, truncateAll, closeApp } = require('../helpers/testApp');
const { mergeTranslations, getTranslations } = require('../../src/services/translations');

describe('mergeTranslations', () => {
  beforeAll(async () => {
    await buildTestApp();
  });
  afterEach(async () => {
    await truncateAll();
  });
  afterAll(async () => {
    await closeApp();
  });

  test('creates new row when none exists', async () => {
    await mergeTranslations('en', { nav: { home: 'Home' } });
    const res = await getTranslations('en');
    expect(res.keys.nav.home).toBe('Home');
  });

  test('deep merges into existing tree without dropping siblings', async () => {
    await mergeTranslations('en', { nav: { home: 'Home', about: 'About' }, footer: { copyright: '©' } });
    await mergeTranslations('en', { nav: { home: 'Inicio' } });
    const res = await getTranslations('en');
    expect(res.keys.nav.home).toBe('Inicio');
    expect(res.keys.nav.about).toBe('About'); // preserved
    expect(res.keys.footer.copyright).toBe('©'); // preserved
  });

  test('rejects non-object payloads', async () => {
    await expect(mergeTranslations('en', null)).rejects.toThrow();
    await expect(mergeTranslations('en', [])).rejects.toThrow();
  });
});
