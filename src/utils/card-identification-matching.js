const AUTO_CONFIDENCE = 0.82;

function normalized(value) {
  return String(value ?? '').trim().normalize('NFKC').toLocaleLowerCase('en-US');
}

function compact(value) {
  return normalized(value).replace(/[\s\p{P}\p{S}]/gu, '');
}

function values(value) {
  return (Array.isArray(value) ? value : [value]).map(normalized).filter(Boolean);
}

function hasValue(value) {
  return Array.isArray(value) ? value.length > 0 : Boolean(String(value ?? '').trim());
}

function confidentField(fields, field) {
  return hasValue(fields[field]) && Number(fields.fieldConfidence?.[field] || 0) >= AUTO_CONFIDENCE;
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

function cardNumberMatches(card, observed) {
  return numberParts(observed) ? numberMatches(card, observed)
    : compact(card.cardNumber) === compact(String(observed ?? '').split('/')[0]);
}

function confidentIdentity(fields) {
  if (!confidentField(fields, 'name') || !confidentField(fields, 'language')) return false;
  const fullNumber = /^#?\d+\s*\/\s*\d+$/.test(String(fields.cardNumber || '').trim())
    && Number(fields.fieldConfidence?.cardNumber || 0) >= 0.9;
  const anchors = ['setName', 'englishSetName', 'year', 'rarity', 'hp', 'illustrator', 'stage',
    'types', 'attacks', 'abilities', 'weaknesses', 'resistances']
    .filter(field => confidentField(fields, field));
  return fullNumber || anchors.length >= 2;
}

function attacks(card) {
  if (Array.isArray(card.metadata?.attacks)) return card.metadata.attacks;
  return Array.isArray(card.attacks) ? card.attacks : [];
}

function attackLabelNames(attack) {
  return values(attack.names || attack.name);
}

function abilities(card) {
  if (Array.isArray(card.metadata?.abilities)) return card.metadata.abilities;
  if (Array.isArray(card.abilityDetails)) return card.abilityDetails.map(item => ({names: values(item?.name)}));
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
  const rightNames = new Set(right.flatMap(attackLabelNames).map(compact).filter(Boolean));
  const matched = left.filter(attack => attackLabelNames(attack).some(name => rightNames.has(compact(name)))).length;
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
  const evidence = [artistExact && 'illustrator', hpExact && 'HP', stageExact && 'stage', typeRatio > 0 && 'types',
    damages > 0 && 'attack damage', attackNames > 0 && 'attack name', costs > 0 && 'energy cost',
    weaknesses > 0 && 'weakness', abilityNames > 0 && 'ability', resistances > 0 && 'resistance',
    retreatExact && 'retreat', evolvesFromExact && 'evolves from'].filter(Boolean);
  const score = (artistExact ? 18 : 0) + (hpExact ? 10 : 0) + (stageExact ? 4 : 0)
    + typeRatio * 6 + damages * 22 + attackNames * 12 + costs * 8 + weaknesses * 4
    + abilityNames * 4 + resistances * 3 + (retreatExact ? 2 : 0) + (evolvesFromExact ? 5 : 0);
  const corroborated = (artistExact && damages >= 0.75) || (damages === 1 && hpExact && stageExact)
    || (abilityNames === 1 && hpExact && stageExact && damages >= 0.5) || evidence.length >= 3;
  return {score, evidence, corroborated};
}

function sourceSetMatches(card, fields) {
  const setName = fields.setName || (fields.language === 'en' ? fields.englishSetName : '');
  return !setName || setNames(card).has(compact(setName));
}

function sourceScore(card, fields) {
  const features = cardFeatures(fields, card);
  const exactName = [fields.name, fields.englishName].some(name => name && compact(card.name) === compact(name));
  const numberMatch = fields.cardNumber && cardNumberMatches(card, fields.cardNumber);
  const setMatch = sourceSetMatches(card, fields);
  const yearMatch = fields.year && card.year === fields.year;
  const rarityMatch = fields.rarity && normalized(card.rarity) === normalized(fields.rarity);
  const evidence = [exactName ? 'printed name' : 'name alias', numberMatch && 'collector number',
    setMatch && fields.setName && 'printed set', yearMatch && 'year', rarityMatch && 'rarity', ...features.evidence].filter(Boolean);
  return {score: (observedNameMatches(card, fields) ? 30 : 0) + (numberMatch ? 28 : 0)
    + (setMatch && fields.setName ? 20 : 0) + (yearMatch ? 8 : 0)
    + (fields.language && card.language === fields.language ? 6 : 0) + (rarityMatch ? 6 : 0) + features.score,
  evidence, features};
}

function sourceCards(cards, fields) {
  if (!fields.language || ![fields.name, fields.englishName].some(Boolean)) return [];
  return cards.filter(card => card.language === fields.language && observedNameMatches(card, fields)
    && (!confidentField(fields, 'cardNumber') || cardNumberMatches(card, fields.cardNumber))
    && (!confidentField(fields, 'setName') || !card.setName || sourceSetMatches(card, fields))
    && (fields.language !== 'en' || !confidentField(fields, 'englishSetName')
      || !card.setName || setNames(card).has(compact(fields.englishSetName))))
    .map(card => ({card, ...sourceScore(card, fields)}))
    .sort((left, right) => right.score - left.score);
}

export function findExactCatalogCardFromCatalog(cards, fields) {
  const name = compact(fields.name);
  const setName = compact(fields.setName);
  if (!name || !setName || !hasValue(fields.year) && !hasValue(fields.cardNumber)) return null;
  const matches = cards.filter(card => card.language === 'en' && cardNames(card).has(name)
    && setNames(card).has(setName) && (!fields.year || card.year === String(fields.year).trim())
    && (!fields.cardNumber || cardNumberMatches(card, fields.cardNumber)));
  return matches.length === 1 ? matches[0] : null;
}

function englishNamesMatch(source, english, fields) {
  const names = cardNames(source);
  const englishNames = cardNames(english);
  const sharedName = [...names].some(name => englishNames.has(name));
  const modelName = fields.englishName && englishNames.has(compact(fields.englishName));
  if (confidentField(fields, 'englishName') && !modelName) return false;
  return sharedName || modelName;
}

function englishSetMatches(english, fields) {
  return !confidentField(fields, 'englishSetName') || setNames(english).has(compact(fields.englishSetName));
}

function candidateFromSource(sourceMatch, english, fields, englishNameCount) {
  const source = sourceMatch.card;
  if (!englishSetMatches(english, fields)) return null;
  const features = source.language === 'en' ? cardFeatures(fields, english) : cardFeatures(source, english);
  const sameSetAndNumber = source.setId === english.setId && cardNumberMatches(english, source.cardNumber);
  const exactSourceAnchor = sameSetAndNumber && [...cardNames(source)].some(name => cardNames(english).has(name));
  const counterpartProof = source.language === 'en' || features.corroborated || exactSourceAnchor || englishNameCount === 1;
  const modelNameBonus = fields.englishName && compact(fields.englishName) === compact(english.name) ? 10 : 0;
  const englishSetBonus = fields.englishSetName && setNames(english).has(compact(fields.englishSetName)) ? 12 : 0;
  const sameIdBonus = source.id === english.id && exactSourceAnchor ? 6 : 0;
  const score = sourceMatch.score + features.score + modelNameBonus + englishSetBonus + sameIdBonus;
  const matchEvidence = [...new Set([...sourceMatch.evidence, ...features.evidence,
    modelNameBonus && 'official English name', englishSetBonus && 'English set'].filter(Boolean))];
  const sourceCardNumber = fields.cardNumber?.includes('/') && cardNumberMatches(source, fields.cardNumber)
    ? fields.cardNumber.trim()
    : `${source.cardNumber}${source.metadata?.cardCount && !String(source.cardNumber).includes('/') ? `/${source.metadata.cardCount}` : ''}`;
  return {...english, catalogCardId: english.id, sourceCard: source,
    sourceCardId: source.id, sourceCardNumber, sourceLanguage: source.language,
    sourceSetId: source.setId, matchScore: score, matchEvidence, autoSelect: false,
    counterpartScore: features.score, counterpartProof, sourceMatchScore: sourceMatch.score};
}

function candidateSetKey(card) {
  const source = card.sourceCard;
  return `${source.language}:${source.setId}:${source.cardNumber}:${source.id}:${source.name}`;
}

function rankCandidates(cards, fields, allowWeakCounterparts) {
  const sources = sourceCards(cards, fields);
  const englishCards = cards.filter(card => card.language === 'en');
  const ranked = [];
  for (const sourceMatch of sources) {
    const source = sourceMatch.card;
    const targets = source.language === 'en' ? [source]
      : englishCards.filter(english => englishNamesMatch(source, english, fields) && englishSetMatches(english, fields));
    for (const english of targets) {
      const candidate = candidateFromSource(sourceMatch, english, fields, targets.length);
      if (candidate && (allowWeakCounterparts || candidate.counterpartProof)) ranked.push(candidate);
    }
  }
  return ranked.sort((left, right) => right.matchScore - left.matchScore
    || left.name.localeCompare(right.name) || left.setName.localeCompare(right.setName));
}

function uniqueWinner(items, scoreField, minimumGap = 14) {
  if (items.length < 2) return items.length === 1;
  return items[0][scoreField] - items[1][scoreField] >= minimumGap;
}

function canAutoSelect(fields, candidate, ranked) {
  if (!confidentIdentity(fields) || !candidate.counterpartProof) return false;
  const sourceMap = new Map();
  ranked.forEach(card => {
    const key = candidateSetKey(card);
    if (!sourceMap.has(key) || sourceMap.get(key).sourceMatchScore < card.sourceMatchScore) sourceMap.set(key, card);
  });
  const sources = [...sourceMap.values()].sort((left, right) => right.sourceMatchScore - left.sourceMatchScore);
  const sourceUnique = uniqueWinner(sources, 'sourceMatchScore')
    && candidateSetKey(sources[0] || {}) === candidateSetKey(candidate);
  const sameSource = ranked.filter(card => candidateSetKey(card) === candidateSetKey(candidate))
    .sort((left, right) => right.counterpartScore - left.counterpartScore);
  const counterpartUnique = uniqueWinner(sameSource, 'counterpartScore');
  return sourceUnique && counterpartUnique && (candidate.counterpartScore >= 18 || candidate.sourceLanguage === 'en');
}

function credibleCandidates(ranked, limit) {
  if (!ranked.length) return [];
  const threshold = Math.max(25, ranked[0].matchScore - 24);
  return ranked.filter(candidate => candidate.matchScore >= threshold).slice(0, limit);
}

export function findImageCandidatesFromCatalog(cards, fields, limit = 8) {
  const ranked = rankCandidates(cards, fields, false);
  const credible = credibleCandidates(ranked, limit);
  if (!credible.length) return [];
  if (canAutoSelect(fields, credible[0], ranked)) return [{...credible[0], autoSelect: true}];
  return credible.map(card => ({...card, autoSelect: false}));
}

export function findImageReviewCandidatesFromCatalog(cards, fields, limit = 12) {
  return credibleCandidates(rankCandidates(cards, fields, true), limit)
    .map(card => ({...card, autoSelect: false}));
}
