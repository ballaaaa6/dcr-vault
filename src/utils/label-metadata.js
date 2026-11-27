export function cardSeries(card = {}) {
  return String(card.series || '').trim();
}

export function cardLabelMetadata(card = {}) {
  const sourceLanguage = String(card.sourceLanguage || card.language || '').toLowerCase();
  return {yearSeries: [card.year, card.game, card.series].filter(Boolean).join(' '),
    setName: String(card.setName || '').trim(), sourceLanguage, sourceSetId: '', catalogCardId: '',
    labelMetadataReady: Boolean(sourceLanguage)};
}
