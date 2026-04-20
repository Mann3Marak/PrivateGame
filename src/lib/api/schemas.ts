import { z } from 'zod';

export const allowedImageMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const allowedAudioMimeTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mp4'] as const;
export const allowedUploadMimeTypes = [...allowedImageMimeTypes, ...allowedAudioMimeTypes] as const;

export const signUploadRequestSchema = z.object({
  filename: z.string().min(1).max(140),
  mimeType: z.enum(allowedUploadMimeTypes),
  sizeBytes: z.number().int().positive().max(20 * 1024 * 1024)
});

export const telemetrySpinEventSchema = z.object({
  deviceId: z.string().uuid(),
  sessionId: z.string().uuid(),
  roundNumber: z.number().int().positive(),
  player: z.union([z.literal('P1'), z.literal('P2')]),
  partText: z.string().max(140),
  actionText: z.string().max(140),
  timerText: z.string().max(140),
  createdAt: z.string().datetime()
});

export type SignUploadRequest = z.infer<typeof signUploadRequestSchema>;
export type TelemetrySpinEvent = z.infer<typeof telemetrySpinEventSchema>;
