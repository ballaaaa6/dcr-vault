import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initializeCrop} from '../components/profile-crop.js';

test('choosing a profile photo opens the crop editor', async () => {
  const image = {style: {}};
  const area = {hidden: true, clientWidth: 320, querySelector: () => image};
  const saveButton = {};
  const cropStatus = {};
  const cropDialog = {
    querySelector: selector => ({'.profile-crop-area': area, '[data-crop-save]': saveButton, '.profile-crop-status': cropStatus})[selector],
    querySelectorAll: () => [],
    showModal() { this.open = true; }
  };
  const file = {files: [{type: 'image/png', size: 100}]};
  const previous = {document: globalThis.document, createImageBitmap: globalThis.createImageBitmap, createObjectURL: URL.createObjectURL};
  globalThis.document = {querySelector: selector => ({'.profile-crop-dialog[aria-labelledby="crop-title"]': cropDialog, '#crop-file': file})[selector]};
  globalThis.createImageBitmap = async () => ({width: 640, height: 480, close() {}});
  URL.createObjectURL = () => 'blob:test';
  try {
    initializeCrop(() => {}, {});
    await file.onchange();
    assert.equal(cropDialog.open, true);
    assert.equal(area.hidden, false);
    assert.equal(saveButton.disabled, false);
    assert.ok(parseFloat(image.style.width) > area.clientWidth);
  } finally {
    globalThis.document = previous.document;
    globalThis.createImageBitmap = previous.createImageBitmap;
    URL.createObjectURL = previous.createObjectURL;
  }
});

