// Tabler Icons, MIT license: docs/licenses/tabler-icons.txt.
export function cornerSwitchIcon() {
  return `<svg class="corner-switch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10h14l-4 -4"/><path d="M17 14h-14l4 4"/></svg>`;
}

export function animateCornerSwitch(button) {
  button.classList.remove('corner-switch-animate');
  void button.offsetWidth;
  button.classList.add('corner-switch-animate');
}
