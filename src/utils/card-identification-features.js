const AUTO_CONFIDENCE = 0.82;

export function normalized(value) {
  return String(value ?? '').trim().normalize('NFKC').toLocaleLowerCase('en-US');
}

export function compact(value) {
  return normalized(value).replace(/[\s\p{P}\p{S}]/gu, '');
}

export function values(value) {
  return (Array.isArray(value) ? value : [value]).map(normalized).filter(Boolean);
}

export function hasValue(value) {
  return Array.isArray(value) ? value.length > 0 : Boolean(String(value ?? '').trim());
}

export function confidentField(fields, field) {
  return hasValue(fields[field]) && Number(fields.fieldConfidence?.[field] || 0) >= AUTO_CONFIDENCE;
}

export function cardNames(card) {
  return new Set([card.name, ...(card.metadata?.nameAliases || [])].map(compact).filter(Boolean));
}

export function setNames(card) {
  const names = [card.setName, card.setId, ...(card.metadata?.setAliases || [])].map(compact).filter(Boolean);
  const suffix = {en: 'en', th: 'th', ja: 'jp', ko: 'kr', 'zh-tw': 'tw', 'zh-cn': 'cn'}[card.language];
  const printedCode = compact(card.setId);
  if (suffix && printedCode) names.push(`${printedCode}${suffix}`);
  return new Set(names);
}

export function observedNameMatches(card, fields) {
  return [fields.name, fields.englishName].some(name => name && cardNames(card).has(compact(name)));
}

export function numberParts(value) {
  const match = String(value ?? '').trim().match(/^#?(\d+)(?:\s*\/\s*(\d+))?$/);
  return match ? {number: String(Number(match[1])), denominator: match[2] ? String(Number(match[2])) : ''} : null;
}

export function cardNumberMatches(card, observed) {
  const input = numberParts(observed);
  if (!input) return compact(card.cardNumber) === compact(String(observed ?? '').split('/')[0]);
  const number = numberParts(card.cardNumber);
  if (!number || input.number !== number.number) return false;
  const count = String(card.metadata?.cardCount || '').trim();
  return !input.denominator || !!count && input.denominator === String(Number(count));
}

export function attacks(card) {
  if (Array.isArray(card.metadata?.attacks)) return card.metadata.attacks;
  return Array.isArray(card.attacks) ? card.attacks : [];
}

export function abilities(card) {
  if (Array.isArray(card.metadata?.abilities)) return card.metadata.abilities;
  const details = Array.isArray(card.abilityDetails) ? card.abilityDetails.map(item => ({
    names: values(item?.name), effects: values(item?.effect)
  })) : [];
  const names = Array.isArray(card.abilities) ? card.abilities.map(name => ({names: values(name)})) : [];
  names.forEach(ability => {
    const existing = details.find(item => item.names.some(name => ability.names.includes(name)));
    if (existing) existing.names = [...new Set([...existing.names, ...ability.names])];
    else details.push(ability);
  });
  return details;
}

function attackNames(attack) {
  return values(attack.names || attack.name);
}

function attackEffects(attack) {
  return values(attack.effects || attack.effect);
}

function variantRows(card) {
  const rows = card.metadata?.variants || card.variants;
  return Array.isArray(rows) ? rows.filter(item => item && typeof item === 'object') : [];
}

function canonicalFinish(value) {
  const finish = compact(value);
  if (!finish) return '';
  if (finish.includes('reverse')) return 'reverse';
  if (finish.includes('glossy')) return 'glossy';
  if (finish.includes('nonholo') || finish.includes('normal')) return 'normal';
  if (finish.includes('holo') || finish.includes('holographic') || finish.includes('foil')) return 'holo';
  return '';
}

function variantHasFinish(card, finish) {
  const rows = variantRows(card);
  if (!rows.length) return null;
  const types = rows.map(row => normalized(row.type));
  if (finish === 'holo') return types.includes('holo');
  if (finish === 'reverse') return types.includes('reverse') || types.includes('reverse holo');
  if (finish === 'normal') return types.includes('normal');
  if (finish === 'glossy') return rows.some(row => normalized(row.subtype) === 'glossy');
  return null;
}

function readableField(fields, key) {
  return hasValue(fields[key]) && Number(fields.fieldConfidence?.[key] || 0) >= 0.65;
}

function overlapRatio(left, right) {
  const a = new Set(values(left));
  const b = new Set(values(right));
  if (!a.size || !b.size) return 0;
  return [...a].filter(value => b.has(value)).length / Math.max(a.size, b.size);
}

function relationRatio(left, right) {
  return overlapRatio((left || []).map(item => `${item.type}:${item.value}`),
    (right || []).map(item => `${item.type}:${item.value}`));
}

function damageRatio(left, right) {
  const a = left.map(attack => normalized(attack.damage)).filter(Boolean);
  const b = right.map(attack => normalized(attack.damage)).filter(Boolean);
  if (!a.length || !b.length) return 0;
  return a.filter(value => b.includes(value)).length / Math.max(a.length, b.length);
}

function attackNameRatio(left, right) {
  if (!left.length || !right.length) return 0;
  const rightNames = new Set(right.flatMap(attackNames).map(compact).filter(Boolean));
  const matched = left.filter(attack => attackNames(attack).some(name => rightNames.has(compact(name)))).length;
  return matched / Math.max(left.length, right.length);
}

function stringSimilarity(left, right) {
  const a = compact(left);
  const b = compact(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (Math.min(a.length, b.length) < 5) return 0;
  const grams = value => new Set(Array.from({length: value.length - 1}, (_, index) => value.slice(index, index + 2)));
  const first = grams(a);
  const second = grams(b);
  const common = [...first].filter(item => second.has(item)).length;
  return common / Math.max(first.size, second.size);
}

function attackEffectRatio(left, right) {
  if (!left.length || !right.length) return 0;
  const matched = left.filter(attack => attackEffects(attack).some(effect => right.some(candidate =>
    attackEffects(candidate).some(other => stringSimilarity(effect, other) >= 0.7)))).length;
  return matched / Math.max(left.length, right.length);
}

function costRatio(left, right) {
  if (!left.length || !right.length) return 0;
  const rightCosts = new Set(right.map(attack => [...values(attack.cost)].sort().join('|')));
  const matched = left.filter(attack => rightCosts.has([...values(attack.cost)].sort().join('|'))).length;
  return matched / Math.max(left.length, right.length);
}

function attackEvidenceRatio(left, right) {
  if (!left.length || !right.length) return 0;
  const observed = left.filter(attack => attackNames(attack).length || attackEffects(attack).length || attack.damage || attack.cost?.length);
  if (!observed.length) return 0;
  const matched = observed.filter(attack => right.some(candidate => {
    const namesMatch = attackNames(attack).some(name => attackNames(candidate).some(other => compact(name) === compact(other)));
    const effectsMatch = attackEffects(attack).some(effect => attackEffects(candidate).some(other => stringSimilarity(effect, other) >= 0.7));
    const statsMatch = attack.damage && normalized(attack.damage) === normalized(candidate.damage)
      && attack.cost?.length && [...values(attack.cost)].sort().join('|') === [...values(candidate.cost)].sort().join('|');
    return namesMatch || effectsMatch || statsMatch;
  })).length;
  return matched / observed.length;
}

function abilityNameRatio(left, right) {
  const a = abilities(left);
  const b = abilities(right);
  if (!a.length || !b.length) return 0;
  const rightNames = new Set(b.flatMap(ability => ability.names || []).map(compact).filter(Boolean));
  return a.filter(ability => (ability.names || []).some(name => rightNames.has(compact(name)))).length / Math.max(a.length, b.length);
}

function abilityEffectRatio(left, right) {
  const a = abilities(left);
  const b = abilities(right);
  if (!a.length || !b.length) return 0;
  const matched = a.filter(ability => (ability.effects || []).some(effect => b.some(candidate =>
    (candidate.effects || []).some(other => stringSimilarity(effect, other) >= 0.7)))).length;
  return matched / Math.max(a.length, b.length);
}

export function cardFeatures(left, right) {
  const a = left.metadata || left;
  const b = right.metadata || right;
  const leftAttacks = attacks(left);
  const rightAttacks = attacks(right);
  const artistExact = !!a.illustrator && compact(a.illustrator) === compact(b.illustrator);
  const hpExact = !!a.hp && normalized(a.hp) === normalized(b.hp);
  const stageExact = !!a.stage && compact(a.stage) === compact(b.stage);
  const typeRatio = overlapRatio(a.types, b.types);
  const damages = damageRatio(leftAttacks, rightAttacks);
  const attackNamesMatch = attackNameRatio(leftAttacks, rightAttacks);
  const attackEffectsMatch = attackEffectRatio(leftAttacks, rightAttacks);
  const abilityNamesMatch = abilityNameRatio(left, right);
  const abilityEffectsMatch = abilityEffectRatio(left, right);
  const costs = costRatio(leftAttacks, rightAttacks);
  const weaknesses = relationRatio(a.weaknesses, b.weaknesses);
  const resistances = relationRatio(a.resistances, b.resistances);
  const retreatExact = !!a.retreat && normalized(a.retreat) === normalized(b.retreat);
  const evolvesFromExact = overlapRatio(a.evolvesFrom, b.evolvesFrom) === 1 && values(a.evolvesFrom).length > 0;
  const observedFinish = canonicalFinish(left.finish);
  const finishConfidence = Number(left.fieldConfidence?.finish || 0);
  const finishExact = observedFinish && finishConfidence >= 0.65
    ? variantHasFinish(right, observedFinish) === true : false;
  const evidence = [artistExact && 'illustrator', hpExact && 'HP', stageExact && 'stage', typeRatio > 0 && 'types',
    damages > 0 && 'attack damage', attackNamesMatch > 0 && 'attack name', attackEffectsMatch > 0 && 'attack effect',
    costs > 0 && 'energy cost', weaknesses > 0 && 'weakness', abilityNamesMatch > 0 && 'ability name',
    abilityEffectsMatch > 0 && 'ability effect',
    resistances > 0 && 'resistance', retreatExact && 'retreat', evolvesFromExact && 'evolves from', finishExact && 'finish'].filter(Boolean);
  const score = (artistExact ? 18 : 0) + (hpExact ? 10 : 0) + (stageExact ? 4 : 0)
    + typeRatio * 6 + damages * 22 + attackNamesMatch * 14 + attackEffectsMatch * 20 + costs * 8
    + weaknesses * 4 + abilityNamesMatch * 4 + abilityEffectsMatch * 16 + resistances * 3 + (retreatExact ? 2 : 0)
    + (evolvesFromExact ? 5 : 0) + (finishExact ? 12 * finishConfidence : 0);
  const corroborated = (artistExact && (attackEffectsMatch >= 0.5 || attackNamesMatch >= 0.75))
    || (damages === 1 && hpExact && stageExact) || (abilityNamesMatch === 1 && hpExact && stageExact)
    || evidence.length >= 4;
  return {score, evidence, corroborated, attackEvidenceRatio: attackEvidenceRatio(leftAttacks, rightAttacks)};
}

export function sourceSetMatches(card, fields) {
  const setName = fields.setName || (fields.language === 'en' ? fields.englishSetName : '');
  return !setName || setNames(card).has(compact(setName));
}

export function sourceConflicts(card, fields) {
  const data = card.metadata || card;
  const conflicts = [];
  if (confidentField(fields, 'hp') && data.hp && normalized(data.hp) !== normalized(fields.hp)) conflicts.push('HP');
  if (confidentField(fields, 'illustrator') && data.illustrator && compact(data.illustrator) !== compact(fields.illustrator)) conflicts.push('illustrator');
  if (confidentField(fields, 'stage') && data.stage && compact(data.stage) !== compact(fields.stage)) conflicts.push('stage');
  if (confidentField(fields, 'types') && Array.isArray(data.types) && overlapRatio(fields.types, data.types) === 0) conflicts.push('type');
  const finish = canonicalFinish(fields.finish);
  if (confidentField(fields, 'finish') && finish && variantHasFinish(card, finish) === false) conflicts.push('finish');
  const cardAttacks = attacks(card);
  if (confidentField(fields, 'attacks') && cardAttacks.length && attacks(fields).length
    && cardFeatures(fields, card).attackEvidenceRatio < 0.5) conflicts.push('attacks');
  const observedAbilities = abilities(fields);
  if ((confidentField(fields, 'abilities') || confidentField(fields, 'abilityDetails'))
    && observedAbilities.length && abilities(card).length
    && abilityNameRatio(fields, card) === 0 && abilityEffectRatio(fields, card) === 0) conflicts.push('abilities');
  return conflicts;
}

export function hasSourceEvidence(card, fields) {
  const fullNumber = /^#?\d+\s*\/\s*\d+$/.test(String(fields.cardNumber || '').trim())
    && Number(fields.fieldConfidence?.cardNumber || 0) >= 0.9 && cardNumberMatches(card, fields.cardNumber);
  if (fullNumber) return true;
  const metadata = card.metadata || card;
  const featureMatches = [
    confidentField(fields, 'setName') && sourceSetMatches(card, fields),
    readableField(fields, 'hp') && metadata.hp && normalized(fields.hp) === normalized(metadata.hp),
    readableField(fields, 'illustrator') && metadata.illustrator && compact(fields.illustrator) === compact(metadata.illustrator),
    readableField(fields, 'attacks') && cardFeatures(fields, card).attackEvidenceRatio >= 0.5,
    readableField(fields, 'finish') && variantHasFinish(card, canonicalFinish(fields.finish)) === true,
    (readableField(fields, 'abilities') || readableField(fields, 'abilityDetails'))
      && (abilityNameRatio(fields, card) > 0 || abilityEffectRatio(fields, card) > 0),
    readableField(fields, 'rarity') && normalized(fields.rarity) === normalized(card.rarity)
  ].filter(Boolean);
  return featureMatches.length >= 2;
}

export function confidentIdentity(fields) {
  if (!confidentField(fields, 'name') || !confidentField(fields, 'language')) return false;
  const fullNumber = /^#?\d+\s*\/\s*\d+$/.test(String(fields.cardNumber || '').trim())
    && Number(fields.fieldConfidence?.cardNumber || 0) >= 0.9;
  const anchors = ['setName', 'englishSetName', 'year', 'rarity', 'hp', 'illustrator', 'stage',
    'types', 'attacks', 'abilities', 'abilityDetails', 'weaknesses', 'resistances', 'finish']
    .filter(field => confidentField(fields, field));
  return fullNumber || anchors.length >= 2;
}
