document.addEventListener('click', event => {
  const button = event.target.closest('[data-view-image]');
  const dialog = document.getElementById('photo-viewer');
  if (button && dialog) {
    const image = document.querySelector(`[data-image-preview="${button.dataset.viewImage}"] img`);
    if (!image) return;
    const fullImage = dialog.querySelector('img');
    fullImage.src = image.src;
    fullImage.alt = image.alt;
    dialog.showModal();
  }
  if (event.target.closest('[data-close-photo-viewer]') || event.target === dialog) dialog?.close();
});
