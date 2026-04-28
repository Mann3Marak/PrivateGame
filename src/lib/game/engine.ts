import { GameState, Player, SpinOutcome, SpinResultItem, SpinnerEntry, SpinnerType, totalTurnsForRound } from './types';
import { normalizeEntryForGameplay } from './validation';

const SPINNER_ORDER: SpinnerType[] = ['part', 'action', 'timer'];

function isLastRound(state: GameState, roundNumber: number): boolean {
  return roundNumber === state.rounds[state.rounds.length - 1]?.roundNumber;
}

export interface SpinOptions {
  nowIso?: () => string;
  randomIndex?: (maxExclusive: number) => number;
}

function defaultNowIso(): string {
  return new Date().toISOString();
}

function cryptoRandomIndex(maxExclusive: number): number {
  if (maxExclusive <= 0) {
    return 0;
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] % maxExclusive;
  }

  return Math.floor(Math.random() * maxExclusive);
}

function selectItem(spinnerName: 'Part' | 'Action' | 'Timer', pool: SpinnerEntry[], randomIndex: (maxExclusive: number) => number): SpinResultItem {
  if (pool.length === 0) {
    return {
      text: spinnerName,
      imageRef: null,
      fromFallback: true
    };
  }

  const selected = normalizeEntryForGameplay(pool[randomIndex(pool.length)]);

  return {
    text: selected.text,
    imageRef: selected.imageRef,
    fromFallback: false
  };
}

function nextPlayer(player: Player): Player {
  return player === 'P1' ? 'P2' : 'P1';
}

function ensureRoundCounter(state: GameState, roundNumber: number): void {
  const key = String(roundNumber);
  if (!state.session.turnCounters[key]) {
    state.session.turnCounters[key] = { P1: 0, P2: 0 };
  }
}

export function executeSpin(state: GameState, player: Player, options?: SpinOptions): SpinOutcome {
  if (state.session.isPaused) {
    return { ok: false, reason: 'PAUSED' };
  }

  if (player !== state.session.activePlayer) {
    return { ok: false, reason: 'NOT_ACTIVE_PLAYER' };
  }

  const nowIso = options?.nowIso ?? defaultNowIso;
  const randomIndex = options?.randomIndex ?? cryptoRandomIndex;
  const round = state.rounds.find((candidate) => candidate.roundNumber === state.session.currentRoundNumber);

  if (!round) {
    throw new Error(`Current round ${state.session.currentRoundNumber} does not exist.`);
  }

  const isLast = isLastRound(state, round.roundNumber);
  const result = {
    part: isLast ? undefined : selectItem('Part', round.spinners.part, randomIndex),
    action: selectItem('Action', round.spinners.action, randomIndex),
    timer: selectItem('Timer', round.spinners.timer, randomIndex)
  };

  ensureRoundCounter(state, round.roundNumber);
  state.session.turnCounters[String(round.roundNumber)][player] += 1;
  state.session.lastTurnByPlayer[player] = {
    partText: result.part?.text,
    actionText: result.action.text,
    timerText: result.timer.text
  };

  const currentRoundCounters = state.session.turnCounters[String(round.roundNumber)];
  const totalTurnsTaken = currentRoundCounters.P1 + currentRoundCounters.P2;
  const totalLimit = totalTurnsForRound(round.roundNumber);
  const quotaMet = totalTurnsTaken >= totalLimit;

  let roundAdvanced = false;
  if (quotaMet) {
    const currentIndex = state.rounds.findIndex((candidate) => candidate.roundNumber === round.roundNumber);
    const hasNextRound = currentIndex >= 0 && currentIndex < state.rounds.length - 1;
    if (hasNextRound) {
      const nextRound = state.rounds[currentIndex + 1];
      state.session.currentRoundNumber = nextRound.roundNumber;
      ensureRoundCounter(state, nextRound.roundNumber);
      roundAdvanced = true;
    }
  }

  // Each round starts with P1. If totalTurns is odd, the within-round rotation
  // leaves activePlayer at the wrong player at the end; reset on round advance.
  state.session.activePlayer = roundAdvanced ? 'P1' : nextPlayer(player);
  state.session.lastSpinResult = result;
  state.session.updatedAt = nowIso();

  // Runtime assertion to preserve required ordered spinner output structure.
  for (const spinnerKey of SPINNER_ORDER) {
    if (spinnerKey === 'part' && isLast) {
      continue; // Last round skips the part spinner
    }
    if (!Object.hasOwn(result, spinnerKey)) {
      throw new Error('Spin result missing expected spinner output.');
    }
  }

  return {
    ok: true,
    result
  };
}
