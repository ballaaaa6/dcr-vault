import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cardImageVariant} from './card-image-variant.js';

test('requests bounded variants only for saved card images', () => {
  assert.equal(cardImageVariant('/api/cards/1234-abcd/images/front', 'small'), '/api/cards/1234-abcd/images/front?variant=small');
  assert.equal(cardImageVariant('/api/cards/1234-abcd/images/back?v=1', 'medium'), '/api/cards/1234-abcd/images/back?v=1&variant=medium');
  assert.equal(cardImageVariant('/api/cards/1234-abcd/images/back-top-left', 'small'), '/api/cards/1234-abcd/images/back-top-left?variant=small');
  assert.equal(cardImageVariant('https://example.com/card.webp', 'small'), 'https://example.com/card.webp');
  assert.equal(cardImageVariant('/api/cards/1234-abcd/images/front', 'original'), '/api/cards/1234-abcd/images/front');
});
