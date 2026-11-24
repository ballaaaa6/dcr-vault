import {tooltip} from './tooltip.js';
import {messages} from '../utils/field-tooltip-messages.js';

const vaultMessages = {
  cardTypeLabel: 'Enter the type printed on the card.',
  category: 'Select the card category.',
  pokemonTypes: 'Select the Pokémon type on the card.',
  trainerType: 'Select the Trainer type on the card.',
  energy: 'Select the Energy kind and type.',
  energyKind: 'Select the Energy kind.',
  energyType: 'Select the Energy type.',
  sourceFinish: 'Select the card’s finish or foil pattern.',
  buyPrice: 'Enter the price paid and currency.',
  purchaseSource: 'Select where you acquired the card.',
  customSource: 'Enter where you acquired the card.',
  seller: 'Enter the seller’s name.',
  receivedDate: 'Select the date you received the card.',
  storageLocation: 'Select where the card is stored.',
  collections: 'Select the showcases for this card.',
  position: 'Enter the card’s position within its storage location.',
  notes: 'Add any private notes about the card.'
};
const aliases = {certNumber: 'cert', gradeLabel: 'grade', game: 'game'};

export function vaultTooltip(key, label) {
  return tooltip({id: `vault-tooltip-${key}`, label: `Help with ${label}`,
    message: vaultMessages[key] || messages[aliases[key] || key]});
}
