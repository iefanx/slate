import LZString from 'lz-string';

/**
 * Encodes a text block into a URL-safe, highly compressed string.
 * Uses lz-string's URI component compression, which avoids unsafe URL chars.
 */
export function compressTextForUrl(text: string): string {
  if (!text) return '';
  return LZString.compressToEncodedURIComponent(text);
}

/**
 * Decompresses a compressed URL-safe string back into plain text.
 * Returns null if the decompression fails.
 */
export function decompressTextFromUrl(compressed: string): string | null {
  if (!compressed) return null;
  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
    return decompressed || null;
  } catch (error) {
    console.error('Failed to decompress URL payload:', error);
    return null;
  }
}

/**
 * Generates a full sharable link for the app.
 * E.g., http://localhost:5173/#/share/CoCwxgDgZg9gTjAggYwCoGc4CcIA0...
 */
export function generateShareUrl(content: string): string {
  const compressed = compressTextForUrl(content);
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}#/share/${compressed}`;
}
