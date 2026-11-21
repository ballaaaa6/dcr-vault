import labelRules from '../../dcr-tag-70x20/catalog-label-rules.json';
import psaProfiles from '../../dcr-tag-70x20/psa-label-profiles.json';

function normalized(value) {
  return String(value ?? '').trim().toLocaleLowerCase('en-US');
}

function catalogSetId(card) {
  if (card.setId) return String(card.setId);
  const catalogId = String(card.catalogCardId || card.id || '');
  const separator = catalogId.lastIndexOf('-');
  return separator > 0 ? catalogId.slice(0, separator) : '';
}

function profileFor(card) {
  const language = String(card.sourceLanguage || card.language || 'en').toLowerCase();
  const setId = String(card.sourceSetId ?? (language === 'en' ? card.setId : '') ?? '');
  return psaProfiles.profiles?.[`${language}:${setId}`];
}

function yearSeriesFor(card, profile) {
  const language = String(card.sourceLanguage || card.language || 'en').toLowerCase();
  if (language !== 'en') return profile?.status === 'verified' ? profile?.tag_fields?.year_series || '' : '';
  const override = labelRules.set_overrides?.[catalogSetId(card)];
  if (override?.year_series) return override.year_series;
  const series = String(labelRules.series_labels?.[String(card.seriesId || '').toLowerCase()] || '').trim();
  const year = String(card.year || '').trim();
  if (!series || !year) return '';
  const upper = series.toLocaleUpperCase('en-US');
  const prefix = /^(POKÉMON|POKEMON)\s/.test(upper) ? '' : 'POKÉMON ';
  return `${year} ${prefix}${upper}`;
}

export function cardLabelMetadata(card = {}) {
  const profile = profileFor(card);
  const override = labelRules.set_overrides?.[catalogSetId(card)];
  const sourceLanguage = String(card.sourceLanguage || card.language || 'en').toLowerCase();
  const yearSeries = String(yearSeriesFor(card, profile)).trim();
  const labelMetadataReady = sourceLanguage === 'en' || profile?.status === 'verified';
  return {
    yearSeries,
    setName: String(override?.collection
      || (sourceLanguage !== 'en' && profile?.status === 'verified' ? profile?.tag_fields?.collection : '')
      || card.setName || profile?.tag_fields?.collection || '').trim(),
    sourceLanguage,
    sourceSetId: String(card.sourceSetId ?? (sourceLanguage === 'en' ? card.setId : '') ?? ''),
    catalogCardId: String(card.catalogCardId || card.id || ''), labelMetadataReady
  };
}

export function cardLabelRarity(card = {}) {
  const rarity = String(card.rarity || '').trim();
  const key = normalized(rarity);
  if (!key || ['none', 'null', 'undefined'].includes(key)) return '';
  const language = String(card.sourceLanguage || card.language || 'en').toLowerCase();
  const profile = profileFor(card);
  const cardId = String(card.catalogCardId || card.id || '');
  const specific = psaProfiles.card_labels?.[`${language}:${cardId}`];
  const specificCode = specific?.status === 'verified' ? specific.dcr_rarity_code : '';
  if (specificCode) return specificCode;
  const profileRarity = profile?.rarity_terms?.[key];
  const profileCode = profileRarity?.status === 'verified' ? profileRarity.dcr_rarity_code : '';
  if (profileCode) return profileCode;
  const languageCode = labelRules.language_rarity_codes?.[language]?.[key];
  return languageCode || labelRules.rarity_codes?.[key] || rarity.toLocaleUpperCase('en-US');
}
