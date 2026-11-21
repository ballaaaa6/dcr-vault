import assert from 'node:assert/strict';
import {test} from 'node:test';
import {findExactCatalogCardFromCatalog, findImageCandidatesFromCatalog, findImageReviewCandidatesFromCatalog} from './card-identification-matching.js';

function metadata({nameAliases = [], hp = '60', illustrator = 'Mitsuhiro Arita', damage = '30'} = {}) {
  return {nameAliases, cardCount: '62', hp, illustrator, stage: 'Basic', types: ['Psychic'], attacks: [
    {names: ['Psywave'], damage, cost: ['Psychic']}], abilities: [], weaknesses: [], resistances: [], retreat: '1', evolvesFrom: []};
}

function localizedCard(overrides = {}) {
  return {id: 'sv10-005', language: 'ja', name: 'ミュウ', setName: 'サンプルセット', year: '2024',
    cardNumber: '005', rarity: 'Rare', seriesId: 'sv', setId: 'sv10', imageUrl: '/ja/sv10-005.webp',
    imageUrlFallback: 'https://assets.example/ja/sv10-005.webp', metadata: metadata({nameAliases: ['Mew']}), ...overrides};
}

function englishCard(overrides = {}) {
  return {id: 'sv10-005-en', language: 'en', name: 'Mew', setName: 'Sample Set', year: '2024', cardNumber: '5',
    rarity: 'Rare Holo', seriesId: 'sv', setId: 'sv10-en', imageUrl: '/en/sv10-005.webp',
    imageUrlFallback: 'https://assets.example/en/sv10-005.webp', metadata: metadata({nameAliases: ['Mew']}), ...overrides};
}

function reading(overrides = {}) {
  return {name: 'ミュウ', englishName: 'Mew', setName: 'サンプルセット', englishSetName: '', year: '2024',
    cardNumber: '005/062', language: 'ja', rarity: 'Rare', hp: '60', illustrator: 'Mitsuhiro Arita',
    stage: 'Basic', types: ['Psychic'], attacks: [{names: ['サイコウェーブ'], damage: '30', cost: ['Psychic']}],
    abilities: [], weaknesses: [], resistances: [], retreat: '1', evolvesFrom: '',
    fieldConfidence: {name: 0.98, englishName: 0.96, setName: 0.96, cardNumber: 0.98, language: 0.99,
      year: 0.9, rarity: 0.9, hp: 0.98, illustrator: 0.98, stage: 0.9, types: 0.9, attacks: 0.96,
      abilities: 0.9, weaknesses: 0.9, resistances: 0.9, retreat: 0.9, evolvesFrom: 0.9}, ...overrides};
}

test('auto-selects one metadata-confirmed Japanese print and keeps its image beside English label data', () => {
  const source = localizedCard();
  const correctEnglish = englishCard();
  const wrongEnglish = englishCard({id: 'xy12-53', setName: 'Evolutions', setId: 'xy12', cardNumber: '53',
    year: '2016', rarity: 'Rare', metadata: metadata({nameAliases: ['Mew'], hp: '70', illustrator: 'Kagemaru Himeno', damage: '90'})});
  const results = findImageCandidatesFromCatalog([source, correctEnglish, wrongEnglish], reading());

  assert.equal(results.length, 1);
  assert.equal(results[0].autoSelect, true);
  assert.equal(results[0].name, 'Mew');
  assert.equal(results[0].cardNumber, '5');
  assert.equal(results[0].rarity, 'Rare Holo');
  assert.equal(results[0].sourceCard.name, 'ミュウ');
  assert.equal(results[0].sourceCardNumber, '005/062');
  assert.equal(results[0].sourceCard.imageUrl, '/ja/sv10-005.webp');
  assert.equal(results[0].sourceLanguage, 'ja');
});

test('shows original-language print images when multiple English print mappings remain plausible', () => {
  const source = localizedCard();
  const first = englishCard();
  const second = englishCard({id: 'sv10-025-en', cardNumber: '25', rarity: 'Rare', imageUrl: '/en/sv10-025.webp'});
  const fields = reading({cardNumber: '', fieldConfidence: {...reading().fieldConfidence, cardNumber: 0,
    setName: 0.4, englishName: 0.4, year: 0.4}});
  const results = findImageReviewCandidatesFromCatalog([source, first, second], fields);

  assert.equal(results.length, 2);
  assert.ok(results.every(card => !card.autoSelect));
  assert.ok(results.every(card => card.sourceCard.language === 'ja'));
  assert.ok(results.every(card => card.sourceCard.imageUrl === '/ja/sv10-005.webp'));
  assert.deepEqual(new Set(results.map(card => card.name)), new Set(['Mew']));
});

test('does not trust a shared catalog ID when the localized and English card names disagree', () => {
  const source = localizedCard({id: 'neo4-104', setId: 'neo4', cardNumber: '104'});
  const unrelatedEnglish = englishCard({id: 'neo4-104', setId: 'neo4', cardNumber: '104', name: 'Heal Powder',
    metadata: metadata({nameAliases: ['Heal Powder']})});
  const results = findImageReviewCandidatesFromCatalog([source, unrelatedEnglish], reading());

  assert.equal(results.length, 0);
});

test('resolves a manually entered English card to one exact rarity record', () => {
  const first = englishCard();
  const second = englishCard({id: 'sv10-025-en', cardNumber: '25', rarity: 'Rare'});
  const selected = findExactCatalogCardFromCatalog([first, second],
    {name: 'Mew', setName: 'Sample Set', year: '2024', cardNumber: '005/062'});

  assert.equal(selected.id, first.id);
  assert.equal(selected.rarity, 'Rare Holo');
  assert.equal(findExactCatalogCardFromCatalog([first, second], {name: 'Mew', setName: 'Sample Set'}), null);
});
