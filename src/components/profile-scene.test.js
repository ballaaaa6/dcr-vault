import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeProfileScene, profilePetals} from './profile-scene.js';

test('profile scene sets both petal clip rectangles when the image loads', () => {
  const properties = {};
  const rects = [{}, {}].map(values => ({values, setAttribute: (key, value) => { values[key] = value; }}));
  const cards = [0, 1].map(top => ({style: {setProperty() {}}, getBoundingClientRect: () => ({left: 0, top: top * 120, width: 400, height: 100})}));
  const form = {isConnected: true, style: {setProperty: (key, value) => { properties[key] = value; }}, getBoundingClientRect: () => ({left: 0, top: 0, right: 400, bottom: 220, width: 400, height: 220}), querySelectorAll: selector => selector === '#profile-petal-clip rect' ? rects : cards};
  const oldImage = globalThis.Image;
  const oldObserver = globalThis.ResizeObserver;
  globalThis.Image = class { naturalWidth = 800; naturalHeight = 600; set src(value) { this.onload(); } };
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  try {
    initializeProfileScene(form);
    assert.match(profilePetals(), /id="profile-petal-clip"/);
    assert.deepEqual(rects.map(rect => rect.values.height), [100, 100]);
    assert.deepEqual(rects.map(rect => rect.values.y), [0, 120]);
    assert.equal(properties['--petal-distance'], '250px');
  } finally { globalThis.Image = oldImage; globalThis.ResizeObserver = oldObserver; }
});
