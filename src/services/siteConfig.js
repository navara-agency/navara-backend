const merge = require('lodash.merge');

const FLAT_TO_NESTED = {
  global: ['linkedinUrl', 'instagramUrl', 'emailContact', 'metaTitle', 'metaDescription'],
  eg: ['phone', 'whatsapp', 'office', 'hours', 'ctaSubtext', 'calLink'],
  ksa: ['phone', 'whatsapp', 'office', 'hours', 'ctaSubtext', 'calLink'],
};

const PREFIXES = { eg: 'eg', ksa: 'ksa' };

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
  // Drop timestamps from merge if any leaked
  delete merged.created_at;
  delete merged.createdAt;
  await SiteConfig.upsert(merged);
  return getReshaped();
}

module.exports = { reshapeRow, flattenInput, getReshaped, partialUpdate };
