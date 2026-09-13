function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function saveRemoteFile({
  url,
  suggestedName,
  fetchFn = globalThis.fetch,
  nativeSave
}) {
  const response = await fetchFn(url);
  if (!response?.ok) {
    throw new Error(`Unable to download file: HTTP ${response?.status ?? 'unknown'}`);
  }

  const buffer = await response.arrayBuffer();
  const mimeType = response.headers?.get?.('content-type')?.split(';')[0]?.trim() || 'application/octet-stream';
  return nativeSave.save({
    base64Data: arrayBufferToBase64(buffer),
    fileName: suggestedName || 'TifloAcosta-download',
    mimeType
  });
}

export { arrayBufferToBase64 };