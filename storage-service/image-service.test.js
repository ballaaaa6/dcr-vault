import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
import path from 'node:path';

const cardId = '12345678-1234-4234-8234-123456789abc';
const ownerId = '87654321-4321-4321-8321-cba987654321';

async function unusedPort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function waitForService(port, child) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (child.exitCode !== null) throw new Error('Image service exited before starting');
    try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Image service did not start');
}

test('image service creates variants, retains originals and removes derivatives on delete', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'dcr-service-test-'));
  const port = await unusedPort();
  const auth = createServer(async (req, res) => {
    let body = ''; for await (const part of req) body += part;
    const grant = JSON.parse(body);
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({...grant, ownerId, objectKey: `${ownerId}/${cardId}/${grant.side}.webp`}));
  });
  auth.listen(0, '127.0.0.1'); await once(auth, 'listening');
  const env = {...process.env, DCR_IMAGE_ROOT: root, DCR_PORT: String(port), DCR_AUTHORIZATION_URL: `http://127.0.0.1:${auth.address().port}`, DCR_IMAGE_PYTHON: process.env.DCR_TEST_PYTHON || 'python'};
  const child = spawn(process.execPath, ['storage-service/server.mjs'], {env, stdio: 'ignore'});
  const headers = {'X-DCR-Capability': 'a'.repeat(43), 'X-DCR-Type': 'image/webp'};
  const url = `http://127.0.0.1:${port}/v1/cards/${cardId}/front`;
  try {
    await waitForService(port, child);
    const original = await readFile('public/assets/vault-background/short/fairy.webp');
    const cornerUrl = `http://127.0.0.1:${port}/v1/cards/${cardId}/back-top-left`;
    const cornerPut = await fetch(cornerUrl, {method: 'PUT', headers, body: original});
    assert.equal(cornerPut.status, 200);
    const cornerDigest = (await cornerPut.json()).sha256;
    assert.equal((await fetch(`${cornerUrl}?variant=small&digest=${cornerDigest}`, {headers})).headers.get('x-dcr-variant'), 'small');
    const backUrl = `http://127.0.0.1:${port}/v1/cards/${cardId}/back`;
    assert.equal((await fetch(backUrl, {method: 'PUT', headers, body: original})).status, 200);
    assert.equal((await fetch(backUrl, {method: 'DELETE', headers})).status, 200);
    const variants = await import('node:fs/promises').then(fs => fs.readdir(path.join(root, ownerId, cardId, '.variants')));
    assert.ok(variants.some(name => name.startsWith('back-top-left-')));
    assert.deepEqual(Buffer.from(await (await fetch(cornerUrl, {headers})).arrayBuffer()), original);
    assert.equal((await fetch(cornerUrl, {method: 'DELETE', headers})).status, 200);
    assert.equal((await fetch(cornerUrl, {headers})).status, 404);
    const put = await fetch(url, {method: 'PUT', headers, body: original});
    assert.equal(put.status, 200);
    const {sha256} = await put.json();
    const resized = await fetch(`${url}?variant=small&digest=${sha256}`, {headers});
    assert.equal(resized.status, 200);
    assert.equal(resized.headers.get('x-dcr-variant'), 'small');
    assert.ok((await resized.arrayBuffer()).byteLength < original.length);
    const full = await fetch(url, {headers});
    assert.deepEqual(Buffer.from(await full.arrayBuffer()), original);
    assert.equal((await fetch(url, {method: 'DELETE', headers})).status, 200);
    assert.equal((await fetch(url, {headers})).status, 404);
  } finally {
    child.kill(); await once(child, 'exit').catch(() => {});
    await new Promise(resolve => auth.close(resolve));
    await rm(root, {recursive: true, force: true});
  }
});
