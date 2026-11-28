import {test} from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet} from '../api/cards/[id]/images/[side].js';

const cardId = '12345678-1234-4234-8234-123456789abc';
const ownerId = '87654321-4321-4321-8321-cba987654321';
const digest = 'a'.repeat(64);
function database(image) {
  return {prepare(sql) { return {bind() { return {
    async first() { return sql.includes('FROM cards WHERE') ? {id: cardId, user_id: ownerId} : image; },
    async run() { return {success: true}; }
  }; }}; }};
}
function request(tag) {
  return new Request(`https://example.com/api/cards/${cardId}/images/front`, {headers: tag ? {'If-None-Match': tag} : {}});
}
const params = {id: cardId, side: 'front'};

test('cached image is revalidated against the current digest without fetching storage', async () => {
  const image = {object_key: 'key', content_type: 'image/jpeg', sha256: digest};
  const env = {DB: database(image)};
  for (const tag of [`"${digest}"`, `W/"${digest}"`, `"other", "${digest}"`]) {
    const response = await onRequestGet({request: request(tag), env, params});
    assert.equal(response.status, 304);
    assert.equal(response.headers.get('cache-control'), 'private, no-cache');
    assert.equal(response.headers.get('etag'), `"${digest}"`);
  }
});

test('deleted card images never return a cached success', async () => {
  const response = await onRequestGet({request: request(`"${digest}"`), env: {DB: database(null)}, params});
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('changed images do not return 304 for the previous digest', async () => {
  const env = {DB: database({object_key: 'key', content_type: 'image/jpeg', sha256: 'b'.repeat(64)})};
  const response = await onRequestGet({request: request(`"${digest}"`), env, params});
  assert.notEqual(response.status, 304);
});


test('variant validators are separate from the original and unknown variants are rejected', async () => {
  const env = {DB: database({object_key: 'key', content_type: 'image/jpeg', sha256: digest})};
  const url = `https://example.com/api/cards/${cardId}/images/front?variant=small`;
  const response = await onRequestGet({request: new Request(url, {headers: {'If-None-Match': `"${digest}-small-v1"`}}), env, params});
  assert.equal(response.status, 304);
  assert.equal(response.headers.get('etag'), `"${digest}-small-v1"`);
  const invalid = await onRequestGet({request: new Request(`${url}x`), env, params});
  assert.equal(invalid.status, 400);
});

test('corner images accept cache validators while unknown image sides are rejected', async () => {
  const env = {DB: database({object_key: 'key', content_type: 'image/jpeg', sha256: digest})};
  const response = await onRequestGet({request: request(`"${digest}"`), env, params: {id: cardId, side: 'back-top-left'}});
  assert.equal(response.status, 304);
  const invalid = await onRequestGet({request: request(), env, params: {id: cardId, side: 'back-center'}});
  assert.equal(invalid.status, 404);
});
