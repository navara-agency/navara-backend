const merge = require('lodash.merge');

const FLAT_TO_NESTED = {
  global: ['linkedinUrl', 'instagramUrl', 'emailContact', 'metaTitle', 'metaDescription'],
  eg: ['phone', 'whatsapp', 'office', 'hours', 'ctaSubtext', 'calLink'],
  ksa: ['phone', 'whatsapp', 'office', 'hours', 'ctaSubtext', 'calLink'],
};

const PREFIXES = { eg: 'eg', ksa: 'ksa' };

// In-code default for the homepage's "Navara Growth" floating card. Used both as the
// initial value when no DB row has the field and as the seed when admin clicks "Reset".
const DEFAULT_TRUST_CARD = {
  enabled: true,
  pillLabel: 'Navara Growth',
  metric: '+30%',
  metricCaption: 'avg. revenue increase',
  metricSubcaption: 'within first 90 days',
  stats: [
    { label: 'Clients', value: '50+' },
    { label: 'Countries', value: '3' },
    { label: 'Avg. ROAS', value: '4.2×' },
  ],
};

// Defensively normalise a stored trust card so the frontend always gets an object with
// the expected shape, even if the JSON in DB is partial or stale.
function normaliseTrustCard(raw) {
  // JSON columns can occasionally round-trip as strings — parse defensively.
  let value = raw;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { value = null; }
  }
  if (!value || typeof value !== 'object') return { ...DEFAULT_TRUST_CARD };
  const stats = Array.isArray(value.stats)
    ? value.stats.filter((s) => s && typeof s === 'object').map((s) => ({
        label: String(s.label ?? ''),
        value: String(s.value ?? ''),
      }))
    : DEFAULT_TRUST_CARD.stats;
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_TRUST_CARD.enabled,
    pillLabel: typeof value.pillLabel === 'string' ? value.pillLabel : DEFAULT_TRUST_CARD.pillLabel,
    metric: typeof value.metric === 'string' ? value.metric : DEFAULT_TRUST_CARD.metric,
    metricCaption: typeof value.metricCaption === 'string' ? value.metricCaption : DEFAULT_TRUST_CARD.metricCaption,
    metricSubcaption: typeof value.metricSubcaption === 'string' ? value.metricSubcaption : DEFAULT_TRUST_CARD.metricSubcaption,
    stats,
  };
}

function reshapeRow(row) {
  if (!row) return null;
  const data = row.get ? row.get({ plain: true }) : row;
  return {
    global: {
      linkedinUrl: data.linkedinUrl,
      instagramUrl: data.instagramUrl,
      emailContact: data.emailContact,
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
    },
    eg: {
      phone: data.egPhone,
      whatsapp: data.egWhatsapp,
      office: data.egOffice,
      hours: data.egHours,
      ctaSubtext: data.egCtaSubtext,
      calLink: data.egCalLink,
    },
    ksa: {
      phone: data.ksaPhone,
      whatsapp: data.ksaWhatsapp,
      office: data.ksaOffice,
      hours: data.ksaHours,
      ctaSubtext: data.ksaCtaSubtext,
      calLink: data.ksaCalLink,
    },
    trustCard: normaliseTrustCard(data.trustCard),
    updatedAt: data.updatedAt,
  };
}

function flattenInput(input = {}) {
  const out = {};
  if (input.global && typeof input.global === 'object') {
    for (const key of FLAT_TO_NESTED.global) {
      if (key in input.global) out[key] = input.global[key];
    }
  }
  for (const market of ['eg', 'ksa']) {
    if (input[market] && typeof input[market] === 'object') {
      for (const key of FLAT_TO_NESTED[market]) {
        if (key in input[market]) {
          const cap = key.charAt(0).toUpperCase() + key.slice(1);
          out[`${PREFIXES[market]}${cap}`] = input[market][key];
        }
      }
    }
  }
  // Trust card: when provided, REPLACE the JSON column entirely (we don't deep-merge so
  // stats array edits stick — lodash.merge would element-merge arrays, leaving stale items).
  if (input.trustCard && typeof input.trustCard === 'object') {
    out.trustCard = normaliseTrustCard(input.trustCard);
  }
  // Allow flat passthrough for already-flat fields too (e.g. legacy clients)
  const flatAllowed = [
    'linkedinUrl', 'instagramUrl', 'emailContact', 'metaTitle', 'metaDescription',
    'egPhone', 'egWhatsapp', 'egOffice', 'egHours', 'egCtaSubtext', 'egCalLink',
    'ksaPhone', 'ksaWhatsapp', 'ksaOffice', 'ksaHours', 'ksaCtaSubtext', 'ksaCalLink',
  ];
  for (const k of flatAllowed) {
    if (k in input) out[k] = input[k];
  }
  return out;
}

async function getReshaped() {
  const { SiteConfig } = require('../models');
  const row = await SiteConfig.findByPk(1);
  return reshapeRow(row);
}

async function partialUpdate(input) {
  const { SiteConfig } = require('../models');
  const flat = flattenInput(input);
  const existing = await SiteConfig.findByPk(1);
  const merged = merge({}, existing ? existing.get({ plain: true }) : {}, flat, { id: 1 });
  // For trust card specifically: bypass the deep-merge so array edits take effect.
  // lodash.merge would element-merge `stats[]`, leaving stale array entries behind.
  if ('trustCard' in flat) merged.trustCard = flat.trustCard;
  // Drop timestamps from merge if any leaked
  delete merged.created_at;
  delete merged.createdAt;
  await SiteConfig.upsert(merged);
  return getReshaped();
}

module.exports = { reshapeRow, flattenInput, getReshaped, partialUpdate, DEFAULT_TRUST_CARD };
