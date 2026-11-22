export const CONDITION_OPTIONS = Object.freeze([
  'GEM MT', 'MINT', 'NM-MT+', 'NM-MT', 'NM+', 'NM', 'EX-MT+', 'EX-MT',
  'EX+', 'EX', 'VG-EX+', 'VG-EX', 'VG+', 'VG', 'GOOD+', 'GOOD', 'FR', 'PR'
]);

const CONDITION_GRADES = Object.freeze([
  '10', '9', '8.5', '8', '7.5', '7', '6.5', '6', '5.5', '5',
  '4.5', '4', '3.5', '3', '2.5', '2', '1.5', '1'
]);

export function conditionOptionLabel(value) {
  const index = CONDITION_OPTIONS.indexOf(value);
  return index < 0 ? value : `${value} (${CONDITION_GRADES[index]})`;
}
