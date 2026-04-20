import { createDefaultGameState } from './default-state';
import { gameStateSchema } from './schema';
import { DEFAULT_ROUND_COUNT, GameState, ROUND_QUOTAS, STORAGE_KEY, randomActionCountForRound, roundModeForRound, totalTurnsForRound } from './types';

export interface HydrationResult {
  state: GameState;
  wasRecovered: boolean;
  recoveryReason: string | null;
}

function safeParseSerializedState(serialized: string): unknown {
  try {
    return JSON.parse(serialized) as unknown;
  } catch {
    return null;
  }
}

export function validateGameState(input: unknown): GameState | null {
  const migrated = migrateLegacyGameState(input);
  const parsed = gameStateSchema.safeParse(migrated);
  return parsed.success ? parsed.data : null;
}

function migrateLegacyGameState(input: unknown): unknown {
  if (!input || typeof input !== 'object') {
    return input;
  }

  const candidate = input as {
    randomActions?: unknown;
    playerImages?: unknown;
    audioSettings?: unknown;
    resultInfoText?: unknown;
  };
  const hadLegacyRandomActions = Array.isArray(candidate.randomActions);

  const parseNopeAlternative = (
    value: unknown
  ): { text: string; imageRef: string | null; timerSeconds: number | null; timerUnit: 'seconds' | 'minutes' } | null => {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const obj = value as {
      text?: unknown;
      imageRef?: unknown;
      timerSeconds?: unknown;
      timerUnit?: unknown;
    };
    const text = typeof obj.text === 'string' ? obj.text : '';
    const imageRef = typeof obj.imageRef === 'string' ? obj.imageRef : null;
    if (!text && !imageRef) {
      return null;
    }
    const timerSecondsRaw = typeof obj.timerSeconds === 'number' && Number.isFinite(obj.timerSeconds) ? Math.floor(obj.timerSeconds) : null;
    const timerSeconds = timerSecondsRaw && timerSecondsRaw > 0 ? Math.min(timerSecondsRaw, 60 * 60) : null;
    const timerUnit: 'seconds' | 'minutes' = obj.timerUnit === 'minutes' ? 'minutes' : 'seconds';
    return { text, imageRef, timerSeconds, timerUnit };
  };

  const parseAssignedPlayer = (value: unknown): 'any' | 'P1' | 'P2' => {
    if (value === 'P1' || value === 'P2') {
      return value;
    }
    return 'any';
  };

  const parseTimerSeconds = (value: unknown): number | null => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return null;
    }
    const rounded = Math.floor(value);
    return rounded > 0 ? Math.min(rounded, 60 * 60) : null;
  };

  const parseTimerUnit = (value: unknown): 'seconds' | 'minutes' => (value === 'minutes' ? 'minutes' : 'seconds');

  const parseSecondStep = (
    value: unknown
  ): { text: string; imageRef: string | null; timerSeconds: number | null; timerUnit: 'seconds' | 'minutes' } | null => {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const obj = value as {
      text?: unknown;
      imageRef?: unknown;
      timerSeconds?: unknown;
      timerUnit?: unknown;
    };
    const text = typeof obj.text === 'string' ? obj.text : '';
    const imageRef = typeof obj.imageRef === 'string' ? obj.imageRef : null;
    if (!text && !imageRef) {
      return null;
    }
    return {
      text,
      imageRef,
      timerSeconds: parseTimerSeconds(obj.timerSeconds),
      timerUnit: parseTimerUnit(obj.timerUnit)
    };
  };

  const parseLegacyAction = (action: unknown) => {
    if (typeof action === 'string') {
      return {
        text: action,
        imageRef: null,
        linkUrl: null,
        assignedPlayer: 'any' as const,
        timerSeconds: null,
        timerUnit: 'seconds' as const,
        secondStep: null,
        nopeAlternative: null
      };
    }

    if (action && typeof action === 'object') {
      const actionObject = action as {
        text?: unknown;
        imageRef?: unknown;
        linkUrl?: unknown;
        assignedPlayer?: unknown;
        timerSeconds?: unknown;
        timerUnit?: unknown;
        secondStep?: unknown;
        nopeAlternative?: unknown;
      };
      return {
        text: typeof actionObject.text === 'string' ? actionObject.text : '',
        imageRef: typeof actionObject.imageRef === 'string' ? actionObject.imageRef : null,
        linkUrl: typeof actionObject.linkUrl === 'string' ? actionObject.linkUrl : null,
        assignedPlayer: parseAssignedPlayer(actionObject.assignedPlayer),
        timerSeconds: parseTimerSeconds(actionObject.timerSeconds),
        timerUnit: parseTimerUnit(actionObject.timerUnit),
        secondStep: parseSecondStep(actionObject.secondStep),
        nopeAlternative: parseNopeAlternative(actionObject.nopeAlternative)
      };
    }

    return {
      text: '',
      imageRef: null,
      linkUrl: null,
      assignedPlayer: 'any' as const,
      timerSeconds: null,
      timerUnit: 'seconds' as const,
      secondStep: null,
      nopeAlternative: null
    };
  };

  const migratedLegacyActions = hadLegacyRandomActions ? (candidate.randomActions as unknown[]).map(parseLegacyAction) : [];
  let legacyActionOffset = 0;

  const rawRounds = Array.isArray((candidate as { rounds?: unknown }).rounds)
    ? ((candidate as { rounds: unknown[] }).rounds as unknown[])
    : [];

  const normalizedRounds = Array.from({ length: DEFAULT_ROUND_COUNT }, (_, index) => {
    const roundNumber = index + 1;
    const expectedCount = randomActionCountForRound(roundNumber);
    const expectedMode = roundModeForRound(roundNumber);
    const expectedQuota = ROUND_QUOTAS[index];

    const source = rawRounds[index];
    const sourceObj: Record<string, unknown> =
      source && typeof source === 'object' ? (source as Record<string, unknown>) : {};

    const existingActions = Array.isArray(sourceObj.randomActions)
      ? (sourceObj.randomActions as unknown[]).map(parseLegacyAction)
      : [];

    const fallbackActions = migratedLegacyActions.slice(legacyActionOffset, legacyActionOffset + expectedCount);
    legacyActionOffset += expectedCount;
    const sourceActions = existingActions.length > 0 ? existingActions : fallbackActions;
    const paddedActions = Array.from({ length: expectedCount }, (_, actionIndex) => {
      const existing = sourceActions[actionIndex];
      return (
        existing ?? {
          text: `Round ${roundNumber} random action ${actionIndex + 1}`,
          imageRef: null,
          linkUrl: null,
          assignedPlayer: 'any' as const,
          timerSeconds: null,
          timerUnit: 'seconds' as const,
          secondStep: null,
          nopeAlternative: null
        }
      );
    });

    const { nopeTasks: _legacyNopeTasks, ...restRound } = sourceObj;
    void _legacyNopeTasks;

    return {
      ...restRound,
      roundNumber,
      name: typeof restRound.name === 'string' && restRound.name ? restRound.name : `Round ${roundNumber}`,
      mode: expectedMode,
      quotaPerPlayer: expectedQuota,
      totalTurns: totalTurnsForRound(roundNumber),
      introText:
        typeof restRound.introText === 'string'
          ? restRound.introText
          : `Welcome to Round ${roundNumber}. Keep the energy high and enjoy the game.`,
      introImageRef: typeof restRound.introImageRef === 'string' ? restRound.introImageRef : null,
      randomActions: paddedActions,
      spinners:
        restRound.spinners && typeof restRound.spinners === 'object'
          ? {
              part: Array.isArray((restRound.spinners as { part?: unknown }).part)
                ? (restRound.spinners as { part: unknown[] }).part
                : [],
              action: Array.isArray((restRound.spinners as { action?: unknown }).action)
                ? (restRound.spinners as { action: unknown[] }).action
                : [],
              timer: Array.isArray((restRound.spinners as { timer?: unknown }).timer)
                ? (restRound.spinners as { timer: unknown[] }).timer
                : []
            }
          : { part: [], action: [], timer: [] }
    };
  });

  const migratedRounds = normalizedRounds;

  const migratedPlayerImages =
    candidate.playerImages && typeof candidate.playerImages === 'object'
      ? {
          P1: typeof (candidate.playerImages as { P1?: unknown }).P1 === 'string' ? (candidate.playerImages as { P1: string }).P1 : null,
          P2: typeof (candidate.playerImages as { P2?: unknown }).P2 === 'string' ? (candidate.playerImages as { P2: string }).P2 : null
        }
      : { P1: null, P2: null };

  const migratedAudioSettings =
    candidate.audioSettings && typeof candidate.audioSettings === 'object'
      ? {
          muted: Boolean((candidate.audioSettings as { muted?: unknown }).muted),
          volume:
            typeof (candidate.audioSettings as { volume?: unknown }).volume === 'number'
              ? (candidate.audioSettings as { volume: number }).volume
              : 0.7,
          timerEndAudioRef:
            typeof (candidate.audioSettings as { timerEndAudioRef?: unknown }).timerEndAudioRef === 'string'
              ? (candidate.audioSettings as { timerEndAudioRef: string }).timerEndAudioRef
              : null,
          roundIntroAudioRef:
            typeof (candidate.audioSettings as { roundIntroAudioRef?: unknown }).roundIntroAudioRef === 'string'
              ? (candidate.audioSettings as { roundIntroAudioRef: string }).roundIntroAudioRef
              : null,
          randomActionAudioRef:
            typeof (candidate.audioSettings as { randomActionAudioRef?: unknown }).randomActionAudioRef === 'string'
              ? (candidate.audioSettings as { randomActionAudioRef: string }).randomActionAudioRef
              : null
        }
      : {
          muted: false,
          volume: 0.7,
          timerEndAudioRef: null,
          roundIntroAudioRef: null,
          randomActionAudioRef: null
        };

  const migratedResultInfoText = typeof candidate.resultInfoText === 'string' ? candidate.resultInfoText : '';

  const sessionCandidate =
    (candidate as { session?: unknown }).session && typeof (candidate as { session?: unknown }).session === 'object'
      ? ((candidate as { session: Record<string, unknown> }).session)
      : undefined;

  let migratedSession: unknown = sessionCandidate;
  if (sessionCandidate) {
    const currentRound =
      typeof sessionCandidate.currentRoundNumber === 'number' ? sessionCandidate.currentRoundNumber : 1;
    const clampedRound = Math.min(Math.max(1, currentRound), DEFAULT_ROUND_COUNT);

    const rawCounters =
      sessionCandidate.turnCounters && typeof sessionCandidate.turnCounters === 'object'
        ? (sessionCandidate.turnCounters as Record<string, unknown>)
        : {};
    const filteredCounters: Record<string, { P1: number; P2: number }> = {};
    for (let r = 1; r <= DEFAULT_ROUND_COUNT; r += 1) {
      const key = String(r);
      const existing = rawCounters[key] as { P1?: unknown; P2?: unknown } | undefined;
      filteredCounters[key] = {
        P1: typeof existing?.P1 === 'number' ? existing.P1 : 0,
        P2: typeof existing?.P2 === 'number' ? existing.P2 : 0
      };
    }

    const rawCompleted =
      sessionCandidate.completedRandomInstructions && typeof sessionCandidate.completedRandomInstructions === 'object'
        ? (sessionCandidate.completedRandomInstructions as Record<string, unknown>)
        : {};
    const filteredCompleted: Record<string, number[]> = {};
    for (let r = 1; r <= DEFAULT_ROUND_COUNT; r += 1) {
      const key = String(r);
      const existing = rawCompleted[key];
      if (Array.isArray(existing)) {
        filteredCompleted[key] = existing.filter((value): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0);
      }
    }

    migratedSession = {
      ...sessionCandidate,
      currentRoundNumber: clampedRound,
      turnCounters: filteredCounters,
      completedRandomInstructions: filteredCompleted
    };
  }

  return {
    ...candidate,
    rounds: migratedRounds,
    playerImages: migratedPlayerImages,
    audioSettings: migratedAudioSettings,
    resultInfoText: migratedResultInfoText,
    ...(migratedSession ? { session: migratedSession } : {})
  };
}

export function loadPersistedState(storage: Storage | null): HydrationResult {
  const defaultState = createDefaultGameState();

  if (!storage) {
    return {
      state: defaultState,
      wasRecovered: false,
      recoveryReason: null
    };
  }

  const serialized = storage.getItem(STORAGE_KEY);

  if (!serialized) {
    return {
      state: defaultState,
      wasRecovered: false,
      recoveryReason: null
    };
  }

  const parsed = safeParseSerializedState(serialized);
  const validated = validateGameState(parsed);

  if (!validated) {
    return {
      state: defaultState,
      wasRecovered: true,
      recoveryReason: 'Stored game state was corrupt and has been reset to defaults.'
    };
  }

  return {
    state: validated,
    wasRecovered: false,
    recoveryReason: null
  };
}

export function persistState(storage: Storage | null, state: GameState): void {
  if (!storage) {
    return;
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
