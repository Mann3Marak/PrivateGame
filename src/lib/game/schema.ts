import { z } from 'zod';
import { ROUND_QUOTAS, randomActionCountForRound, roundModeForRound, totalTurnsForRound } from './types';
import { isHttpsImageUrl } from './validation';

const playerSchema = z.union([z.literal('P1'), z.literal('P2')]);

const spinnerEntrySchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  imageRef: z
    .string()
    .refine((value) => isHttpsImageUrl(value), 'Image URL must be HTTPS and point to a supported image extension.')
    .nullable()
});

const spinResultItemSchema = z.object({
  text: z.string(),
  imageRef: z.string().nullable(),
  fromFallback: z.boolean()
});

const nopeAlternativeSchema = z.object({
  text: z.string().max(4000),
  imageRef: z
    .string()
    .refine((value) => isHttpsImageUrl(value), 'Image URL must be HTTPS and point to a supported image extension.')
    .nullable(),
  timerSeconds: z.number().int().min(1).max(60 * 60).nullable().default(null),
  timerUnit: z.union([z.literal('seconds'), z.literal('minutes')]).default('seconds')
});

const secondStepSchema = z.object({
  text: z.string().max(4000),
  imageRef: z
    .string()
    .refine((value) => isHttpsImageUrl(value), 'Image URL must be HTTPS and point to a supported image extension.')
    .nullable(),
  timerSeconds: z.number().int().min(1).max(60 * 60).nullable().default(null),
  timerUnit: z.union([z.literal('seconds'), z.literal('minutes')]).default('seconds')
});

const randomActionSchema = z.object({
  text: z.string().max(4000),
  imageRef: z
    .string()
    .refine((value) => isHttpsImageUrl(value), 'Image URL must be HTTPS and point to a supported image extension.')
    .nullable(),
  linkUrl: z.string().url().nullable().default(null),
  assignedPlayer: z.union([z.literal('any'), z.literal('P1'), z.literal('P2')]).default('any'),
  timerSeconds: z.number().int().min(1).max(60 * 60).nullable().default(null),
  timerUnit: z.union([z.literal('seconds'), z.literal('minutes')]).default('seconds'),
  secondStep: secondStepSchema.nullable().default(null),
  nopeAlternative: nopeAlternativeSchema.nullable().default(null)
});

const audioSettingsSchema = z.object({
  muted: z.boolean().default(false),
  volume: z.number().min(0).max(1).default(0.7),
  timerEndAudioRef: z.string().url().nullable().default(null),
  roundIntroAudioRef: z.string().url().nullable().default(null),
  randomActionAudioRef: z.string().url().nullable().default(null)
});

const turnResultTextSchema = z.object({
  partText: z.string(),
  actionText: z.string(),
  timerText: z.string()
});

const roundSchema = z.object({
  roundNumber: z.number().int().positive(),
  name: z.string().min(1),
  mode: z.union([z.literal('spin'), z.literal('actions-only')]).default('spin'),
  quotaPerPlayer: z.number().int().positive(),
  totalTurns: z.number().int().positive().default(1),
  introText: z.string().max(220).default('Welcome to this round.'),
  introImageRef: z
    .string()
    .refine((value) => isHttpsImageUrl(value), 'Image URL must be HTTPS and point to a supported image extension.')
    .nullable()
    .default(null),
  randomActions: z.array(randomActionSchema).default([]),
  spinners: z.object({
    part: z.array(spinnerEntrySchema),
    action: z.array(spinnerEntrySchema),
    timer: z.array(spinnerEntrySchema)
  })
});

export const gameStateSchema = z.object({
  configVersion: z.literal(1),
  rulesText: z.string(),
  resultInfoText: z.string().max(280).default(''),
  audioSettings: audioSettingsSchema.default({
    muted: false,
    volume: 0.7,
    timerEndAudioRef: null,
    roundIntroAudioRef: null,
    randomActionAudioRef: null
  }),
  playerImages: z
    .object({
      P1: z
        .string()
        .refine((value) => isHttpsImageUrl(value), 'Player image URL must be HTTPS and point to a supported image extension.')
        .nullable(),
      P2: z
        .string()
        .refine((value) => isHttpsImageUrl(value), 'Player image URL must be HTTPS and point to a supported image extension.')
        .nullable()
    })
    .default({ P1: null, P2: null }),
  sideVideoUrl: z.string().url().nullable().default(null),
  rounds: z
    .array(roundSchema)
    .min(5)
    .max(5)
    .superRefine((rounds, context) => {
      rounds.forEach((round, index) => {
        const expectedRoundNumber = index + 1;
        if (round.roundNumber !== expectedRoundNumber) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Round numbers must stay sequential. Expected ${expectedRoundNumber}.`,
            path: [index, 'roundNumber']
          });
        }

        const expectedQuota = ROUND_QUOTAS[index];
        if (round.quotaPerPlayer !== expectedQuota) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Quota for round ${expectedRoundNumber} must be ${expectedQuota}.`,
            path: [index, 'quotaPerPlayer']
          });
        }

        const expectedTotalTurns = totalTurnsForRound(expectedRoundNumber);
        if (round.totalTurns !== expectedTotalTurns) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Total turns for round ${expectedRoundNumber} must be ${expectedTotalTurns}.`,
            path: [index, 'totalTurns']
          });
        }

        const expectedMode = roundModeForRound(expectedRoundNumber);
        if (round.mode !== expectedMode) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Round ${expectedRoundNumber} mode must be "${expectedMode}".`,
            path: [index, 'mode']
          });
        }

        const expectedRandomActionCount = randomActionCountForRound(expectedRoundNumber);
        if (round.randomActions.length !== expectedRandomActionCount) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Round ${expectedRoundNumber} must have ${expectedRandomActionCount} random actions.`,
            path: [index, 'randomActions']
          });
        }
      });
    }),
  session: z.object({
    isPaused: z.boolean(),
    activePlayer: playerSchema,
    currentRoundNumber: z.number().int().positive(),
    turnCounters: z.record(z.string(), z.object({ P1: z.number().int().nonnegative(), P2: z.number().int().nonnegative() })),
    completedRandomInstructions: z.record(z.string(), z.array(z.number().int().nonnegative())).default({}),
    lastTurnByPlayer: z.object({
      P1: turnResultTextSchema.nullable(),
      P2: turnResultTextSchema.nullable()
    }),
    lastSpinResult: z
      .object({
        part: spinResultItemSchema,
        action: spinResultItemSchema,
        timer: spinResultItemSchema
      })
      .nullable(),
    updatedAt: z.string().datetime()
  })
});
