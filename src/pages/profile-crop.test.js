import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initializeCrop} from '../components/profile-crop.js';

test('photo selection clamps drag and zoom while retaining the full image', async () => {
  const image = {style: {}};
  const area = {hidden: true, clientWidth: 320, querySelector: () => image, setPointerCapture() {}};
  const zoom = {value: '1'}, saveButton = {}, status = {};
  const dialog = {
    querySelector: selector => ({'.profile-crop-area': area, '#profile-photo-zoom': zoom, '[data-crop-save]': saveButton, '.profile-crop-status': status})[selector],
    querySelectorAll: () => [], showModal() {}, close() {}
  };
  const file = {files: [{type: 'image/png', size: 100}]}, canvases = [];
  let saved;
  const previous = {document: globalThis.document, createImageBitmap: globalThis.createImageBitmap, createObjectURL: URL.createObjectURL};
  globalThis.document = {
    querySelector: selector => ({'.profile-crop-dialog[aria-labelledby="crop-title"]': dialog, '#crop-file': file})[selector],
    createElement: () => { const canvas = {getContext: () => ({fillRect() {}, drawImage: (...args) => { canvas.drawn = args; }}), toDataURL: () => `photo${canvases.length}`}; canvases.push(canvas); return canvas; }
  };
  globalThis.createImageBitmap = async () => ({width: 640, height: 480, close() {}});
  URL.createObjectURL = () => 'blob:test';
  try {
    initializeCrop(async value => { saved = value; }, {});
    await file.onchange();
    assert.equal(image.style.transform, 'translate(-53.333333333333314px, 0px)');
    zoom.value = '2'; zoom.oninput();
    area.onpointerdown({clientX: 0, clientY: 0, pointerId: 1});
    area.onpointermove({clientX: 9999, clientY: 9999});
    assert.equal(image.style.transform, 'translate(0px, 0px)');
    zoom.value = '0.5'; zoom.oninput();
    assert.equal(image.style.height, '320px');
    await saveButton.onclick();
    assert.deepEqual(canvases.map(canvas => [canvas.width, canvas.height]), [[256, 256], [512, 384]]);
    assert.deepEqual(canvases[1].drawn.slice(1), [0, 0, 512, 384]);
    assert.deepEqual(saved, {avatarUrl: 'photo1', avatarFullUrl: 'photo2'});
  } finally {
    globalThis.document = previous.document; globalThis.createImageBitmap = previous.createImageBitmap; URL.createObjectURL = previous.createObjectURL;
  }
});
