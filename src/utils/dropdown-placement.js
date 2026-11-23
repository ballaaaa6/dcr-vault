export function dropdownPlacement(trigger, viewportTop, viewportHeight, menuHeight) {
  const above = Math.max(0, trigger.top - viewportTop - 13);
  const below = Math.max(0, viewportTop + viewportHeight - trigger.bottom - 13);
  const top = menuHeight > below && above > below;
  return {placement: top ? 'top' : 'bottom', availableHeight: top ? above : below};
}
