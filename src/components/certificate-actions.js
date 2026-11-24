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
  copy.querySelectorAll('.cert-actions, dialog, [hidden]').forEach(element => element.remove());
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

function initializeShareDialog(record) {
  const dialog = record.querySelector('.cert-share-dialog');
  const open = record.querySelector('[data-cert-share]');
  const url = new URL(`/cert/${encodeURIComponent(record.dataset.cert)}`, location.origin).href;
  const nativeShare = dialog.querySelector('[data-cert-native-share]');
  nativeShare.hidden = !navigator.share;
  open.addEventListener('click', () => dialog.showModal());
  dialog.querySelector('[data-cert-share-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => open.focus());
  dialog.querySelector('[data-cert-copy]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      dialog.close();
      showToast('Certificate link copied.', 'success');
    } catch { showToast('Unable to copy the link. Please try again.', 'error'); }
  });
  nativeShare.addEventListener('click', async () => {
    try {
      await navigator.share({title: record.querySelector('h2').textContent, url});
      dialog.close();
    } catch (error) {
      if (error.name !== 'AbortError') showToast('Unable to share the certificate. Please try again.', 'error');
    }
  });
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
  initializeShareDialog(record);
}
