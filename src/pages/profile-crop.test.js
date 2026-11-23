import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initializeCrop} from '../components/profile-crop.js';

test('profile photo preview saves the entire image at its original aspect ratio', async () => {
  const image = {};
  const area = {hidden: true, querySelector: () => image};
  const saveButton = {};
  const cropStatus = {};
  const cropDialog = {
    querySelector: selector => ({'.profile-crop-area': area, '[data-crop-save]': saveButton, '.profile-crop-status': cropStatus})[selector],
    querySelectorAll: () => [],
    showModal() { this.open = true; },
    close() { this.open = false; }
  };
  const file = {files: [{type: 'image/png', size: 100}]};
  let drawn, saved;
  const canvas = {getContext: () => ({fillRect() {}, drawImage: (...args) => { drawn = args; }}), toDataURL: () => 'data:image/jpeg;base64,test'};
  const previous = {document: globalThis.document, createImageBitmap: globalThis.createImageBitmap, createObjectURL: URL.createObjectURL};
  globalThis.document = {querySelector: selector => ({'.profile-crop-dialog[aria-labelledby="crop-title"]': cropDialog, '#crop-file': file})[selector], createElement: () => canvas};
  globalThis.createImageBitmap = async () => ({width: 640, height: 480, close() {}});
  URL.createObjectURL = () => 'blob:test';
  try {
    initializeCrop(async value => { saved = value; }, {});
    await file.onchange();
    assert.equal(cropDialog.open, true);
    assert.equal(area.hidden, false);
    await saveButton.onclick();
    assert.deepEqual([canvas.width, canvas.height], [256, 192]);
    assert.deepEqual(drawn.slice(1), [0, 0, 256, 192]);
    assert.equal(saved.avatarUrl, 'data:image/jpeg;base64,test');
  } finally {
    globalThis.document = previous.document;
    globalThis.createImageBitmap = previous.createImageBitmap;
    URL.createObjectURL = previous.createObjectURL;
  }
});
