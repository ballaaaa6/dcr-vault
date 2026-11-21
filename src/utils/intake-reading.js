import {hasNonLatinScript} from './language.js';

export function intakeValues(fields, source) {
  const englishSource = fields.language === 'en' ? source : null;
  const latin = value => value && !hasNonLatinScript(value) ? value : '';
  return {
    name: fields.form?.name || englishSource?.name || fields.englishName || (fields.language === 'en' ? fields.name : '') || '',
    setName: fields.form?.setName || englishSource?.setName || latin(source?.metadata?.englishSetName) || latin(source?.setName) || '',
    year: fields.form?.year || source?.year || '',
    cardNumber: fields.form?.cardNumber || fields.cardNumber || '',
    rarity: fields.form?.rarity || source?.rarity || ''
  };
}
