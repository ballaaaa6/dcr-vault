import {dropdown} from './dropdown.js';
import {escapeHTML} from '../utils/format.js';

const patterns = {
  Holofoil: ['Standard', 'Starlight', 'Cosmos', 'Tinsel', 'Sheen', 'Water Web', 'Vertical Lines', 'Mirage', 'Cracked Ice'],
  'Reverse Holofoil': ['Standard', 'Poké Ball', 'Great Ball', 'Ultra Ball', 'Master Ball', 'Friend Ball', 'Love Ball', 'Dusk Ball', 'Quick Ball', 'Energy Symbol', 'Team Rocket', 'Fireworks', 'Cosmos'],
  'Other Foil': ['Textured Foil']
};
const choices = ['', 'Normal', ...Object.keys(patterns), 'Unknown', 'Other'];
const label = value => value || 'Not selected';

export function vaultFinishInput(value = '') {
  return `<div class="form-field" data-vault-finish><span>Finish</span><input type="hidden" name="sourceFinish" value="${escapeHTML(value)}"><div data-finish-control></div></div>`;
}

export function initializeVaultFinish(form) {
  const row = form.querySelector('[data-vault-finish]');
  const saved = row.querySelector('[name="sourceFinish"]');
  const mount = row.querySelector('[data-finish-control]');
  let category = '';
  function render(stage, current = '') {
    const options = stage === 'category' ? choices : ['', 'Back', ...patterns[category], 'Unknown', 'Other'];
    if (current && !options.includes(current)) options.splice(1, 0, current);
    mount.innerHTML = dropdown({id: 'vault-finish-choice', label: stage === 'category' ? 'Finish' : `${category} pattern`,
      options: options.map(value => [value, stage === 'pattern' && !value ? `${category}: Select pattern` : label(value)]), value: current || options[0]});
    mount.querySelector('select').dataset.stage = stage;
  }
  function save(value) {
    saved.value = value;
    saved.dispatchEvent(new Event('change', {bubbles: true}));
  }
  function custom() {
    const prefix = category ? `${category} — ` : '';
    mount.innerHTML = `<div class="vault-finish-custom"><button type="button" data-finish-back aria-label="Back to finish choices">←</button><input class="form-control" aria-label="Other finish" placeholder="Enter finish" maxlength="${80 - prefix.length}"></div>`;
    const input = mount.querySelector('input');
    input.addEventListener('input', () => save(input.value.trim() ? prefix + input.value.trim() : ''));
    input.focus();
  }
  mount.addEventListener('change', event => {
    if (event.target.dataset.stage === 'category') {
      category = patterns[event.target.value] ? event.target.value : '';
      if (category) { save(category); render('pattern'); }
      else if (event.target.value === 'Other') { save(''); custom(); }
      else save(event.target.value === 'Unknown' ? '' : event.target.value);
    } else {
      const value = event.target.value;
      if (!value) return;
      if (value === 'Back') { category = ''; render('category'); }
      else if (value === 'Other') { save(''); custom(); }
      else { save(value === 'Standard' ? category : `${category} — ${value}`); render('pattern', value); }
    }
  });
  mount.addEventListener('click', event => {
    if (event.target.closest('[data-finish-back]')) render(category ? 'pattern' : 'category');
  });
  const existingCategory = Object.keys(patterns).find(key => saved.value === key || saved.value.startsWith(`${key} — `));
  if (existingCategory) { category = existingCategory; render('pattern', saved.value.slice(category.length + 3) || 'Standard'); }
  else render('category', saved.value);
}
