export async function collectionsRequest(method = 'GET', body) {
  const response = await fetch('/api/collections', {credentials: 'same-origin', method,
    ...(body ? {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)} : {})});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Collections could not be updated.');
  return data;
}
