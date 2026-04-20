import { DEFAULT_ROUND_COUNT, GameState, ROUND_QUOTAS, SpinnerType, randomActionCountForRound, roundModeForRound, totalTurnsForRound } from './types';

const EMPTY_SPINNERS: Record<SpinnerType, []> = {
  part: [],
  action: [],
  timer: []
};

function createRound(roundNumber: number): GameState['rounds'][number] {
  const randomActions = Array.from({ length: randomActionCountForRound(roundNumber) }, (_, index) => ({
    text: `Round ${roundNumber} random action ${index + 1}`,
    imageRef: null,
    linkUrl: null,
    assignedPlayer: 'any' as const,
    timerSeconds: null,
    timerUnit: 'seconds' as const,
    secondStep: null,
    nopeAlternative: null
  }));

  return {
    roundNumber,
    name: `Round ${roundNumber}`,
    mode: roundModeForRound(roundNumber),
    quotaPerPlayer: ROUND_QUOTAS[roundNumber - 1],
    totalTurns: totalTurnsForRound(roundNumber),
    introText: `Welcome to Round ${roundNumber}. Keep the energy high and enjoy the game.`,
    introImageRef: null,
    randomActions,
    spinners: {
      part: [...EMPTY_SPINNERS.part],
      action: [...EMPTY_SPINNERS.action],
      timer: [...EMPTY_SPINNERS.timer]
    }
  };
}

function createTurnCounters(roundCount: number): GameState['session']['turnCounters'] {
  const counters: GameState['session']['turnCounters'] = {};

  for (let round = 1; round <= roundCount; round += 1) {
    counters[String(round)] = {
      P1: 0,
      P2: 0
    };
  }

  return counters;
}

export function createDefaultGameState(): GameState {
  const rounds = Array.from({ length: DEFAULT_ROUND_COUNT }, (_, index) => createRound(index + 1));

  return {
    configVersion: 1,
    rulesText: 'Rules are informational only. Gameplay follows turn and round logic.',
    resultInfoText: '',
    audioSettings: {
      muted: false,
      volume: 0.7,
      timerEndAudioRef: null,
      roundIntroAudioRef: null,
      randomActionAudioRef: null
    },
    playerImages: {
      P1: null,
      P2: null
    },
    sideVideoUrl: null,
    rounds,
    session: {
      isPaused: false,
      activePlayer: 'P1',
      currentRoundNumber: 1,
      turnCounters: createTurnCounters(DEFAULT_ROUND_COUNT),
      completedRandomInstructions: {},
      lastTurnByPlayer: {
        P1: null,
        P2: null
      },
      lastSpinResult: null,
      updatedAt: new Date(0).toISOString()
    }
  };
}
