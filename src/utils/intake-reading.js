import {hasNonLatinScript} from './language.js';
import {displaySetName} from './set-name.js';

function promoRarity(fields) {
  const explicit = [fields.form?.rarity, fields.rarity].some(value => /^(promo|promotional|p)$/i.test(String(value || '').trim()));
  const number = String(fields.form?.cardNumber || fields.cardNumber || '').trim();
  const promoNumber = /^\d+\/(?:[a-z0-9]+-p|s-p)$/i.test(number);
  const promoSet = /\b(?:promos?|promotional)\b/i.test([fields.form?.setName, fields.englishSetName, fields.setName].join(' '));
  return explicit || promoNumber || promoSet ? 'Promo' : '';
}

export function intakeValues(fields, source) {
  const englishSource = /^(english|en)$/i.test(fields.language || '') ? source : null;
  const latin = value => value && !hasNonLatinScript(value) ? value : '';
  return {
    name: fields.form?.name || fields.englishName || englishSource?.name || (/^(english|en)$/i.test(fields.language || '') ? fields.name : '') || '',
    setName: displaySetName(latin(fields.form?.setName) || latin(fields.englishSetName) || englishSource?.setName || latin(source?.metadata?.englishSetName) || latin(source?.setName)),
    year: fields.form?.year || fields.year || source?.year || '',
    cardNumber: fields.form?.cardNumber || fields.cardNumber || source?.metadata?.verifiedPrintedNumber || '',
    rarity: fields.form?.rarity || fields.rarity || source?.rarity || promoRarity(fields)
  };
}
