import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeImageLoading} from '../components/image-loading.js';

test('keeps the placeholder until decoding finishes and ignores an outdated decode', async () => {
  const handlers = {};
  const classes = new Set();
  let resolveDecode;
  const image = {
    nodeType: 1, complete: false, naturalWidth: 0, src: '/first', currentSrc: '/first',
    getAttribute: name => name === 'src' ? image.src : '',
    matches: selector => selector === 'img', querySelectorAll: () => [],
    classList: {add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value)},
    decode: () => new Promise(resolve => { resolveDecode = resolve; })
  };
  let observer;
  const previous = globalThis.MutationObserver;
  globalThis.MutationObserver = class {
    constructor(callback) { observer = callback; }
    observe() {}
    disconnect() {}
  };
  const root = {documentElement: {}, addEventListener: (type, handler) => { handlers[type] = handler; }, querySelectorAll: () => [image]};
  try {
    initializeImageLoading(root);
    assert.equal(classes.has('image-loading'), true);
    image.complete = true; image.naturalWidth = 100;
    handlers.load({target: image});
    assert.equal(classes.has('image-loading'), true);
    image.src = image.currentSrc = '/second'; image.complete = false;
    observer([{type: 'attributes', target: image}]);
    resolveDecode();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(classes.has('image-loading'), true);
    image.complete = true;
    handlers.load({target: image});
    resolveDecode();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(classes.has('image-loading'), false);
  } finally { globalThis.MutationObserver = previous; }
});
