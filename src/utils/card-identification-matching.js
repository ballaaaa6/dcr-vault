function normalized(value) {
  return String(value ?? '').trim().normalize('NFKC').toLocaleLowerCase('en-US');
}

function compact(value) {
  return normalized(value).replace(/[\s\p{P}\p{S}]/gu, '');
}

function values(value) {
  return (Array.isArray(value) ? value : [value]).map(normalized).filter(Boolean);
}

function cardNames(card) {
  return new Set([card.name, ...(card.metadata?.nameAliases || [])].map(compact).filter(Boolean));
}

function setNames(card) {
  return new Set([card.setName, card.setId, ...(card.metadata?.setAliases || [])].map(compact).filter(Boolean));
}

function observedNameMatches(card, fields) {
  const names = cardNames(card);
  return [fields.name, fields.englishName].some(name => name && names.has(compact(name)));
}

function observedSetMatches(card, fields) {
  const sets = setNames(card);
  return [fields.setName, fields.englishSetName].some(name => name && sets.has(compact(name)));
}

function numberParts(value) {
  const match = String(value ?? '').trim().match(/^#?(\d+)(?:\s*\/\s*(\d+))?$/);
  return match ? {number: String(Number(match[1])), denominator: match[2] ? String(Number(match[2])) : ''} : null;
}

function numberMatches(card, observed) {
  const input = numberParts(observed);
  if (!input) return false;
  const number = numberParts(card.cardNumber);
  if (!number || input.number !== number.number) return false;
  const count = String(card.metadata?.cardCount || '').trim();
  return !input.denominator || !!count && input.denominator === String(Number(count));
}

function attacks(card) {
  if (Array.isArray(card.metadata?.attacks)) return card.metadata.attacks;
  return Array.isArray(card.attacks) ? card.attacks : [];
}

function abilities(card) {
  if (Array.isArray(card.metadata?.abilities)) return card.metadata.abilities;
  return Array.isArray(card.abilities) ? card.abilities.map(names => ({names: values(names)})) : [];
}

function damageRatio(left, right) {
  const a = left.map(attack => normalized(attack.damage)).filter(Boolean);
  const b = right.map(attack => normalized(attack.damage)).filter(Boolean);
  if (!a.length || !b.length) return 0;
  const remaining = [...b];
  const matches = a.filter(value => {
    const index = remaining.indexOf(value);
    if (index < 0) return false;
    remaining.splice(index, 1);
    return true;
  }).length;
  return matches / Math.max(a.length, b.length);
}

function attackNameRatio(left, right) {
  if (!left.length || !right.length) return 0;
  const rightNames = new Set(right.flatMap(attack => attack.names || []).map(compact).filter(Boolean));
  const matched = left.filter(attack => (attack.names || []).some(name => rightNames.has(compact(name)))).length;
  return matched / Math.max(left.length, right.length);
}

function abilityNameRatio(left, right) {
  const a = abilities(left);
  const b = abilities(right);
  if (!a.length || !b.length) return 0;
  const rightNames = new Set(b.flatMap(ability => ability.names || []).map(compact).filter(Boolean));
  const matched = a.filter(ability => (ability.names || []).some(name => rightNames.has(compact(name)))).length;
  return matched / Math.max(a.length, b.length);
}

function costRatio(left, right) {
  if (!left.length || !right.length) return 0;
  const rightCosts = new Set(right.map(attack => [...values(attack.cost)].sort().join('|')));
  const matched = left.filter(attack => rightCosts.has([...values(attack.cost)].sort().join('|'))).length;
  return matched / Math.max(left.length, right.length);
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

function cardFeatures(left, right) {
  const a = left.metadata || left;
  const b = right.metadata || right;
  const leftAttacks = attacks(left);
  const rightAttacks = attacks(right);
  const artistExact = !!a.illustrator && compact(a.illustrator) === compact(b.illustrator);
  const hpExact = !!a.hp && normalized(a.hp) === normalized(b.hp);
  const stageExact = !!a.stage && compact(a.stage) === compact(b.stage);
  const typeRatio = overlapRatio(a.types, b.types);
  const damages = damageRatio(leftAttacks, rightAttacks);
  const attackNames = attackNameRatio(leftAttacks, rightAttacks);
  const abilityNames = abilityNameRatio(left, right);
  const costs = costRatio(leftAttacks, rightAttacks);
  const weaknesses = relationRatio(a.weaknesses, b.weaknesses);
  const resistances = relationRatio(a.resistances, b.resistances);
  const retreatExact = !!a.retreat && normalized(a.retreat) === normalized(b.retreat);
  const evolvesFromExact = overlapRatio(a.evolvesFrom, b.evolvesFrom) === 1 && values(a.evolvesFrom).length > 0;
  const score = (artistExact ? 18 : 0) + (hpExact ? 10 : 0) + (stageExact ? 4 : 0)
    + typeRatio * 6 + damages * 22 + attackNames * 12 + costs * 8 + weaknesses * 4
    + abilityNames * 4 + resistances * 3 + (retreatExact ? 2 : 0) + (evolvesFromExact ? 5 : 0);
  return {score, artistExact, hpExact, damages, attackNames, corroborated:
    (artistExact && damages >= 0.75) || (damages === 1 && hpExact && stageExact)
      || (abilityNames === 1 && hpExact && stageExact && damages >= 0.5)};
}

function sourceScore(card, fields) {
  return (observedNameMatches(card, fields) ? 30 : 0) + (numberMatches(card, fields.cardNumber) ? 28 : 0)
    + (observedSetMatches(card, fields) ? 20 : 0) + (fields.year && card.year === fields.year ? 8 : 0)
    + (fields.language && card.language === fields.language ? 6 : 0) + cardFeatures(fields, card).score;
}

function sourceCards(cards, fields) {
  const hasNumber = !!numberParts(fields.cardNumber);
  const hasSet = !!fields.setName;
  if (!fields.language || (!hasNumber && !hasSet)) return [];
  return cards.filter(card => card.language === fields.language
    && observedNameMatches(card, fields)
    && (!hasNumber || numberMatches(card, fields.cardNumber))
    && (!hasSet || observedSetMatches(card, fields))
    && (!fields.year || card.year === fields.year))
    .map(card => ({card, score: sourceScore(card, fields)}))
    .sort((left, right) => right.score - left.score);
}

function englishNamesMatch(source, english, fields) {
  const names = cardNames(source);
  const englishNames = cardNames(english);
  const englishNameExact = !fields.englishName || compact(fields.englishName) === compact(english.name);
  return englishNameExact && ([...names].some(name => englishNames.has(name))
    || (fields.englishName && compact(fields.englishName) === compact(english.name)));
}

function candidateFromSource(source, english, fields) {
  if (!englishNamesMatch(source, english, fields)) return null;
  if (fields.englishSetName && !setNames(english).has(compact(fields.englishSetName))) return null;
  if (fields.year && english.year && fields.year !== english.year) return null;
  const features = cardFeatures(source, english);
  const yearBonus = fields.year && fields.year === english.year ? 6 : 0;
  const explicitSetBonus = fields.englishSetName ? 12 : 0;
  const score = 28 + features.score + yearBonus + explicitSetBonus;
  if (!features.corroborated || score < 58) return null;
  const sourceNumber = fields.cardNumber || (source.metadata?.cardCount
    ? `${source.cardNumber}/${source.metadata.cardCount}` : source.cardNumber);
  return {...english, catalogCardId: english.id, previewImage: source.imageUrl || '',
    previewImageFallback: source.imageUrl ? source.imageUrlFallback || '' : '',
    sourceCardId: source.id, sourceCardNumber: sourceNumber, sourceLanguage: source.language,
    sourceSetId: source.setId, matchScore: score,
    matchEvidence: [features.artistExact && 'illustrator', features.hpExact && 'HP',
      features.damages === 1 && 'attack damage', features.attackNames > 0 && 'attack name'].filter(Boolean)};
}

function directEnglishCandidates(cards, fields) {
  if (fields.language !== 'en') return [];
  const hasName = [fields.name, fields.englishName].some(Boolean);
  if (!hasName || !numberParts(fields.cardNumber) || !(fields.setName || fields.englishSetName)) return [];
  return cards.filter(card => card.language === 'en' && observedNameMatches(card, fields)
    && (!fields.englishName || compact(fields.englishName) === compact(card.name))
    && (!fields.englishSetName || setNames(card).has(compact(fields.englishSetName)))
    && numberMatches(card, fields.cardNumber) && observedSetMatches(card, fields)
    && (!fields.year || card.year === fields.year))
    .map(card => ({...card, catalogCardId: card.id, previewImage: card.imageUrl, previewImageFallback: card.imageUrlFallback || '',
      sourceLanguage: 'en', sourceSetId: card.setId, sourceCardNumber: fields.cardNumber,
      matchScore: 100, matchEvidence: ['name', 'set', 'collector number']}));
}

export function findImageCandidatesFromCatalog(cards, fields, limit = 8) {
  const direct = directEnglishCandidates(cards, fields);
  if (direct.length) return direct.slice(0, limit).map(card => ({...card, autoSelect: direct.length === 1}));
  const sourceMatches = sourceCards(cards, fields);
  if (!sourceMatches.length) return [];
  const english = cards.filter(card => card.language === 'en');
  const candidates = new Map();
  sourceMatches.forEach(({card: source}) => english.forEach(card => {
    const candidate = candidateFromSource(source, card, fields);
    if (!candidate) return;
    candidates.set(`${candidate.id}:${source.id}`, candidate);
  }));
  const ranked = [...candidates.values()].sort((left, right) => right.matchScore - left.matchScore
    || left.name.localeCompare(right.name));
  if (!ranked.length) return [];
  const credible = ranked.filter(card => card.matchScore >= Math.max(58, ranked[0].matchScore - 20)).slice(0, limit);
  const margin = credible.length > 1 ? credible[0].matchScore - credible[1].matchScore : Infinity;
  if (credible[0].matchScore >= 80 && (credible.length === 1 || credible[0].matchScore >= 88 && margin >= 15)) {
    return [{...credible[0], autoSelect: true}];
  }
  return credible.map(card => ({...card, autoSelect: false}));
}
