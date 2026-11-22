import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, copyFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {imageVariant} from './image-variant.mjs';

test('creates bounded variants and rejects a stale digest without changing the original', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'dcr-image-test-'));
  process.env.DCR_IMAGE_PYTHON = process.env.DCR_TEST_PYTHON || 'python';
  try {
    const file = path.join(folder, 'front.webp');
    await copyFile('public/assets/vault-background/short/fairy.webp', file);
    const original = await readFile(file);
    const digest = createHash('sha256').update(original).digest('hex');
    const result = await imageVariant(file, 'front', digest, 'small');
    assert.ok(result);
    const size = execFileSync(process.env.DCR_IMAGE_PYTHON, ['-c', 'from PIL import Image; import sys; print(*Image.open(sys.argv[1]).size)', result], {encoding: 'utf8'}).trim();
    assert.equal(size, '240 120');
    assert.deepEqual(await readFile(file), original);
    assert.equal(await imageVariant(file, 'front', 'b'.repeat(64), 'medium'), null);
  } finally { await rm(folder, {recursive: true, force: true}); }
});
