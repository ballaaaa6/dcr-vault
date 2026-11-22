import assert from 'node:assert/strict';
import {test} from 'node:test';
import {classificationFromReading, classificationLabel} from './card-classification.js';
import {readingSummaryMarkup} from '../pages/card-identification-view.js';
import {itemInformation} from '../pages/verify.js';

test('classification preserves reading and appears before the card number', () => {
  const card = classificationFromReading({category: 'Pokémon', types: ['Psychic']});
  assert.equal(classificationLabel(card), 'Pokemon · Psychic');
  const review = readingSummaryMarkup({name: 'Gothita', cardNumber: '57/124'}, 'gemini', true, card);
  assert.ok(review.indexOf('Pokémon type(s)') < review.indexOf('Collector number'));
  const details = itemInformation({...card, cardNumber: '57/124'}, {showClassification: true});
  assert.ok(details.indexOf('Pokemon · Psychic') < details.indexOf('Card Number'));
  assert.equal(classificationLabel({category: 'Energy', energyKind: 'Basic', energyType: 'Grass'}), 'Energy · Basic · Grass');
  assert.equal(classificationLabel({}), '');
});
