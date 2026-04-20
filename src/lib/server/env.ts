import 'server-only';

import { z } from 'zod';

const serverEnvSchema = z.object({
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default('spinner-images'),
  SUPABASE_UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  TELEMETRY_DISABLED: z.string().optional()
});

export interface ServerEnv {
  supabaseUrl: string | null;
  supabaseServiceRoleKey: string | null;
  storageBucket: string;
  uploadMaxBytes: number;
  telemetryEnabled: boolean;
}

let cachedEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = serverEnvSchema.safeParse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET,
    SUPABASE_UPLOAD_MAX_BYTES: process.env.SUPABASE_UPLOAD_MAX_BYTES,
    TELEMETRY_DISABLED: process.env.TELEMETRY_DISABLED
  });

  if (!parsed.success) {
    throw new Error('Invalid server environment configuration.');
  }

  const telemetryDisabled = (parsed.data.TELEMETRY_DISABLED ?? '').toLowerCase() === 'true';

  cachedEnv = {
    supabaseUrl: parsed.data.SUPABASE_URL ?? null,
    supabaseServiceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY ?? null,
    storageBucket: parsed.data.SUPABASE_STORAGE_BUCKET,
    uploadMaxBytes: parsed.data.SUPABASE_UPLOAD_MAX_BYTES,
    telemetryEnabled: !telemetryDisabled
  };

  return cachedEnv;
}
