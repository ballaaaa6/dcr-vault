import {readingConflicts, anniversaryMismatch} from './card-identification-matching.js';

// Verified printed Pokédex numbers are distinct from catalog-local card IDs.
// Sources: https://scrydex.com/pokemon/cards/mew/base3_ja-33
const printedNumbers = {'ja:PMCG3-033': {number: '151', englishSetName: 'Mystery of the Fossils'}};

function text(value) {
  return String(value || '').trim().normalize('NFKC').toLocaleLowerCase('en-US');
}

export function printedNumberMapping(card, number) {
  const mapping = printedNumbers[`${card.language}:${card.id}`];
  return mapping && text(mapping.number) === text(number) ? mapping : null;
}

function attackMatches(fields, card) {
  const names = (fields.attacks || []).flatMap(attack => attack.names || []).map(text).filter(Boolean);
  return (card.metadata?.attacks || []).some(attack => (attack.names || []).some(name => names.includes(text(name))));
}

export function findEvidenceCatalogCard(cards, fields, numbersCompatible) {
  if (!fields.language || !fields.name || !fields.hp || !fields.illustrator
    || readingConflicts(fields).length) return null;
  const matches = cards.filter(card => {
    const meta = card.metadata || {};
    if (meta.reviewRequired || text(card.language) !== text(fields.language)
      || ![card.name, ...(meta.nameAliases || [])].some(name => text(name) === text(fields.name))
      || !meta.hp || text(meta.hp) !== text(fields.hp)
      || !meta.illustrator || text(meta.illustrator) !== text(fields.illustrator)) return false;
    const number = fields.cardNumber || fields.form?.cardNumber;
    if (!number && !attackMatches(fields, card)) return false;
    const mapping = printedNumberMapping(card, number);
    if (number && !mapping && !numbersCompatible(number, card)) return false;
    if (fields.setCode
      && !(meta.verifiedPrintedCodes || []).some(code => text(code) === text(fields.setCode))) return false;
    if (anniversaryMismatch(fields, card)) return false;
    if (fields.form?.year && card.year && fields.form.year !== card.year) return false;
    return true;
  });
  if (matches.length !== 1) return null;
  const card = matches[0];
  const mapping = printedNumberMapping(card, fields.cardNumber || fields.form?.cardNumber);
  return mapping ? {...card, metadata: {...card.metadata, englishSetName: mapping.englishSetName,
    verifiedPrintedNumber: mapping.number}} : card;
}
