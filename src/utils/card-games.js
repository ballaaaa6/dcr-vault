import {gameNames} from './card-game-names.js';

export const CARD_GAMES = gameNames.map(game => game.name);
const key = value => value.toLowerCase().replaceAll('ß', 'ss').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const shortKey = value => key(value).replace(/\s+(trading card game|collectible card game|card game|tcg|ccg)$/, '');
const withoutGameSuffix = value => value.replace(/\s+(?:trading card game|collectible card game|card game|tcg|ccg)\s*$/i, '').trim() || value;

export function normalizeGameName(value) {
  const original = typeof value === 'string' ? value.trim().slice(0, 120) : '';
  if (!original) return '';
  const cleaned = withoutGameSuffix(original);
  const exact = key(original);
  if (!exact) return cleaned;
  const match = gameNames.filter(game => game.matching !== 'review' &&
    [game.name, ...game.aliases].some(name => key(name) === exact));
  if (match.length === 1) return match[0].name;
  if (match.length) return cleaned;
  const normalized = shortKey(original);
  const candidates = gameNames.filter(game => shortKey(game.name) === normalized);
  return candidates.length === 1 && candidates[0].matching !== 'review' ? candidates[0].name : cleaned;
}
