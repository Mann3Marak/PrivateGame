export type Player = 'P1' | 'P2';
export type SpinnerType = 'part' | 'action' | 'timer';
export type RoundMode = 'spin' | 'actions-only';

export interface SpinnerEntry {
  id: string;
  text: string;
  imageRef: string | null;
}

export interface SpinResultItem {
  text: string;
  imageRef: string | null;
  fromFallback: boolean;
}

export interface TurnResultText {
  partText?: string;
  actionText: string;
  timerText: string;
}

export type NopeTimerUnit = 'seconds' | 'minutes';

export interface NopeAlternative {
  text: string;
  imageRef: string | null;
  timerSeconds: number | null;
  timerUnit: NopeTimerUnit;
}

export type RandomActionAssignedPlayer = 'any' | Player;

export interface RandomActionSecondStep {
  text: string;
  imageRef: string | null;
  timerSeconds: number | null;
  timerUnit: NopeTimerUnit;
}

export interface RandomAction {
  text: string;
  imageRef: string | null;
  linkUrl: string | null;
  assignedPlayer: RandomActionAssignedPlayer;
  timerSeconds: number | null;
  timerUnit: NopeTimerUnit;
  secondStep: RandomActionSecondStep | null;
  nopeAlternative: NopeAlternative | null;
}

export interface AudioSettings {
  muted: boolean;
  volume: number;
  timerEndAudioRef: string | null;
  roundIntroAudioRef: string | null;
  randomActionAudioRef: string | null;
}

export interface GameOverChallenge {
  actionText: string;
  timerSeconds: number | null;
  timerUnit: 'seconds' | 'minutes';
}

export type PlayerImages = Record<Player, string | null>;

export interface Round {
  roundNumber: number;
  name: string;
  mode: RoundMode;
  quotaPerPlayer: number;
  totalTurns: number;
  introText: string;
  introImageRef: string | null;
  chickenOutText: string;
  randomActions: RandomAction[];
  spinners: {
    part: SpinnerEntry[];
    action: SpinnerEntry[];
    timer: SpinnerEntry[];
  };
}

export interface SessionState {
  isPaused: boolean;
  activePlayer: Player;
  currentRoundNumber: number;
  turnCounters: Record<string, Record<Player, number>>;
  completedRandomInstructions: Record<string, number[]>;
  lastTurnByPlayer: Record<Player, TurnResultText | null>;
  lastSpinResult: {
    part?: SpinResultItem;
    action: SpinResultItem;
    timer: SpinResultItem;
  } | null;
  updatedAt: string;
}

export interface GameState {
  configVersion: 1;
  rulesText: string;
  resultInfoText: string;
  audioSettings: AudioSettings;
  playerImages: PlayerImages;
  sideVideoUrl: string | null;
  gameOverChallenge: GameOverChallenge;
  rounds: Round[];
  session: SessionState;
}

export interface SpinSuccess {
  ok: true;
  result: {
    part?: SpinResultItem;
    action: SpinResultItem;
    timer: SpinResultItem;
  };
}

export interface SpinFailure {
  ok: false;
  reason: 'PAUSED' | 'NOT_ACTIVE_PLAYER';
}

export type SpinOutcome = SpinSuccess | SpinFailure;

export const STORAGE_KEY = 'spinnerGame.v1.state';
export const MAX_ROUNDS = 5;
export const DEFAULT_ROUND_COUNT = 5;
export const ROUND_QUOTAS = [5, 3, 5, 3, 2] as const;
export const ROUND_MODES: readonly RoundMode[] = ['spin', 'actions-only', 'spin', 'actions-only', 'spin'] as const;
export const RANDOM_ACTION_COUNTS: readonly number[] = [4, 3, 3, 3, 0] as const;
// Total turns per round. When set, the round ends after this many combined turns across
// both players (player order still alternates strictly). When quotaPerPlayer x 2 equals
// this value the two end conditions coincide; otherwise totalTurns wins.
export const ROUND_TOTAL_TURNS: readonly number[] = [10, 3, 10, 3, 4] as const;

export function roundModeForRound(roundNumber: number): RoundMode {
  const mode = ROUND_MODES[roundNumber - 1];
  return mode ?? 'spin';
}

export function randomActionCountForRound(roundNumber: number): number {
  const count = RANDOM_ACTION_COUNTS[roundNumber - 1];
  return typeof count === 'number' ? count : 0;
}

export function totalTurnsForRound(roundNumber: number): number {
  const total = ROUND_TOTAL_TURNS[roundNumber - 1];
  if (typeof total === 'number' && total > 0) {
    return total;
  }
  const quota = ROUND_QUOTAS[roundNumber - 1];
  return typeof quota === 'number' ? quota * 2 : 0;
}
