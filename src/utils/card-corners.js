export const CARD_CORNERS = [
  ['back-top-left', 'Back top left'],
  ['back-top-right', 'Back top right'],
  ['back-bottom-left', 'Back bottom left'],
  ['back-bottom-right', 'Back bottom right']
];

export function availableCorners(card) {
  return CARD_CORNERS.filter(([side]) => card.cornerImages?.[side])
    .map(([side, label]) => ({side, label, url: card.cornerImages[side]}));
}
