import {findCatalogCandidates, findCatalogCardById, loadCatalogCards} from '../store/catalog.js';

function numberKey(value) {
  return String(value || '').trim().replace(/^#/, '').split('/')[0].replace(/^0+(?=\d)/, '').toLowerCase();
}

async function sourceSeries(card) {
  const language = String(card.sourceLanguage || card.language || 'en').toLowerCase();
  if (language === 'en' || !card.sourceSetId) return '';
  const cards = await loadCatalogCards();
  const matches = cards.filter(item => item.language === language && item.setId === card.sourceSetId
    && (!card.sourceCardId || item.id === card.sourceCardId));
  const series = [...new Set(matches.map(item => item.seriesId).filter(Boolean))];
  return series.length === 1 ? series[0] : '';
}

export async function enrichLabelCard(card) {
  const language = String(card.sourceLanguage || card.language || 'en').toLowerCase();
  if (card.series) return card;
  if (language !== 'en') {
    const seriesId = await sourceSeries(card).catch(() => '');
    return {...card, seriesId};
  }
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
