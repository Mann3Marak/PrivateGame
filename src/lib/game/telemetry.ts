import { Player } from './types';
import { getTelemetryIdentifiers } from './device-id';

interface SpinTelemetryPayload {
  player: Player;
  roundNumber: number;
  partText: string | null;
  actionText: string;
  timerText: string;
  createdAt: string;
}

function sendWithFetch(body: string): void {
  fetch('/api/events/spin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body,
    keepalive: true
  }).catch(() => {
    // Telemetry is intentionally best-effort and must never block gameplay.
  });
}

export function queueSpinTelemetryEvent(payload: SpinTelemetryPayload): void {
  if (typeof window === 'undefined') {
    return;
  }

  const ids = getTelemetryIdentifiers();
  if (!ids) {
    return;
  }

  const body = JSON.stringify({
    deviceId: ids.deviceId,
    sessionId: ids.sessionId,
    ...payload
  });

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      const sent = navigator.sendBeacon('/api/events/spin', blob);
      if (sent) {
        return;
      }
    }
  } catch {
    // fall through to fetch transport.
  }

  sendWithFetch(body);
}
