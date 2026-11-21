const LANGUAGES = new Set(['en', 'th', 'ja', 'ko', 'zh-tw', 'zh-cn', 'de', 'fr', 'es', 'it', 'pt', 'id', 'nl', 'pl', 'ru']);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function fieldValue(value, keys) {
  for (const key of keys) {
    if (value[key] !== undefined && value[key] !== null && value[key] !== '') return value[key];
  }
  return '';
}

export function cleanText(value, limit = 120) {
  if (typeof value === 'number' && Number.isFinite(value)) value = String(value);
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function cleanList(value, limit = 8) {
  if (!Array.isArray(value)) return [];
  return value.map(item => cleanText(item, 120)).filter(Boolean).slice(0, limit);
}

function cleanAttacks(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 4).map(attack => {
    const names = Array.isArray(attack?.names) ? attack.names
      : Array.isArray(attack?.name) ? attack.name : [attack?.name];
    const effects = Array.isArray(attack?.effects) ? attack.effects
      : Array.isArray(attack?.effect) ? attack.effect : [attack?.effect];
    return {names: cleanList([...names, attack?.englishName], 6),
      damage: cleanText(attack?.damage, 12), cost: cleanList(attack?.cost, 6),
      effects: cleanList([...effects, attack?.englishEffect], 2).map(effect => effect.slice(0, 500))};
  }).filter(attack => attack.names.length || attack.damage || attack.cost.length || attack.effects.length);
}

function cleanAbilityDetails(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 4).map(ability => ({name: cleanText(ability?.name, 100), effect: cleanText(ability?.effect, 500)}))
    .filter(ability => ability.name || ability.effect);
}

function cleanCardRelations(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 4).map(item => ({type: cleanText(item?.type, 32), value: cleanText(item?.value, 16)}))
    .filter(item => item.type || item.value);
}

function cleanFieldConfidence(value) {
  if (!isObject(value)) return {};
  const allowed = ['name', 'setName', 'setCode', 'englishName', 'englishSetName', 'englishCardNumber', 'year', 'cardNumber', 'language', 'rarity', 'hp',
    'illustrator', 'stage', 'types', 'attacks', 'abilities', 'abilityDetails', 'weaknesses', 'resistances',
    'retreat', 'evolvesFrom', 'regulationMark', 'printedText', 'dexNumber', 'level', 'finish'];
  return Object.fromEntries(allowed.flatMap(key => {
    const confidence = Number(value[key]);
    return Number.isFinite(confidence) ? [[key, Math.max(0, Math.min(0.98, confidence))]] : [];
  }));
}

function languageCode(value) {
  const language = cleanText(value, 30).toLowerCase();
  const aliases = {english: 'en', thai: 'th', japanese: 'ja', korean: 'ko',
    'traditional chinese': 'zh-tw', 'simplified chinese': 'zh-cn', german: 'de', french: 'fr', spanish: 'es', italian: 'it', portuguese: 'pt', indonesian: 'id', dutch: 'nl', polish: 'pl', russian: 'ru'};
  const code = aliases[language] || language;
  return LANGUAGES.has(code) ? code : '';
}

export function cleanReading(value) {
  if (!isObject(value)) return null;
  const yearValue = cleanText(fieldValue(value, ['year', 'printedYear', 'printed_year']), 12);
  const year = yearValue.match(/(?:19|20)\d{2}/)?.[0] || '';
  const rarity = cleanText(fieldValue(value, ['rarity', 'raritySymbol', 'rarity_symbol', 'rarityCode']), 40);
  const reading = {
    form: {name: cleanText(value.formName), setName: cleanText(value.formSetName),
      year: /^(19|20)\d{2}$/.test(cleanText(value.formYear)) ? cleanText(value.formYear) : '',
      cardNumber: cleanText(value.formCardNumber, 30), rarity: cleanText(value.formRarity, 40)},
    name: cleanText(fieldValue(value, ['name', 'cardName', 'card_name', 'pokemonName', 'pokemon_name'])),
    setName: cleanText(fieldValue(value, ['setName', 'set_name', 'set', 'expansion'])),
    setCode: cleanText(fieldValue(value, ['setCode', 'set_code', 'setAbbreviation', 'set_abbreviation']), 32),
    englishName: cleanText(fieldValue(value, ['englishName', 'english_name'])),
    englishSetName: cleanText(fieldValue(value, ['englishSetName', 'english_set_name'])),
    englishCardNumber: cleanText(fieldValue(value, ['englishCardNumber', 'english_card_number']), 40),
    identificationSummary: cleanText(fieldValue(value, ['identificationSummary', 'identification_summary']), 300),
    identityStatus: ['identified', 'needs_review'].includes(value.identityStatus) ? value.identityStatus : 'needs_review',
    evidence: cleanList(value.evidence, 8), uncertainFields: cleanList(value.uncertainFields, 12),
    year, cardNumber: cleanText(fieldValue(value, ['cardNumber', 'card_number', 'collectorNumber', 'collector_number', 'number']), 30),
    language: languageCode(value.language), rarity,
    hp: cleanText(value.hp, 8), illustrator: cleanText(fieldValue(value, ['illustrator', 'artist']), 80),
    stage: cleanText(value.stage, 40), types: cleanList(value.types, 4), attacks: cleanAttacks(value.attacks),
    abilities: cleanList(value.abilities, 4), abilityDetails: cleanAbilityDetails(value.abilityDetails),
    weaknesses: cleanCardRelations(value.weaknesses), resistances: cleanCardRelations(value.resistances),
    retreat: cleanText(value.retreat, 8), evolvesFrom: cleanText(fieldValue(value, ['evolvesFrom', 'evolves_from']), 80),
    regulationMark: cleanText(value.regulationMark, 16), printedText: cleanText(value.printedText, 1200),
    stamp: cleanText(value.stamp, 80), setSymbol: cleanText(value.setSymbol, 80), copyrightText: cleanText(value.copyrightText, 200),
    dexNumber: cleanText(fieldValue(value, ['dexNumber', 'pokedexNumber', 'pokedex_number']), 6),
    level: cleanText(value.level, 6), finish: cleanText(fieldValue(value, ['finish', 'foil', 'variant']), 32),
    fieldConfidence: cleanFieldConfidence(value.fieldConfidence || value.confidence)
  };
  return reading.name || reading.englishName || reading.identificationSummary || reading.language && reading.cardNumber ? reading : null;
}
