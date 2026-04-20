import { z } from 'zod';
import { GameState, MAX_ROUNDS, Player, ROUND_QUOTAS, SpinnerEntry, SpinnerType, randomActionCountForRound, roundModeForRound, totalTurnsForRound } from './types';
import { sanitizePlainText } from '../security/sanitize';
import { isHttpsImageUrl, normalizeImageRef } from './validation';

const rulesSchema = z.string().max(4000);
const roundNameSchema = z.string().max(80);
const roundIntroTextSchema = z.string().max(220);
const spinnerEntryIdSchema = z.string().min(1);
const spinnerEntryTextSchema = z.string().max(140);
const randomActionIndexSchema = z.number().int().min(0);
const randomActionTextSchema = z.string().max(4000);
const nopeAlternativeTextSchema = z.string().max(4000);
const resultInfoTextSchema = z.string().max(280);
const randomActionLinkSchema = z.string().url().max(2048).nullable();
const sideVideoUrlSchema = z.string().url().nullable();
const audioUrlSchema = z.string().url().max(2048).nullable();
const audioVolumeSchema = z.number().min(0).max(1);
const playerSchema = z.union([z.literal('P1'), z.literal('P2')]);
const assignedPlayerSchema = z.union([z.literal('any'), z.literal('P1'), z.literal('P2')]);

interface SpinnerEntryInput {
  text: string;
  imageRef: string | null;
}

export interface NopeAlternativeInput {
  text: string;
  imageRef: string | null;
  timerSeconds?: number | null;
  timerUnit?: 'seconds' | 'minutes';
}

export interface SecondStepInput {
  text: string;
  imageRef: string | null;
  timerSeconds?: number | null;
  timerUnit?: 'seconds' | 'minutes';
}

interface RandomActionInput {
  text: string;
  imageRef: string | null;
  linkUrl: string | null;
  assignedPlayer: 'any' | Player;
  timerSeconds?: number | null;
  timerUnit?: 'seconds' | 'minutes';
  secondStep: SecondStepInput | null;
  nopeAlternative: NopeAlternativeInput | null;
}

export interface MutationResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

function cloneGame(game: GameState): GameState {
  return JSON.parse(JSON.stringify(game)) as GameState;
}

function touchUpdatedAt(game: GameState): void {
  game.session.updatedAt = new Date().toISOString();
}

function findRoundIndex(game: GameState, roundNumber: number): number {
  return game.rounds.findIndex((round) => round.roundNumber === roundNumber);
}

function ensureTurnCounter(game: GameState, roundNumber: number): void {
  const key = String(roundNumber);
  if (!game.session.turnCounters[key]) {
    game.session.turnCounters[key] = { P1: 0, P2: 0 };
  }
}

function parseSpinnerEntryInput(input: SpinnerEntryInput): MutationResult<SpinnerEntryInput> {
  const sanitizedText = sanitizePlainText(input.text, { maxLength: 140 });
  const textParse = spinnerEntryTextSchema.safeParse(sanitizedText);
  if (!textParse.success) {
    return { ok: false, error: 'Spinner text must be 140 characters or fewer.' };
  }

  const normalizedImageRef = normalizeImageRef(input.imageRef);
  const rawImage = input.imageRef?.trim() ?? '';
  if (rawImage && !normalizedImageRef) {
    return { ok: false, error: 'Image URL must be HTTPS and end with png, jpg, jpeg, webp, or gif.' };
  }

  if (!textParse.data && !normalizedImageRef) {
    return { ok: false, error: 'Spinner entries require text or a valid image URL.' };
  }

  return {
    ok: true,
    value: {
      text: textParse.data,
      imageRef: normalizedImageRef
    }
  };
}

export function setRulesText(game: GameState, nextRulesText: string): MutationResult<GameState> {
  const sanitizedRulesText = sanitizePlainText(nextRulesText, { allowNewLines: true, maxLength: 4000 });
  const parsed = rulesSchema.safeParse(sanitizedRulesText);
  if (!parsed.success) {
    return { ok: false, error: 'Rules text must be 4000 characters or fewer.' };
  }

  const cloned = cloneGame(game);
  cloned.rulesText = parsed.data;
  touchUpdatedAt(cloned);

  return { ok: true, value: cloned };
}

function isAllowedYouTubeHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'youtube.com' ||
    host === 'www.youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtu.be' ||
    host === 'www.youtu.be'
  );
}

export function isValidYouTubeUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && isAllowedYouTubeHost(parsed.hostname);
  } catch {
    return false;
  }
}

export function setSideVideoUrl(game: GameState, nextUrl: string | null): MutationResult<GameState> {
  const trimmed = nextUrl?.trim() ?? '';
  const normalized = trimmed ? trimmed : null;
  const parsedUrl = sideVideoUrlSchema.safeParse(normalized);
  if (!parsedUrl.success) {
    return { ok: false, error: 'Video URL must be a valid URL.' };
  }

  if (parsedUrl.data && !isValidYouTubeUrl(parsedUrl.data)) {
    return { ok: false, error: 'Video URL must be a YouTube link.' };
  }

  const cloned = cloneGame(game);
  cloned.sideVideoUrl = parsedUrl.data;
  touchUpdatedAt(cloned);

  return { ok: true, value: cloned };
}

export function setPlayerImage(game: GameState, player: Player, nextImageUrl: string | null): MutationResult<GameState> {
  const parsedPlayer = playerSchema.safeParse(player);
  if (!parsedPlayer.success) {
    return { ok: false, error: 'Invalid player.' };
  }

  const normalizedImageRef = normalizeImageRef(nextImageUrl);
  const rawImage = nextImageUrl?.trim() ?? '';
  if (rawImage && !normalizedImageRef) {
    return { ok: false, error: 'Image URL must be HTTPS and end with png, jpg, jpeg, webp, or gif.' };
  }

  const cloned = cloneGame(game);
  cloned.playerImages[parsedPlayer.data] = normalizedImageRef;
  touchUpdatedAt(cloned);

  return { ok: true, value: cloned };
}

interface ParsedNopeAlternative {
  text: string;
  imageRef: string | null;
  timerSeconds: number | null;
  timerUnit: 'seconds' | 'minutes';
}

function parseNopeAlternativeInput(input: NopeAlternativeInput | null): MutationResult<ParsedNopeAlternative | null> {
  if (!input) {
    return { ok: true, value: null };
  }

  const sanitizedText = sanitizePlainText(input.text ?? '', { allowNewLines: true, maxLength: 4000 });
  const parsedText = nopeAlternativeTextSchema.safeParse(sanitizedText);
  if (!parsedText.success) {
    return { ok: false, error: 'Nope alternative text must be 4000 characters or fewer.' };
  }

  const normalizedImageRef = normalizeImageRef(input.imageRef);
  const rawImage = input.imageRef?.trim() ?? '';
  if (rawImage && !normalizedImageRef) {
    return { ok: false, error: 'Image URL must be HTTPS and end with png, jpg, jpeg, webp, or gif.' };
  }

  if (!parsedText.data && !normalizedImageRef) {
    return { ok: true, value: null };
  }

  const timerUnit: 'seconds' | 'minutes' = input.timerUnit === 'minutes' ? 'minutes' : 'seconds';
  let timerSeconds: number | null = null;
  if (input.timerSeconds != null) {
    if (!Number.isFinite(input.timerSeconds) || input.timerSeconds <= 0) {
      return { ok: false, error: 'Nope timer must be a positive number.' };
    }
    const rounded = Math.floor(input.timerSeconds);
    if (rounded > 60 * 60) {
      return { ok: false, error: 'Nope timer cannot exceed 60 minutes.' };
    }
    timerSeconds = rounded;
  }

  return {
    ok: true,
    value: {
      text: parsedText.data,
      imageRef: normalizedImageRef,
      timerSeconds,
      timerUnit
    }
  };
}

interface ParsedSecondStep {
  text: string;
  imageRef: string | null;
  timerSeconds: number | null;
  timerUnit: 'seconds' | 'minutes';
}

function parseSecondStepInput(input: SecondStepInput | null): MutationResult<ParsedSecondStep | null> {
  if (!input) {
    return { ok: true, value: null };
  }

  const sanitizedText = sanitizePlainText(input.text ?? '', { allowNewLines: true, maxLength: 4000 });
  const parsedText = nopeAlternativeTextSchema.safeParse(sanitizedText);
  if (!parsedText.success) {
    return { ok: false, error: 'Step 2 text must be 4000 characters or fewer.' };
  }

  const normalizedImageRef = normalizeImageRef(input.imageRef);
  const rawImage = input.imageRef?.trim() ?? '';
  if (rawImage && !normalizedImageRef) {
    return { ok: false, error: 'Image URL must be HTTPS and end with png, jpg, jpeg, webp, or gif.' };
  }

  if (!parsedText.data && !normalizedImageRef) {
    return { ok: true, value: null };
  }

  const timerUnit: 'seconds' | 'minutes' = input.timerUnit === 'minutes' ? 'minutes' : 'seconds';
  let timerSeconds: number | null = null;
  if (input.timerSeconds != null) {
    if (!Number.isFinite(input.timerSeconds) || input.timerSeconds <= 0) {
      return { ok: false, error: 'Step 2 timer must be a positive number.' };
    }
    const rounded = Math.floor(input.timerSeconds);
    if (rounded > 60 * 60) {
      return { ok: false, error: 'Step 2 timer cannot exceed 60 minutes.' };
    }
    timerSeconds = rounded;
  }

  return {
    ok: true,
    value: {
      text: parsedText.data,
      imageRef: normalizedImageRef,
      timerSeconds,
      timerUnit
    }
  };
}

export function setRoundRandomAction(game: GameState, roundNumber: number, index: number, input: RandomActionInput): MutationResult<GameState> {
  const roundIndex = findRoundIndex(game, roundNumber);
  if (roundIndex < 0) {
    return { ok: false, error: `Round ${roundNumber} does not exist.` };
  }

  const expectedCount = randomActionCountForRound(roundNumber);
  const parsedIndex = randomActionIndexSchema.safeParse(index);
  if (!parsedIndex.success || parsedIndex.data >= expectedCount) {
    return { ok: false, error: 'Random action index is out of range.' };
  }

  const sanitizedText = sanitizePlainText(input.text, { allowNewLines: true, maxLength: 4000 });
  const parsedText = randomActionTextSchema.safeParse(sanitizedText);
  if (!parsedText.success) {
    return { ok: false, error: 'Random action text must be 4000 characters or fewer.' };
  }

  const normalizedImageRef = normalizeImageRef(input.imageRef);
  const rawImage = input.imageRef?.trim() ?? '';
  if (rawImage && !normalizedImageRef) {
    return { ok: false, error: 'Image URL must be HTTPS and end with png, jpg, jpeg, webp, or gif.' };
  }

  const normalizedLinkUrl = input.linkUrl?.trim() ? input.linkUrl.trim() : null;
  const parsedLink = randomActionLinkSchema.safeParse(normalizedLinkUrl);
  if (!parsedLink.success) {
    return { ok: false, error: 'Link URL must be a valid URL.' };
  }

  if (!parsedText.data && !normalizedImageRef && !parsedLink.data) {
    return { ok: false, error: 'Random actions require text, image, or a valid link URL.' };
  }

  const parsedNope = parseNopeAlternativeInput(input.nopeAlternative);
  if (!parsedNope.ok) {
    return { ok: false, error: parsedNope.error };
  }

  const parsedSecondStep = parseSecondStepInput(input.secondStep);
  if (!parsedSecondStep.ok) {
    return { ok: false, error: parsedSecondStep.error };
  }

  const parsedAssignedPlayer = assignedPlayerSchema.safeParse(input.assignedPlayer);
  if (!parsedAssignedPlayer.success) {
    return { ok: false, error: 'Assigned player must be "any", "P1", or "P2".' };
  }

  const timerUnit: 'seconds' | 'minutes' = input.timerUnit === 'minutes' ? 'minutes' : 'seconds';
  let timerSeconds: number | null = null;
  if (input.timerSeconds != null) {
    if (!Number.isFinite(input.timerSeconds) || input.timerSeconds <= 0) {
      return { ok: false, error: 'Random action timer must be a positive number.' };
    }
    const rounded = Math.floor(input.timerSeconds);
    if (rounded > 60 * 60) {
      return { ok: false, error: 'Random action timer cannot exceed 60 minutes.' };
    }
    timerSeconds = rounded;
  }

  const cloned = cloneGame(game);
  if (!Array.isArray(cloned.rounds[roundIndex].randomActions) || cloned.rounds[roundIndex].randomActions.length !== expectedCount) {
    cloned.rounds[roundIndex].randomActions = Array.from({ length: expectedCount }, (_, actionIndex) => ({
      text: `Round ${roundNumber} random action ${actionIndex + 1}`,
      imageRef: null,
      linkUrl: null,
      assignedPlayer: 'any',
      timerSeconds: null,
      timerUnit: 'seconds',
      secondStep: null,
      nopeAlternative: null
    }));
  }
  cloned.rounds[roundIndex].randomActions[parsedIndex.data] = {
    text: parsedText.data,
    imageRef: normalizedImageRef,
    linkUrl: parsedLink.data,
    assignedPlayer: parsedAssignedPlayer.data,
    timerSeconds,
    timerUnit,
    secondStep: parsedSecondStep.value ?? null,
    nopeAlternative: parsedNope.value ?? null
  };
  touchUpdatedAt(cloned);

  return { ok: true, value: cloned };
}

export function setResultInfoText(game: GameState, nextText: string): MutationResult<GameState> {
  const sanitized = sanitizePlainText(nextText ?? '', { allowNewLines: true, maxLength: 280 });
  const parsed = resultInfoTextSchema.safeParse(sanitized);
  if (!parsed.success) {
    return { ok: false, error: 'Result info text must be 280 characters or fewer.' };
  }

  const cloned = cloneGame(game);
  cloned.resultInfoText = parsed.data;
  touchUpdatedAt(cloned);

  return { ok: true, value: cloned };
}

export function setAudioMuted(game: GameState, muted: boolean): MutationResult<GameState> {
  const cloned = cloneGame(game);
  cloned.audioSettings.muted = Boolean(muted);
  touchUpdatedAt(cloned);
  return { ok: true, value: cloned };
}

export function setAudioVolume(game: GameState, volume: number): MutationResult<GameState> {
  const parsed = audioVolumeSchema.safeParse(volume);
  if (!parsed.success) {
    return { ok: false, error: 'Audio volume must be between 0 and 1.' };
  }

  const cloned = cloneGame(game);
  cloned.audioSettings.volume = parsed.data;
  touchUpdatedAt(cloned);
  return { ok: true, value: cloned };
}

export function setAudioTrackUrl(
  game: GameState,
  track: 'timerEndAudioRef' | 'roundIntroAudioRef' | 'randomActionAudioRef',
  nextUrl: string | null
): MutationResult<GameState> {
  const normalized = nextUrl?.trim() ? nextUrl.trim() : null;
  const parsed = audioUrlSchema.safeParse(normalized);
  if (!parsed.success) {
    return { ok: false, error: 'Audio URL must be a valid URL.' };
  }

  const cloned = cloneGame(game);
  cloned.audioSettings[track] = parsed.data;
  touchUpdatedAt(cloned);
  return { ok: true, value: cloned };
}

export function renameRound(game: GameState, roundNumber: number, nextName: string): MutationResult<GameState> {
  const sanitizedName = sanitizePlainText(nextName, { maxLength: 80 });
  const parsed = roundNameSchema.safeParse(sanitizedName);
  if (!parsed.success) {
    return { ok: false, error: 'Round name must be 80 characters or fewer.' };
  }

  const roundIndex = findRoundIndex(game, roundNumber);
  if (roundIndex < 0) {
    return { ok: false, error: `Round ${roundNumber} does not exist.` };
  }

  const cloned = cloneGame(game);
  const fallbackName = `Round ${roundNumber}`;
  cloned.rounds[roundIndex].name = parsed.data || fallbackName;
  touchUpdatedAt(cloned);

  return { ok: true, value: cloned };
}

export function setRoundIntro(game: GameState, roundNumber: number, introText: string, introImageUrl: string | null): MutationResult<GameState> {
  const roundIndex = findRoundIndex(game, roundNumber);
  if (roundIndex < 0) {
    return { ok: false, error: `Round ${roundNumber} does not exist.` };
  }

  const sanitizedText = sanitizePlainText(introText, { maxLength: 220 });
  const parsedText = roundIntroTextSchema.safeParse(sanitizedText);
  if (!parsedText.success) {
    return { ok: false, error: 'Round intro text must be 220 characters or fewer.' };
  }

  const normalizedImageRef = normalizeImageRef(introImageUrl);
  const rawImage = introImageUrl?.trim() ?? '';
  if (rawImage && !normalizedImageRef) {
    return { ok: false, error: 'Image URL must be HTTPS and end with png, jpg, jpeg, webp, or gif.' };
  }

  const cloned = cloneGame(game);
  cloned.rounds[roundIndex].introText = parsedText.data || `Welcome to ${cloned.rounds[roundIndex].name}.`;
  cloned.rounds[roundIndex].introImageRef = normalizedImageRef;
  touchUpdatedAt(cloned);

  return { ok: true, value: cloned };
}

export function addRound(game: GameState): MutationResult<GameState> {
  if (game.rounds.length >= MAX_ROUNDS) {
    return { ok: false, error: `Maximum of ${MAX_ROUNDS} rounds reached.` };
  }

  const cloned = cloneGame(game);
  const previousRound = cloned.rounds[cloned.rounds.length - 1];
  const nextRoundNumber = previousRound.roundNumber + 1;

  const cloneSpinnerEntries = (entries: SpinnerEntry[]): SpinnerEntry[] =>
    entries.map((entry) => ({
      id: crypto.randomUUID(),
      text: entry.text,
      imageRef: normalizeImageRef(entry.imageRef)
    }));

  cloned.rounds.push({
    roundNumber: nextRoundNumber,
    name: `Round ${nextRoundNumber}`,
    mode: roundModeForRound(nextRoundNumber),
    quotaPerPlayer: ROUND_QUOTAS[nextRoundNumber - 1],
    totalTurns: totalTurnsForRound(nextRoundNumber),
    introText: `Welcome to Round ${nextRoundNumber}. Keep the energy high and enjoy the game.`,
    introImageRef: null,
    randomActions: Array.from({ length: randomActionCountForRound(nextRoundNumber) }, (_, actionIndex) => ({
      text: `Round ${nextRoundNumber} random action ${actionIndex + 1}`,
      imageRef: null,
      linkUrl: null,
      assignedPlayer: 'any',
      timerSeconds: null,
      timerUnit: 'seconds',
      secondStep: null,
      nopeAlternative: null
    })),
    spinners: {
      part: cloneSpinnerEntries(previousRound.spinners.part),
      action: cloneSpinnerEntries(previousRound.spinners.action),
      timer: cloneSpinnerEntries(previousRound.spinners.timer)
    }
  });

  ensureTurnCounter(cloned, nextRoundNumber);
  touchUpdatedAt(cloned);

  return { ok: true, value: cloned };
}

export function addSpinnerEntry(
  game: GameState,
  roundNumber: number,
  spinnerType: SpinnerType,
  input: SpinnerEntryInput
): MutationResult<GameState> {
  const parsedInput = parseSpinnerEntryInput(input);
  if (!parsedInput.ok) {
    return { ok: false, error: parsedInput.error };
  }

  const roundIndex = findRoundIndex(game, roundNumber);
  if (roundIndex < 0) {
    return { ok: false, error: `Round ${roundNumber} does not exist.` };
  }

  const cloned = cloneGame(game);
  cloned.rounds[roundIndex].spinners[spinnerType].push({
    id: crypto.randomUUID(),
    text: parsedInput.value?.text ?? '',
    imageRef: parsedInput.value?.imageRef ?? null
  });
  touchUpdatedAt(cloned);

  return { ok: true, value: cloned };
}

export function updateSpinnerEntry(
  game: GameState,
  roundNumber: number,
  spinnerType: SpinnerType,
  entryId: string,
  input: SpinnerEntryInput
): MutationResult<GameState> {
  const parsedEntryId = spinnerEntryIdSchema.safeParse(entryId);
  if (!parsedEntryId.success) {
    return { ok: false, error: 'Spinner entry id is required.' };
  }

  const parsedInput = parseSpinnerEntryInput(input);
  if (!parsedInput.ok) {
    return { ok: false, error: parsedInput.error };
  }

  const roundIndex = findRoundIndex(game, roundNumber);
  if (roundIndex < 0) {
    return { ok: false, error: `Round ${roundNumber} does not exist.` };
  }

  const cloned = cloneGame(game);
  const entry = cloned.rounds[roundIndex].spinners[spinnerType].find((candidate) => candidate.id === entryId);
  if (!entry) {
    return { ok: false, error: 'Spinner entry was not found.' };
  }

  entry.text = parsedInput.value?.text ?? '';
  entry.imageRef = parsedInput.value?.imageRef ?? null;
  touchUpdatedAt(cloned);

  return { ok: true, value: cloned };
}

export function deleteSpinnerEntry(
  game: GameState,
  roundNumber: number,
  spinnerType: SpinnerType,
  entryId: string
): MutationResult<GameState> {
  const parsedEntryId = spinnerEntryIdSchema.safeParse(entryId);
  if (!parsedEntryId.success) {
    return { ok: false, error: 'Spinner entry id is required.' };
  }

  const roundIndex = findRoundIndex(game, roundNumber);
  if (roundIndex < 0) {
    return { ok: false, error: `Round ${roundNumber} does not exist.` };
  }

  const cloned = cloneGame(game);
  const nextEntries = cloned.rounds[roundIndex].spinners[spinnerType].filter((entry) => entry.id !== entryId);
  if (nextEntries.length === cloned.rounds[roundIndex].spinners[spinnerType].length) {
    return { ok: false, error: 'Spinner entry was not found.' };
  }

  cloned.rounds[roundIndex].spinners[spinnerType] = nextEntries;
  touchUpdatedAt(cloned);

  return { ok: true, value: cloned };
}

export function isValidSpinnerImageUrl(url: string): boolean {
  return isHttpsImageUrl(url.trim());
}

export function isValidAudioUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
