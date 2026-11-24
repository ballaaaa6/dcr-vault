export async function locationsRequest(method = 'GET', body) {
  const response = await fetch('/api/storage-locations', {credentials: 'same-origin', method,
    ...(body ? {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)} : {})});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Locations could not be updated.');
  return data;
}
