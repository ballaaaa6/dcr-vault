import {showToast} from './toast.js';

async function prepareImages(container) {
  const urls = [];
  try {
    for (const image of container.querySelectorAll('img')) {
      const response = await fetch(image.src, {referrerPolicy: 'no-referrer'});
      if (!response.ok) throw new Error('Image unavailable');
      const url = URL.createObjectURL(await response.blob());
      urls.push(url);
      image.src = url;
      await image.decode();
    }
    return urls;
  } catch (error) {
    urls.forEach(url => URL.revokeObjectURL(url));
    throw error;
  }
}

async function saveCertificate(record) {
  const container = document.createElement('div');
  container.className = 'cert-export';
  const background = document.querySelector('.lookup-background')?.cloneNode();
  if (background) { background.className = 'cert-export-background'; container.append(background); }
  const copy = record.cloneNode(true);
  copy.querySelectorAll('.cert-actions, .cert-sharing-note, dialog, [hidden]').forEach(element => element.remove());
  container.append(copy);
  document.body.append(container);
  let urls = [];
  try {
    urls = await prepareImages(container);
    await document.fonts.ready;
    const {default: html2canvas} = await import('html2canvas');
    const canvas = await html2canvas(container, {scale: 2, backgroundColor: null});
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Image export failed');
    const download = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = download;
    link.download = `DCR-Certificate-${record.dataset.cert}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(download), 10000);
  } finally {
    urls.forEach(url => URL.revokeObjectURL(url));
    container.remove();
  }
}

async function shareCertificate(record) {
  const url = new URL(`/cert/${encodeURIComponent(record.dataset.cert)}`, location.origin).href;
  if (navigator.share) {
    await navigator.share({title: record.querySelector('h2').textContent, url});
    return;
  }
  await navigator.clipboard.writeText(url);
  showToast('Certificate link copied.', 'success');
}

export function initializeCertificateActions() {
  const record = document.querySelector('.cert-record');
  if (!record) return;
  record.querySelector('[data-cert-save]').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try { await saveCertificate(record); showToast('Card summary saved.', 'success'); }
    catch { showToast('Unable to save the card summary. Please try again.', 'error'); }
    finally { button.disabled = false; }
  });
  record.querySelector('[data-cert-share]').addEventListener('click', async () => {
    try { await shareCertificate(record); }
    catch (error) { if (error.name !== 'AbortError') showToast('Unable to share the certificate. Please try again.', 'error'); }
  });
}
