import {hasNonLatinScript} from './language.js';

export function intakeValues(fields, source) {
  const englishSource = fields.language === 'en' ? source : null;
  const latin = value => value && !hasNonLatinScript(value) ? value : '';
  return {
    name: englishSource?.name || fields.englishName || (fields.language === 'en' ? fields.name : '') || '',
    setName: englishSource?.setName || latin(source?.setName) || fields.englishSetName || (fields.language === 'en' ? fields.setName : '') || '',
    year: source?.year || fields.year || '',
    cardNumber: fields.cardNumber || '',
    rarity: source?.rarity || fields.rarity || ''
  };
}
