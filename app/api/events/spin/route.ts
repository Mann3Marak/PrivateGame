import { NextRequest, NextResponse } from 'next/server';
import { telemetrySpinEventSchema } from '@/src/lib/api/schemas';
import { sanitizePlainText } from '@/src/lib/security/sanitize';
import { getServerEnv } from '@/src/lib/server/env';
import { enforceRateLimit } from '@/src/lib/server/rate-limit';
import { getServiceSupabaseClient } from '@/src/lib/server/supabase';

function getRequestIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

function toResponse(status: number, body: Record<string, unknown>): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getRequestIp(request);
  const rate = enforceRateLimit(`telemetry-spin:${ip}`, 120, 60_000);

  if (!rate.ok) {
    return toResponse(429, { error: 'Rate limit exceeded.' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toResponse(400, { error: 'Invalid JSON body.' });
  }

  const parsed = telemetrySpinEventSchema.safeParse(body);
  if (!parsed.success) {
    return toResponse(400, { error: 'Invalid telemetry payload.' });
  }

  const env = getServerEnv();
  if (!env.telemetryEnabled) {
    return toResponse(202, { accepted: true, persisted: false });
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return toResponse(202, { accepted: true, persisted: false });
  }

  const payload = {
    device_id: parsed.data.deviceId,
    session_id: parsed.data.sessionId,
    round_number: parsed.data.roundNumber,
    player: parsed.data.player,
    part_text: sanitizePlainText(parsed.data.partText, { maxLength: 140 }),
    action_text: sanitizePlainText(parsed.data.actionText, { maxLength: 140 }),
    timer_text: sanitizePlainText(parsed.data.timerText, { maxLength: 140 }),
    created_at: parsed.data.createdAt
  };

  const insertResult = await supabase.from('spin_events').insert(payload);
  if (insertResult.error) {
    return toResponse(202, { accepted: true, persisted: false });
  }

  return toResponse(202, { accepted: true, persisted: true });
}
