import {dropdown} from './dropdown.js';
import {classificationChoices} from '../utils/card-classification.js';

const groups = {pokemonTypes: 'Pokemon', trainerType: 'Trainer', energyKind: 'Energy', energyType: 'Energy'};

export function vaultClassificationInput(key, label, value = '') {
  const choices = ['', ...classificationChoices[key]];
  if (value && !choices.includes(value)) choices.push(value);
  return `<div class="form-field" data-vault-classification="${key}"><span>${label}</span>${dropdown({
    id: key, label, options: choices.map(option => [option, option || 'Not selected']), value: value || ''
  })}</div>`;
}

export function vaultEnergyInput(card) {
  const kinds = classificationChoices.energyKind;
  const types = classificationChoices.energyType;
  const values = ['', ...kinds.flatMap(kind => types.map(type => `${kind} · ${type}`))];
  const current = [card.energyKind, card.energyType].filter(Boolean).join(' · ');
  const legacy = Boolean(current && !values.includes(current));
  if (legacy) values.push(current);
  return `<div class="form-field" data-vault-energy><span>Energy</span>${dropdown({
    id: 'energyCombined', label: 'Energy', options: values.map(value => [value, value || 'Not selected']), value: current, hiddenValues: legacy ? [current] : []
  })}</div>`;
}

function setValue(form, key, value) {
  const row = key === 'energyCombined' ? form.querySelector('[data-vault-energy]') : form.querySelector(`[data-vault-classification="${key}"]`);
  const select = row.querySelector('select');
  const item = [...row.querySelectorAll('[data-dropdown-value]')].find(option => option.dataset.dropdownValue === value);
  if (!item) return;
  select.value = value;
  row.querySelectorAll('[data-dropdown-value]').forEach(option => option.setAttribute('aria-checked', String(option === item)));
  const summary = row.querySelector('summary');
  const text = item.querySelector('span').textContent;
  row.querySelector('[data-dropdown-current]').textContent = text;
  summary.dataset.empty = String(!value);
  summary.setAttribute('aria-label', `${summary.dataset.dropdownLabel}: ${text}`);
}

function updateControls(form) {
  const category = form.elements.category.value;
  for (const [key, group] of Object.entries(groups)) {
    const row = form.querySelector(`[data-vault-classification="${key}"]`);
    const hidden = group !== category || group === 'Energy';
    row.hidden = hidden;
    if (hidden) row.querySelector('.dropdown-control').open = false;
  }
  form.querySelector('[data-vault-energy]').hidden = category !== 'Energy';
}

export function initializeVaultClassification(form) {
  updateControls(form);
  form.addEventListener('change', event => {
    const key = event.target.id;
    if (key === 'energyCombined') {
      const parts = event.target.value.split(' · ').filter(Boolean);
      const kind = parts.find(part => classificationChoices.energyKind.includes(part)) || '';
      setValue(form, 'energyKind', kind);
      setValue(form, 'energyType', parts.find(part => part !== kind) || '');
      return;
    }
    if (key !== 'category' && !groups[key]) return;
    const value = event.target.value;
    const category = form.elements.category.value;
    if (key === 'category') {
      if (value !== 'Energy') setValue(form, 'energyCombined', '');
      for (const [field, group] of Object.entries(groups)) if (group !== value) setValue(form, field, '');
    } else if (value && !category) setValue(form, 'category', groups[key]);
    else if (!value && !Object.keys(groups).some(field => groups[field] === category && form.elements[field].value)) setValue(form, 'category', '');
    updateControls(form);
  });
}
