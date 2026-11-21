import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('card identification module has valid JavaScript syntax', () => {
  const path = fileURLToPath(new URL('./card-identification.js', import.meta.url));
  const result = spawnSync(process.execPath, ['--check', path], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
});
