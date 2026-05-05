const express = require('express');
const geoService = require('../services/geo');
const { getReshaped } = require('../services/siteConfig');

const router = express.Router();

// Dev-only override: localhost requests can pass ?ip=... so the lookup uses a real public IP.
// In production, req.ip (read through trust proxy) is authoritative and the override is ignored.
function resolveIp(req) {
  if (process.env.NODE_ENV !== 'production' && typeof req.query.ip === 'string' && req.query.ip.trim()) {
    return req.query.ip.trim();
  }
  return req.ip;
}

router.get('/', async (req, res, next) => {
  try {
    // Optional explicit market override for QA without a VPN
    if (process.env.NODE_ENV !== 'production' && typeof req.query.market === 'string') {
      const forced = req.query.market;
      if (['Egypt', 'KSA'].includes(forced)) {
        const cfg = await getReshaped();
        const block = forced === 'KSA' ? cfg?.ksa : cfg?.eg;
        return res.json({
          market: forced,
          config: {
            phone: block?.phone || null,
            whatsapp: block?.whatsapp || null,
            officeAddress: block?.office || null,
            workingHours: block?.hours || null,
            ctaSubtext: block?.ctaSubtext || null,
            calLink: block?.calLink || null,
          },
          forced: true,
        });
      }
    }

    const ip = resolveIp(req);
    const skipCache = (process.env.NODE_ENV !== 'production' && req.query.nocache === '1') || req.query.debug === '1';
    const lookup = await geoService.lookupMarket(ip, { skipCache });
    const cfg = await getReshaped();
    const block = lookup.market === 'KSA' ? cfg?.ksa : cfg?.eg;
    const wantDebug = req.query.debug === '1' || process.env.NODE_ENV !== 'production';
    return res.json({
      market: lookup.market,
      config: {
        phone: block?.phone || null,
        whatsapp: block?.whatsapp || null,
        officeAddress: block?.office || null,
        workingHours: block?.hours || null,
        ctaSubtext: block?.ctaSubtext || null,
        calLink: block?.calLink || null,
      },
      // Diagnostics — visible when ?debug=1 OR NODE_ENV !== production.
      // The visitor's own IP is not a secret to them, so this is safe to expose.
      ...(wantDebug ? {
        debug: {
          reqIp: ip,
          xForwardedFor: req.headers['x-forwarded-for'] || null,
          xRealIp: req.headers['x-real-ip'] || null,
          cfConnectingIp: req.headers['cf-connecting-ip'] || null,
          countryCode: lookup.countryCode || null,
          country: lookup.country || null,
          resolvedIp: lookup.resolvedIp || null,
          cached: !!lookup.cached,
          reason: lookup.reason || null,
        },
      } : {}),
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
