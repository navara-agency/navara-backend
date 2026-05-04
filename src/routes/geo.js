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
    const skipCache = process.env.NODE_ENV !== 'production' && req.query.nocache === '1';
    const lookup = await geoService.lookupMarket(ip, { skipCache });
    const cfg = await getReshaped();
    const block = lookup.market === 'KSA' ? cfg?.ksa : cfg?.eg;
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
      // Dev-only diagnostics — production clients should ignore these.
      ...(process.env.NODE_ENV !== 'production' ? {
        debug: {
          ip,
          countryCode: lookup.countryCode || null,
          country: lookup.country || null,
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
