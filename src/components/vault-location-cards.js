import {escapeHTML as esc} from '../utils/format.js';
import {compareVaultCards, vaultSortSelect} from '../utils/vault-sort.js';
import {vaultImage} from './card-item.js';
import {heartCheckbox} from './heart-checkbox.js';

export function manageLocationCards(body, location, cards, save, back) {
  const original = new Set(cards.filter(card => card.storageLocationId === location.id).map(card => card.id));
  const selected = new Set(original);
  body.innerHTML = `<div class="location-picker-content"><p class="muted label-dialog-description">Select the cards to keep in ${esc(location.name)}. Selecting a card moves it from its current location.</p>
    <div class="label-vault-toolbar"><label class="label-select-all">${heartCheckbox('data-picker-all')} Select all</label>${vaultSortSelect('location-card-sort')}</div>
    <div class="label-vault-list" data-picker-list></div><p class="detail-note" role="alert" data-picker-error></p>
    <div class="location-picker-actions"><button type="button" class="btn btn-ghost" data-picker-back>Cancel</button><button type="button" class="btn btn-primary" data-picker-save>Save changes</button></div></div>`;
  const list = body.querySelector('[data-picker-list]');
  const all = body.querySelector('[data-picker-all]');
  function render() {
    const sorted = [...cards].sort((a, b) => compareVaultCards(a, b, body.querySelector('#location-card-sort').value));
    list.innerHTML = sorted.map(card => `<label>${heartCheckbox(`value="${esc(card.id)}" ${selected.has(card.id) ? 'checked' : ''}`)}<span><strong>${esc(card.name)}</strong><small>Cert ${esc(card.certNumber || '')}</small></span><span class="label-card-image">${vaultImage({...card, referenceImage: card.frontImage || card.referenceImage, frontImage: card.referenceImage}, 'label-image-empty', 'No photo')}</span></label>`).join('') || '<p>No cards in your vault.</p>';
    all.checked = cards.length > 0 && selected.size === cards.length;
    all.indeterminate = selected.size > 0 && selected.size < cards.length;
    all.disabled = !cards.length;
  }
  body.querySelector('#location-card-sort').onchange = render;
  all.onchange = () => { cards.forEach(card => all.checked ? selected.add(card.id) : selected.delete(card.id)); render(); };
  list.onchange = event => { const box = event.target; if (box.checked) selected.add(box.value); else selected.delete(box.value); render(); };
  body.querySelector('[data-picker-back]').onclick = back;
  body.querySelector('[data-picker-save]').onclick = async () => {
    body.querySelectorAll('button,input').forEach(el => { el.disabled = true; });
    try { await save([...selected].filter(id => !original.has(id)), [...original].filter(id => !selected.has(id))); back(); }
    catch (error) { body.querySelector('[data-picker-error]').textContent = error.message; body.querySelectorAll('button,input').forEach(el => { el.disabled = false; }); }
  };
  render();
}
