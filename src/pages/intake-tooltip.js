import {tooltip} from '../components/tooltip.js';
import {messages} from '../utils/field-tooltip-messages.js';


export function intakeTooltip(id, label) {
  return tooltip({id: `intake-tooltip-${id}`, label: `Help with ${label}`, message: messages[id]});
}
