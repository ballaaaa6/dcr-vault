export function cardLabelMetadata(card = {}) {
  const sourceLanguage = String(card.sourceLanguage || card.language || '').toLowerCase();
  return {yearSeries: [card.year, card.game].filter(Boolean).join(' '),
    setName: String(card.setName || '').trim(), sourceLanguage, sourceSetId: '', catalogCardId: '',
    labelMetadataReady: Boolean(sourceLanguage)};
}
