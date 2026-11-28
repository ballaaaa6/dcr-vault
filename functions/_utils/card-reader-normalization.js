import {CARD_GAMES, GAME_CLASSIFICATIONS} from '../../src/utils/card-games.js';
const games = new Set(CARD_GAMES);
const languages = new Set(['en', 'ja', 'th', 'ko', 'zh-cn', 'zh-tw', 'de', 'fr', 'it', 'pt', 'es', 'id', 'nl', 'pl', 'ru']);
const clean = (value, limit = 120) => typeof value === 'string' ? value.trim().slice(0, limit) : '';

export function normalizeCardReading(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const game = clean(value.game, 40);
  const language = clean(value.language, 20).toLowerCase();
  const setNameEn = clean(value.set_name_en);
  const setNameLocal = clean(value.set_name_local);
  const setName = setNameLocal;
  const releaseYear = /^\d{4}$/.test(clean(value.release_year)) ? clean(value.release_year) : '';
  const year = releaseYear;
  const nameSource = source => ['printed', 'inferred'].includes(source) ? source : '';
  const setNameEnSource = setNameEn ? nameSource(value.set_name_en_source) : '';
  const setNameLocalSource = setNameLocal ? nameSource(value.set_name_local_source) : '';
  const selectedSource = setNameLocalSource;
  const setSource = selectedSource === 'printed' ? 'printed_name' : selectedSource === 'inferred' ? 'inferred_name' : '';
  const inferredFields = Array.isArray(value.inferred_fields) ? [...new Set(value.inferred_fields.filter(key =>
    (key === 'set' && setSource === 'inferred_name') || (key === 'year' && /^\d{4}$/.test(year)) || (key === 'rarity' && clean(value.rarity))))] : [];
  if (setSource === 'inferred_name' && !inferredFields.includes('set')) inferredFields.push('set');
  const reading = {game: games.has(game) ? game : '', language: languages.has(language) ? language : '',
    year, releaseYear, yearSource: releaseYear ? 'release' : '',
    setNameEn, setNameLocal, setNameEnSource, setNameLocalSource, setCode: clean(value.set_code, 32), setNameEnType: setNameEn && ['official', 'translation'].includes(value.set_name_en_type) ? value.set_name_en_type : '', setName, setSource,
    cardNumber: clean(value.card_number, 30), name: clean(value.name), rarity: clean(value.rarity, 80),
    category: clean(value.category, 40), colorElements: Array.isArray(value.color_element) ? value.color_element.map(item => clean(item, 40)).filter(Boolean).slice(0, 10) : [],
    subtypeDetail: clean(value.subtype_detail, 60), inferredFields};
  if (!reading.game) { reading.category = ''; reading.colorElements = []; reading.subtypeDetail = ''; }
  const choices = GAME_CLASSIFICATIONS[reading.game];
  if (choices) {
    if (!choices.category.includes(reading.category)) reading.category = '';
    reading.colorElements = [...new Set(reading.colorElements.filter(color => choices.colors.includes(color)))];
    if (!(choices.subtypes || []).includes(reading.subtypeDetail)) reading.subtypeDetail = '';
  }
  return Object.values(reading).some(item => Array.isArray(item) ? item.length : Boolean(item)) ? reading : null;
}
