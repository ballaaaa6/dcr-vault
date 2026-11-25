import {createReadStream} from 'node:fs';
import {mkdir, open, readdir, rename, stat, unlink} from 'node:fs/promises';
import {imageVariant} from './image-variant.mjs';
import {createServer} from 'node:http';
import {createHash, randomUUID} from 'node:crypto';
import path from 'node:path';

const ROOT = path.resolve(process.env.DCR_IMAGE_ROOT || '/srv/dcr-vault-media');
const AUTHORIZATION_URL = process.env.DCR_AUTHORIZATION_URL || 'https://dcrcards.pages.dev/api/media/authorize';
const HOST = process.env.DCR_BIND_HOST || '127.0.0.1';
const PORT = Number(process.env.DCR_PORT || 8788);
const MAX_BYTES = 10 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function sendJson(response, status, value) {
  response.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
  response.end(JSON.stringify(value));
}

function validateRequest(request) {
  const url = new URL(request.url, 'http://127.0.0.1');
  const match = url.pathname.match(/^\/v1\/cards\/([^/]+)\/(front|back)$/);
  if (!match || !UUID.test(match[1])) throw new HttpError(404, 'Image route not found.');
  const operation = request.method === 'PUT' ? 'put' : request.method === 'GET' ? 'get' : request.method === 'DELETE' ? 'delete' : '';
  if (!operation) throw new HttpError(405, 'Method not allowed.');
  const variant = url.searchParams.get('variant') || '';
  const digest = url.searchParams.get('digest') || '';
  if (variant && (operation !== 'get' || !['small', 'medium'].includes(variant) || !/^[0-9a-f]{64}$/.test(digest))) throw new HttpError(400, 'Invalid image variant.');
  return {cardId: match[1], side: match[2], operation, variant, digest};
}

async function authorize(request, target, contentType) {
  const token = request.headers['x-dcr-capability'];
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new HttpError(403, 'Image capability rejected.');
  const response = await fetch(AUTHORIZATION_URL, {
    method: 'POST', headers: {'Content-Type': 'application/json'}, redirect: 'error',
    body: JSON.stringify({cardId: target.cardId, side: target.side, operation: target.operation, token, contentType}), signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new HttpError(403, 'Image capability expired or was already used.');
  const grant = await response.json();
  if (grant.cardId !== target.cardId || grant.side !== target.side || grant.operation !== target.operation
      || grant.contentType !== contentType || !UUID.test(grant.ownerId || '')) throw new HttpError(403, 'Image capability scope mismatch.');
  return grant;
}

function imagePath(grant, extension) {
  const objectKey = grant.objectKey || `${grant.ownerId}/${grant.cardId}/${grant.side}.${extension}`;
  const match = objectKey.match(/^([0-9a-f-]{36})\/([0-9a-f-]{36})\/(front|back)\.(jpg|png|webp)$/i);
  if (!match || match[1] !== grant.ownerId || match[2] !== grant.cardId || match[3] !== grant.side) throw new HttpError(403, 'Invalid image path.');
  const target = path.resolve(ROOT, match[1], match[2], `${match[3]}.${match[4]}`);
  if (!target.startsWith(`${ROOT}${path.sep}`)) throw new HttpError(403, 'Invalid image path.');
  if (grant.operation !== 'put' && match[4] !== TYPES[grant.contentType]) throw new HttpError(403, 'Image type mismatch.');
  return {target, objectKey: `${match[1]}/${match[2]}/${match[3]}.${match[4]}`};
}

async function readBody(request) {
  const length = Number(request.headers['content-length'] || 0);
  if (length > MAX_BYTES) throw new HttpError(413, 'Each photo must be 10 MB or smaller.');
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_BYTES) { request.resume(); throw new HttpError(413, 'Each photo must be 10 MB or smaller.'); }
    chunks.push(chunk);
  }
  if (!total) throw new HttpError(400, 'Choose an image to upload.');
  return Buffer.concat(chunks, total);
}

function validImage(body, contentType) {
  if (contentType === 'image/jpeg') return body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
  if (contentType === 'image/png') return body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return contentType === 'image/webp' && body.toString('ascii', 0, 4) === 'RIFF' && body.toString('ascii', 8, 12) === 'WEBP';
}

async function replaceImage(request, response, target, contentType, grant) {
  const body = await readBody(request);
  if (!validImage(body, contentType)) throw new HttpError(415, 'The file contents do not match the selected image type.');
  const {target: file, objectKey} = imagePath(grant, TYPES[contentType]);
  const directory = path.dirname(file);
  await mkdir(directory, {recursive: true, mode: 0o700});
  const temporary = path.join(directory, `.${target.side}.${randomUUID()}.tmp`);
  const handle = await open(temporary, 'wx', 0o600);
  try { await handle.writeFile(body); } finally { await handle.close(); }
  await rename(temporary, file);
  await clearVariants(file, target.side);
  const sha256 = createHash('sha256').update(body).digest('hex');
  sendJson(response, 200, {objectKey, contentType, byteSize: body.length, sha256});
}

async function clearVariants(file, side) {
  const folder = path.join(path.dirname(file), '.variants');
  const files = await readdir(folder).catch(() => []);
  await Promise.all(files.filter(name => name.startsWith(`${side}-`)).map(name => unlink(path.join(folder, name)).catch(() => {})));
}

async function serveImage(response, grant, requestTarget) {
  const {target, objectKey} = imagePath(grant, TYPES[grant.contentType]);
  const info = await stat(target).catch(() => null);
  if (!info?.isFile() || info.size > MAX_BYTES) throw new HttpError(404, 'Card photo not found.');
  let variant = requestTarget.variant && await imageVariant(target, grant.side, requestTarget.digest, requestTarget.variant);
  const variantInfo = variant ? await stat(variant).catch(() => null) : null;
  if (!variantInfo?.isFile()) variant = null;
  const served = variant || target;
  const size = variant ? variantInfo.size : info.size;
  response.writeHead(200, {'Content-Type': variant ? 'image/webp' : grant.contentType, 'Content-Length': size,
    'Cache-Control': 'private, no-store', 'X-DCR-Variant': variant ? requestTarget.variant : 'original', 'Content-Disposition': `inline; filename="${grant.side}"`, 'X-Content-Type-Options': 'nosniff'});
  createReadStream(served).pipe(response);
}

async function deleteImage(response, grant) {
  const {target} = imagePath(grant, TYPES[grant.contentType]);
  await unlink(target).catch(error => { if (error.code !== 'ENOENT') throw error; });
  await clearVariants(target, grant.side);
  sendJson(response, 200, {ok: true});
}

async function handle(request, response) {
  if (request.method === 'GET' && request.url === '/health') return sendJson(response, 200, {ok: true});
  const target = validateRequest(request);
  const contentType = String(request.headers['x-dcr-type'] || '').toLowerCase();
  if (!TYPES[contentType]) throw new HttpError(415, 'Unsupported image type.');
  const grant = await authorize(request, target, contentType);
  if (target.operation === 'put') return replaceImage(request, response, target, contentType, grant);
  if (target.operation === 'get') return serveImage(response, grant, target);
  return deleteImage(response, grant);
}

const server = createServer((request, response) => {
  handle(request, response).catch(error => {
    if (!response.headersSent) sendJson(response, error.status || 500, {error: error.status ? error.message : 'Image storage request failed.'});
    else response.destroy();
    if (!error.status) console.error('Image storage request failed.');
  });
});

server.requestTimeout = 30000;
server.headersTimeout = 10000;
server.keepAliveTimeout = 5000;
server.listen(PORT, HOST, () => console.log(`DCR image store listening on ${HOST}:${PORT}`));
