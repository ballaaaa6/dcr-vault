import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.document = {addEventListener() {}};
const {uncertainIntakeFields} = await import('./reading-highlights.js');

test('maps uncertain reading aliases to visible fields and ignores unrelated evidence', () => {
  assert.deepEqual(uncertainIntakeFields({uncertainFields: ['collector number', 'cardNumber', 'englishSetName', 'language', 'stamp', 'series']}),
    ['cardNumber', 'setName', 'language', 'series']);
  assert.deepEqual(uncertainIntakeFields({}), []);
});
