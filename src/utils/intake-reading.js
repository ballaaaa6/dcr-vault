import {hasNonLatinScript} from './language.js';

export function readingUncertain(fields, ...keys) {
  const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^form/, '');
  const uncertain = (fields.uncertainFields || []).map(normalize);
  return keys.some(key => uncertain.includes(normalize(key)));
}

function promoRarity(fields) {
  const explicit = [fields.form?.rarity, fields.rarity].some(value => /^(promo|promotional|p)$/i.test(String(value || '').trim()));
  const number = String(fields.form?.cardNumber || fields.cardNumber || '').trim();
  const promoNumber = /^\d+\/(?:[a-z0-9]+-p|s-p)$/i.test(number);
  const promoSet = /\b(?:promos?|promotional)\b/i.test([fields.form?.setName, fields.englishSetName, fields.setName].join(' '));
  return explicit || promoNumber || promoSet ? 'Promo' : '';
}

export function intakeValues(fields, source) {
  const englishSource = fields.language === 'en' ? source : null;
  const latin = value => value && !hasNonLatinScript(value) ? value : '';
  const read = (keys, value) => readingUncertain(fields, ...keys) ? '' : value;
  return {
    name: read(['name', 'englishName'], fields.form?.name || fields.englishName || (fields.language === 'en' ? fields.name : '')) || englishSource?.name || '',
    setName: read(['setName', 'englishSetName'], fields.form?.setName) || englishSource?.setName || latin(source?.metadata?.englishSetName) || latin(source?.setName) || '',
    year: read(['year', 'releaseYear'], fields.form?.year) || source?.year || '',
    cardNumber: read(['cardNumber', 'collectorNumber'], fields.form?.cardNumber || fields.cardNumber) || source?.metadata?.verifiedPrintedNumber || '',
    rarity: read(['rarity'], fields.form?.rarity || (!source && promoRarity(fields))) || source?.rarity || ''
  };
}
