import {execFile} from 'node:child_process';
import {mkdir, stat} from 'node:fs/promises';
import {promisify} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const run = promisify(execFile);
const dimensions = {small: 240, medium: 1000};
const pending = new Map();
let active = 0;

export async function imageVariant(file, side, digest, variant) {
  if (!dimensions[variant] || !/^[0-9a-f]{64}$/.test(digest)) return null;
  const folder = path.join(path.dirname(file), '.variants');
  const target = path.join(folder, `${side}-${digest}-${variant}.webp`);
  if (await stat(target).then(info => info.isFile()).catch(() => false)) return target;
  if (pending.has(target)) return pending.get(target);
  if (active >= 2) return null;
  active++;
  const work = generate(file, target, digest, dimensions[variant], folder);
  pending.set(target, work);
  try { return await work; } finally { pending.delete(target); active--; }
}

async function generate(file, target, digest, size, folder) {
  try {
    await mkdir(folder, {recursive: true, mode: 0o700});
    const python = process.env.DCR_IMAGE_PYTHON || '/opt/dcr-vault-image-store/.venv/bin/python';
    const script = fileURLToPath(new URL('./image-variant.py', import.meta.url));
    await run(python, [script, file, target, digest, String(size)], {timeout: 20000, maxBuffer: 4096});
    return target;
  } catch { return null; }
}
