const { mapCountryToMarket } = require('../../src/services/geo');

describe('mapCountryToMarket', () => {
  test('EG → Egypt', () => {
    expect(mapCountryToMarket('EG')).toBe('Egypt');
  });
  test('SA → KSA', () => {
    expect(mapCountryToMarket('SA')).toBe('KSA');
  });
  test('any other code → Egypt fallback', () => {
    expect(mapCountryToMarket('US')).toBe('Egypt');
    expect(mapCountryToMarket('GB')).toBe('Egypt');
    expect(mapCountryToMarket(null)).toBe('Egypt');
    expect(mapCountryToMarket(undefined)).toBe('Egypt');
  });
});
