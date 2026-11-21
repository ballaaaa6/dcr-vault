import {cardFeatures, cardNames, cardNumberMatches, compact, confidentField, hasSourceEvidence,
  confidentIdentity, hasValue, observedNameMatches, setNames, sourceConflicts, sourceSetMatches} from './card-identification-features.js';

function sourceScore(card, fields) {
  const features = cardFeatures(fields, card);
  const exactName = [fields.name, fields.englishName].some(name => name && compact(card.name) === compact(name));
  const numberMatch = fields.cardNumber && cardNumberMatches(card, fields.cardNumber);
  const setMatch = sourceSetMatches(card, fields);
  const yearMatch = fields.year && card.year === fields.year;
  const rarityMatch = fields.rarity && compact(card.rarity) === compact(fields.rarity);
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
      || !card.setName || setNames(card).has(compact(fields.englishSetName)))
    && !sourceConflicts(card, fields).length && hasSourceEvidence(card, fields))
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
  const sharedName = [...cardNames(source)].some(name => cardNames(english).has(name));
  const modelName = fields.englishName && cardNames(english).has(compact(fields.englishName));
  if (confidentField(fields, 'englishName') && !modelName) return false;
  return sharedName || modelName;
}

function englishSetMatches(english, fields) {
  return !confidentField(fields, 'englishSetName') || setNames(english).has(compact(fields.englishSetName));
}

function candidateFromSource(sourceMatch, english, fields, englishCount) {
  const source = sourceMatch.card;
  if (!englishSetMatches(english, fields) || sourceConflicts(english, fields).length) return null;
  const features = cardFeatures(fields, english);
  const sameSetAndNumber = source.setId === english.setId && cardNumberMatches(english, source.cardNumber);
  const exactSourceAnchor = sameSetAndNumber && [...cardNames(source)].some(name => cardNames(english).has(name));
  const counterpartProof = source.language === 'en' || features.corroborated || exactSourceAnchor
    || englishCount === 1 && sourceMatch.score >= 70;
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
    sourceSetId: source.setId, sourceFinish: fields.finish || '', matchScore: score, matchEvidence, autoSelect: false,
    counterpartScore: features.score, counterpartProof,
    sourceMatchScore: sourceMatch.score, sourceEvidence: sourceMatch.evidence};
}

function rankCandidates(cards, fields) {
  const sources = sourceCards(cards, fields);
  const englishCards = cards.filter(card => card.language === 'en');
  const ranked = [];
  for (const sourceMatch of sources) {
    const source = sourceMatch.card;
    const targets = source.language === 'en' ? [source]
      : englishCards.filter(english => englishNamesMatch(source, english, fields) && englishSetMatches(english, fields));
    for (const english of targets) {
      const candidate = candidateFromSource(sourceMatch, english, fields, targets.length);
      if (candidate) ranked.push(candidate);
    }
  }
  return ranked.sort((left, right) => right.matchScore - left.matchScore
    || left.name.localeCompare(right.name) || left.setName.localeCompare(right.setName));
}

function uniqueWinner(items, scoreField, minimumGap = 14) {
  if (items.length < 2) return items.length === 1;
  return items[0][scoreField] - items[1][scoreField] >= minimumGap;
}

function candidateSetKey(card) {
  const source = card.sourceCard;
  return `${source.language}:${source.setId}:${source.cardNumber}:${source.id}:${source.name}`;
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
  return sourceUnique && uniqueWinner(sameSource, 'counterpartScore')
    && candidate.counterpartScore >= 18;
}

function credibleCandidates(ranked, limit) {
  if (!ranked.length) return [];
  const topSourceScore = Math.max(...ranked.map(candidate => candidate.sourceMatchScore));
  return ranked.filter(candidate => candidate.sourceMatchScore >= topSourceScore - 16).slice(0, limit);
}

export function findImageCandidatesFromCatalog(cards, fields, limit = 8) {
  const ranked = rankCandidates(cards, fields);
  const credible = credibleCandidates(ranked.filter(candidate => candidate.counterpartProof), limit);
  if (!credible.length || !canAutoSelect(fields, credible[0], ranked)) return credible;
  return [{...credible[0], autoSelect: true}];
}

export function findImageReviewCandidatesFromCatalog(cards, fields, limit = 12) {
  return credibleCandidates(rankCandidates(cards, fields).filter(candidate => candidate.counterpartProof), limit)
    .map(card => ({...card, autoSelect: false}));
}
