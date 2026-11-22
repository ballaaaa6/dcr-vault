import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prefetchNearbyImages} from './prefetch-images.js';

test('prefetches only nearby images with bounded concurrency and stops cleanly', () => {
  const original = {Image: globalThis.Image, IntersectionObserver: globalThis.IntersectionObserver, navigator: globalThis.navigator};
  let callback, disconnected = false;
  const started = [];
  class FakeImage { set src(value) { this.url = value; started.push(this); } }
  class FakeObserver {
    constructor(handler) { callback = handler; }
    observe() {} unobserve() {} disconnect() { disconnected = true; }
  }
  Object.defineProperty(globalThis, 'navigator', {value: {}, configurable: true});
  globalThis.Image = FakeImage;
  globalThis.IntersectionObserver = FakeObserver;
  try {
    const rows = Array.from({length: 20}, (_, index) => ({dataset: {prefetchImage: `/image-${index}`}}));
    const stop = prefetchNearbyImages({querySelectorAll: () => rows});
    callback(rows.map(target => ({target, isIntersecting: true})));
    assert.equal(started.length, 2);
    started[0].onload();
    assert.equal(started.length, 3);
    stop();
    started[1].onload();
    assert.equal(started.length, 3);
    assert.equal(disconnected, true);
  } finally {
    globalThis.Image = original.Image;
    globalThis.IntersectionObserver = original.IntersectionObserver;
    Object.defineProperty(globalThis, 'navigator', {value: original.navigator, configurable: true});
  }
});
