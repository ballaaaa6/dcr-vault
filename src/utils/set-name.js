export function displaySetName(value) {
  const name = String(value ?? '').trim();
  if (/^(?:25th\s+)?celebrations?(?:\s+classic collection)?$/i.test(name)) return '25th Celebration';
  if (/^30th\s+celebrations?$/i.test(name)) return '30th Celebration';
  return name;
}
