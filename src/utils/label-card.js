import {findCatalogCandidates, findCatalogCardById} from '../store/catalog.js';

function numberKey(value) {
  return String(value || '').trim().replace(/^#/, '').split('/')[0].replace(/^0+(?=\d)/, '').toLowerCase();
}

export async function enrichLabelCard(card) {
  if (card.catalogCardId) {
    const match = await findCatalogCardById(card.catalogCardId);
    return match ? {...card, setId: match.setId, seriesId: match.seriesId, seriesName: match.seriesName} : card;
  }
  if (card.identificationStatus === 'unresolved' || card.sourceLanguage && card.sourceLanguage !== 'en') return card;
  if (!card.name || !card.setName || !card.year || !card.cardNumber) return card;
  const matches = await findCatalogCandidates({name: card.name, setName: card.setName, year: card.year, cardNumber: card.cardNumber});
  const exact = matches.filter(match => match.name.toLowerCase() === card.name.toLowerCase()
    && match.setName.toLowerCase() === card.setName.toLowerCase() && match.year === card.year
    && numberKey(match.cardNumber) === numberKey(card.cardNumber));
  if (exact.length !== 1) return card;
  const match = exact[0];
  return {...card, catalogCardId: match.id, sourceLanguage: card.sourceLanguage || 'en',
    sourceSetId: card.sourceSetId ?? match.setId, setId: match.setId, seriesId: match.seriesId, seriesName: match.seriesName};
}
