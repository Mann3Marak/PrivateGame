import { SpinnerEntry } from './types';

const IMAGE_EXTENSION_REGEX = /\.(png|jpe?g|webp|gif)(\?.*)?$/i;

export function isHttpsImageUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return url.protocol === 'https:' && IMAGE_EXTENSION_REGEX.test(url.pathname + url.search);
  } catch {
    return false;
  }
}

export function normalizeImageRef(imageRef: string | null): string | null {
  if (!imageRef) {
    return null;
  }

  const trimmed = imageRef.trim();
  if (!trimmed) {
    return null;
  }

  return isHttpsImageUrl(trimmed) ? trimmed : null;
}

export function normalizeEntryForGameplay(entry: SpinnerEntry): SpinnerEntry {
  return {
    ...entry,
    imageRef: normalizeImageRef(entry.imageRef)
  };
}
