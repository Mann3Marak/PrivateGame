import { NextRequest, NextResponse } from 'next/server';
import { validateGameState } from '@/src/lib/game/persistence';
import { getServiceSupabaseClient } from '@/src/lib/server/supabase';

const SNAPSHOT_ID = 'default';

function toResponse(status: number, body: Record<string, unknown>): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return toResponse(200, { state: null, persisted: false });
  }

  const selectResult = await supabase.from('game_state_snapshots').select('payload').eq('id', SNAPSHOT_ID).maybeSingle();
  if (selectResult.error) {
    return toResponse(200, { state: null, persisted: false });
  }

  const validated = validateGameState(selectResult.data?.payload);
  if (!validated) {
    return toResponse(200, { state: null, persisted: false });
  }

  return toResponse(200, { state: validated, persisted: true });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return toResponse(202, { accepted: true, persisted: false });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toResponse(400, { error: 'Invalid JSON body.' });
  }

  const payloadCandidate =
    body && typeof body === 'object' && Object.hasOwn(body as object, 'state')
      ? (body as { state?: unknown }).state
      : body;

  const validated = validateGameState(payloadCandidate);
  if (!validated) {
    return toResponse(400, { error: 'Invalid game state payload.' });
  }

  const upsertResult = await supabase.from('game_state_snapshots').upsert(
    {
      id: SNAPSHOT_ID,
      payload: validated,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'id' }
  );

  if (upsertResult.error) {
    return toResponse(202, { accepted: true, persisted: false });
  }

  return toResponse(202, { accepted: true, persisted: true });
}
