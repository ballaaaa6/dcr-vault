import {test} from 'node:test';
import assert from 'node:assert/strict';
import {availableCorners} from './card-corners.js';

test('available corner images follow the physical corner order and skip empty slots', () => {
  const result = availableCorners({cornerImages: {'back-bottom-right': '/br', 'back-top-right': '/tr'}});
  assert.deepEqual(result.map(item => item.side), ['back-top-right', 'back-bottom-right']);
  assert.deepEqual(availableCorners({}), []);
});
