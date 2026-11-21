const READING_FIELDS = ['name', 'englishName', 'setName', 'englishSetName', 'year', 'cardNumber', 'language', 'rarity',
  'hp', 'illustrator', 'stage', 'types', 'attacks', 'abilities', 'abilityDetails', 'weaknesses', 'resistances',
  'retreat', 'evolvesFrom', 'regulationMark', 'printedText', 'dexNumber', 'level', 'finish'];
const IDENTITY_ANCHORS = ['cardNumber', 'setName', 'englishSetName', 'year', 'hp', 'illustrator', 'attacks', 'finish'];
const CRITICAL_FIELDS = new Set(['name', 'language', 'setName', 'cardNumber', 'hp', 'illustrator', 'attacks', 'finish']);

function present(value) {
  return Array.isArray(value) ? value.length > 0 : Boolean(String(value ?? '').trim());
}

function confidence(fields, key) {
  return Number(fields?.fieldConfidence?.[key] || 0);
}

function fullCollectorNumber(value) {
  return /^#?\d+\s*\/\s*\d+$/.test(String(value || '').trim());
}

export function hasEnoughIdentityReading(fields) {
  if (fields?.disagreements?.some(item => CRITICAL_FIELDS.has(item.field)
    && item.primaryConfidence >= 0.65 && item.fallbackConfidence >= 0.65)) return false;
  if (!present(fields?.name || fields?.englishName) || !present(fields?.language) || confidence(fields, 'language') < 0.65) return false;
  const numberAnchor = fullCollectorNumber(fields.cardNumber) && confidence(fields, 'cardNumber') >= 0.9;
  const anchors = IDENTITY_ANCHORS.filter(key => present(fields[key]) && confidence(fields, key) >= 0.65);
  return numberAnchor || anchors.length >= 2;
}

function valueKey(value) {
  return Array.isArray(value) ? JSON.stringify(value) : String(value ?? '').trim().normalize('NFKC').toLocaleLowerCase();
}

function comparableText(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}

function attackValues(attack, field) {
  const value = attack?.[field] ?? attack?.[field === 'names' ? 'name' : 'effect'];
  return (Array.isArray(value) ? value : [value]).map(comparableText).filter(Boolean);
}

function attacksCompatible(first, second) {
  if (!Array.isArray(first) || !Array.isArray(second)) return false;
  const pairs = [];
  for (const left of first) {
    for (const right of second) {
      const nameMatch = attackValues(left, 'names').some(value => attackValues(right, 'names').includes(value));
      const effectMatch = attackValues(left, 'effects').some(value => attackValues(right, 'effects').includes(value));
      if (!nameMatch && !effectMatch) continue;
      const damageConflict = left?.damage && right?.damage && comparableText(left.damage) !== comparableText(right.damage);
      const leftCost = (left?.cost || []).map(comparableText).sort().join('|');
      const rightCost = (right?.cost || []).map(comparableText).sort().join('|');
      const costConflict = leftCost && rightCost && leftCost !== rightCost;
      if (damageConflict || costConflict) return false;
      pairs.push([left, right]);
    }
  }
  return pairs.length >= Math.min(first.length, second.length);
}

function equivalentValues(field, first, second) {
  if (field === 'attacks') return attacksCompatible(first, second);
  if (field === 'finish') {
    const finish = value => {
      const key = comparableText(value);
      if (!key) return '';
      if (key.includes('reverse')) return 'reverse';
      if (key.includes('glossy')) return 'glossy';
      if (key.includes('nonholo') || key.includes('normal')) return 'normal';
      if (key.includes('holo') || key.includes('foil')) return 'holo';
      return key;
    };
    return finish(first) === finish(second);
  }
  return valueKey(first) === valueKey(second) || comparableText(first) === comparableText(second);
}

function chooseField(primary, secondary, field, disagreements) {
  const first = primary?.[field];
  const second = secondary?.[field];
  if (!present(first)) return {value: second, reader: secondary};
  if (!present(second)) return {value: first, reader: primary};
  if (equivalentValues(field, first, second)) return {value: first, reader: primary};
  disagreements.push({field, primary: first, fallback: second,
    primaryConfidence: confidence(primary, field), fallbackConfidence: confidence(secondary, field)});
  return confidence(secondary, field) > confidence(primary, field)
    ? {value: second, reader: secondary} : {value: first, reader: primary};
}

export function mergeReadings(primary, fallback) {
  if (!primary) return fallback ? {...fallback, disagreements: []} : null;
  if (!fallback) return {...primary, disagreements: []};
  const disagreements = [];
  const fieldConfidence = {};
  const merged = Object.fromEntries(READING_FIELDS.map(field => {
    const chosen = chooseField(primary, fallback, field, disagreements);
    fieldConfidence[field] = confidence(chosen.reader, field);
    return [field, chosen.value];
  }));
  merged.fieldConfidence = fieldConfidence;
  merged.disagreements = disagreements;
  return merged;
}
