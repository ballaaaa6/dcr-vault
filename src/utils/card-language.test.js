import {test} from 'node:test';
import assert from 'node:assert/strict';
import {languageName, labelLanguage} from './card-language.js';

test('uses new full language names directly and supports older codes on labels', () => {
  assert.equal(languageName('Japanese'), 'Japanese');
  assert.equal(labelLanguage('Japanese'), 'JAPANESE');
  assert.equal(labelLanguage('Chinese (Traditional)'), 'CHINESE (TRADITIONAL)');
  assert.equal(labelLanguage('ja'), 'JAPANESE');
  assert.equal(labelLanguage('zh-tw'), 'CHINESE (TRADITIONAL)');
  assert.equal(labelLanguage('ja', 'CUSTOM'), 'CUSTOM');
  assert.equal(labelLanguage('Japanese', 'STALE'), 'JAPANESE');
});
