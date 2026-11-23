import test from 'node:test';
import assert from 'node:assert/strict';
import {readingConflict} from './intake-reading-guards.js';

test('keeps the chosen game and language safe when a reading conflicts', () => {
  assert.match(readingConflict({cardTypeLabel: 'Yu-Gi-Oh!'}, 'en', true), /card game/);
  assert.match(readingConflict({cardTypeLabel: 'Pokémon', language: 'ja'}, 'en', true), /language/);
  assert.equal(readingConflict({cardTypeLabel: 'Pokémon', language: 'ja'}, 'en', false), '');
  assert.equal(readingConflict({cardTypeLabel: '', language: ''}, 'en', true), '');
});
