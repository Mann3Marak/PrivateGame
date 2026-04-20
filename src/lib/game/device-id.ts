const DEVICE_ID_STORAGE_KEY = 'spinnerGame.v1.deviceId';
const SESSION_ID_STORAGE_KEY = 'spinnerGame.v1.sessionId';

export interface TelemetryIdentifiers {
  deviceId: string;
  sessionId: string;
}

function getStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function getOrCreateId(storage: Storage, key: string): string {
  const existing = storage.getItem(key);
  if (existing) {
    return existing;
  }

  const generated = crypto.randomUUID();
  storage.setItem(key, generated);
  return generated;
}

export function getTelemetryIdentifiers(): TelemetryIdentifiers | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  return {
    deviceId: getOrCreateId(storage, DEVICE_ID_STORAGE_KEY),
    sessionId: getOrCreateId(storage, SESSION_ID_STORAGE_KEY)
  };
}
