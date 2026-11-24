import {escapeHTML} from '../utils/format.js';
import {positionPopup} from './dropdown.js';

export function prepareNestedDropdown(mount, groups) {
  for (const button of mount.querySelectorAll('[data-dropdown-value]')) {
    if (!Object.hasOwn(groups, button.dataset.dropdownValue)) continue;
    button.setAttribute('aria-haspopup', 'true');
    button.setAttribute('aria-expanded', 'false');
    button.classList.add('dropdown-nested-trigger');
    button.insertAdjacentHTML('beforeend', '<span aria-hidden="true">›</span>');
  }
}

export function openNestedDropdown(mount, button, label, options, choose) {
  const wasOpen = button.getAttribute('aria-expanded') === 'true';
  mount.querySelector('[data-dropdown-nested]')?.remove();
  mount.querySelectorAll('.dropdown-nested-trigger').forEach(item => item.setAttribute('aria-expanded', 'false'));
  if (wasOpen) return;
  button.setAttribute('aria-expanded', 'true');
  const submenu = document.createElement('div');
  submenu.className = 'dropdown-nested';
  submenu.dataset.dropdownNested = '';
  submenu.setAttribute('role', 'menu');
  submenu.setAttribute('aria-label', label);
  submenu.innerHTML = options.map(([value, text]) =>
    `<button type="button" role="menuitem" data-dropdown-nested-value="${escapeHTML(value)}">${escapeHTML(text)}</button>`).join('');
  button.insertAdjacentElement('afterend', submenu);
  const control = mount.querySelector('.dropdown-control');
  positionPopup(control, control.querySelector('summary'), control.querySelector(':scope > .dropdown-menu'));
  submenu.addEventListener('click', event => {
    const item = event.target.closest('[data-dropdown-nested-value]');
    if (!item) return;
    event.stopPropagation();
    choose(item.dataset.dropdownNestedValue);
  });
  submenu.querySelector('button')?.focus();
}
