import {escapeHTML} from './format.js';

export const classificationFields = [
  ['category', 'Category', 40], ['pokemonTypes', 'Pokémon type(s)', 120],
  ['trainerType', 'Trainer type', 60], ['energyKind', 'Energy kind', 40], ['energyType', 'Energy type', 40]
];

export function classificationFromReading(fields = {}) {
  const category = String(fields.category || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return {category: {pokemon: 'Pokemon', trainer: 'Trainer', energy: 'Energy'}[category] || fields.category || '', pokemonTypes: (fields.types || []).join(', '),
    trainerType: fields.trainerType || '', energyKind: fields.energyKind || '', energyType: fields.energyType || ''};
}

export function classificationLabel(card = {}) {
  const category = card.category || '';
  const detail = category.toLowerCase() === 'pokemon' ? card.pokemonTypes : category.toLowerCase() === 'trainer'
    ? card.trainerType : category.toLowerCase() === 'energy' ? [card.energyKind, card.energyType].filter(Boolean).join(' · ') : '';
  return [category, detail].filter(Boolean).join(' · ');
}

export function classificationInput(key, label, limit, value, prefix = '') {
  const common = `class="form-control" name="${key}" data-classification="${key}"`;
  if (key === 'category') {
    const choices = ['', 'Pokemon', 'Trainer', 'Energy'];
    if (value && !choices.includes(value)) choices.push(value);
    return `<label class="form-field"><span>${label}</span><select ${common}>${choices.map(option => `<option value="${escapeHTML(option)}"${option === (value || '') ? ' selected' : ''}>${escapeHTML(option || 'Not specified')}</option>`).join('')}</select></label>`;
  }
  const suggestions = {pokemonTypes: ['Grass', 'Fire', 'Water', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Fairy', 'Dragon', 'Colorless'],
    trainerType: ['Item', 'Supporter', 'Stadium', 'Pokemon Tool'], energyKind: ['Basic', 'Special'],
    energyType: ['Grass', 'Fire', 'Water', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Fairy']};
  const list = `classification-${key}`;
  if (suggestions[key]) return `<label class="form-field"><span>${label}</span><input ${common} maxlength="${limit}" value="${escapeHTML(value || '')}" list="${list}"><datalist id="${list}">${suggestions[key].map(option => `<option value="${option}"></option>`).join('')}</datalist></label>`;
  return `<label class="form-field"><span>${label}</span><input ${common} maxlength="${limit}" value="${escapeHTML(value || '')}" ${prefix ? `placeholder="${escapeHTML(prefix)}"` : ''}></label>`;
}
