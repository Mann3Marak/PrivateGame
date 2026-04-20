import { NextRequest, NextResponse } from 'next/server';
import { extname } from 'node:path';
import { allowedUploadMimeTypes, signUploadRequestSchema } from '@/src/lib/api/schemas';
import { sanitizeFileName } from '@/src/lib/security/sanitize';
import { getServerEnv } from '@/src/lib/server/env';
import { enforceRateLimit } from '@/src/lib/server/rate-limit';
import { getServiceSupabaseClient } from '@/src/lib/server/supabase';

const MIME_EXTENSION_MAP: Record<(typeof allowedUploadMimeTypes)[number], string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/mp4': '.m4a'
};

function getRequestIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

function withRateLimitHeaders(response: NextResponse, resetAt: number, remaining: number, limit: number): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(limit));
  response.headers.set('X-RateLimit-Remaining', String(remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.floor(resetAt / 1000)));
  return response;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getRequestIp(request);
  const rate = enforceRateLimit(`sign-upload:${ip}`, 20, 60_000);

  if (!rate.ok) {
    return withRateLimitHeaders(NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 }), rate.resetAt, rate.remaining, rate.limit);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withRateLimitHeaders(NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }), rate.resetAt, rate.remaining, rate.limit);
  }

  const parsed = signUploadRequestSchema.safeParse(body);
  if (!parsed.success) {
    return withRateLimitHeaders(
      NextResponse.json({ error: 'Invalid upload request payload.' }, { status: 400 }),
      rate.resetAt,
      rate.remaining,
      rate.limit
    );
  }

  const env = getServerEnv();
  if (parsed.data.sizeBytes > env.uploadMaxBytes) {
    return withRateLimitHeaders(
      NextResponse.json({ error: `File exceeds max size of ${env.uploadMaxBytes} bytes.` }, { status: 400 }),
      rate.resetAt,
      rate.remaining,
      rate.limit
    );
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return withRateLimitHeaders(
      NextResponse.json({ error: 'File upload is not configured on the server.' }, { status: 503 }),
      rate.resetAt,
      rate.remaining,
      rate.limit
    );
  }

  const sanitizedName = sanitizeFileName(parsed.data.filename);
  const extension = extname(sanitizedName) || MIME_EXTENSION_MAP[parsed.data.mimeType];
  const timestamp = new Date().toISOString().slice(0, 10);
  const path = `${timestamp}/${crypto.randomUUID()}${extension}`;

  const signedResult = await supabase.storage.from(env.storageBucket).createSignedUploadUrl(path);
  if (signedResult.error || !signedResult.data?.signedUrl) {
    return withRateLimitHeaders(
      NextResponse.json({ error: 'Unable to create signed upload URL.' }, { status: 502 }),
      rate.resetAt,
      rate.remaining,
      rate.limit
    );
  }

  const publicResult = supabase.storage.from(env.storageBucket).getPublicUrl(path);

  return withRateLimitHeaders(
    NextResponse.json({
      uploadUrl: signedResult.data.signedUrl,
      token: signedResult.data.token,
      path,
      publicUrl: publicResult.data.publicUrl,
      maxBytes: env.uploadMaxBytes
    }),
    rate.resetAt,
    rate.remaining,
    rate.limit
  );
}
