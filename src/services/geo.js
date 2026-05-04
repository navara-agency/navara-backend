const { LRUCache } = require('lru-cache');
const logger = require('../config/logger');

const cache = new LRUCache({ max: 1000, ttl: 1000 * 60 * 60 * 24 });

const FALLBACK = { market: 'Egypt', countryCode: null };

function mapCountryToMarket(countryCode) {
  if (countryCode === 'EG') return 'Egypt';
  if (countryCode === 'SA') return 'KSA';
  return 'Egypt';
}

async function lookupMarket(ip, { skipCache = false } = {}) {
  if (!ip || ip === '::1' || ip === '127.0.0.1') {
    return { ...FALLBACK, reason: 'localhost' };
  }
  if (!skipCache) {
    const cached = cache.get(ip);
    if (cached) return { ...cached, cached: true };
  }

  try {
    const controller = new AbortController();
    // 1s was too tight when traffic is going through a VPN — bumped to 3s.
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,query,message`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`ip-api status ${res.status}`);
    const data = await res.json();
    if (data?.status === 'fail') {
      logger.warn({ ip, message: data.message }, 'ip-api returned status=fail');
      return { ...FALLBACK, reason: `ip-api fail: ${data.message || 'unknown'}` };
    }
    const countryCode = typeof data?.countryCode === 'string' ? data.countryCode : null;
    const result = {
      market: mapCountryToMarket(countryCode),
      countryCode,
      country: data?.country || null,
      resolvedIp: data?.query || ip,
    };
    cache.set(ip, result);
    logger.info({ ip, ...result }, 'geo lookup ok');
    return result;
  } catch (err) {
    logger.warn({ err: err.message, ip }, 'geo lookup failed; using Egypt fallback');
    return { ...FALLBACK, reason: `lookup error: ${err.message}` };
  }
}

function clearCache() { cache.clear(); }

module.exports = { lookupMarket, mapCountryToMarket, clearCache, _cache: cache };
