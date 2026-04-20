'use client';

import { create } from 'zustand';
import {
  addRound,
  addSpinnerEntry,
  deleteSpinnerEntry,
  NopeAlternativeInput,
  renameRound,
  SecondStepInput,
  setAudioMuted,
  setAudioTrackUrl,
  setAudioVolume,
  setPlayerImage,
  setResultInfoText,
  setRoundRandomAction,
  setRoundIntro,
  setRulesText,
  setSideVideoUrl,
  updateSpinnerEntry
} from './config';
import { createDefaultGameState } from './default-state';
import { executeSpin } from './engine';
import { HydrationResult, loadPersistedState, persistState, validateGameState } from './persistence';
import { queueSpinTelemetryEvent } from './telemetry';
import { GameState, Player, RandomActionAssignedPlayer, SpinOutcome, SpinnerType } from './types';

const SAVE_DEBOUNCE_MS = 300;

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface GameStoreState {
  game: GameState;
  saveStatus: SaveStatus;
  recoveryNotice: string | null;
  spinError: string | null;
  dashboardError: string | null;
  hydrateFromCloud: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  spin: (player: Player) => SpinOutcome;
  advanceActionTurn: (player: Player) => void;
  restartGame: () => void;
  clearDashboardError: () => void;
  updateRulesText: (rulesText: string) => boolean;
  updateResultInfoText: (text: string) => boolean;
  markRandomInstructionDone: (roundNumber: number, actionIndex: number) => void;
  updateSideVideoUrl: (videoUrl: string | null) => boolean;
  updateAudioMuted: (muted: boolean) => boolean;
  updateAudioVolume: (volume: number) => boolean;
  updateAudioTrackUrl: (track: 'timerEndAudioRef' | 'roundIntroAudioRef' | 'randomActionAudioRef', url: string | null) => boolean;
  updatePlayerImage: (player: Player, imageUrl: string | null) => boolean;
  updateRoundRandomAction: (
    roundNumber: number,
    index: number,
    actionText: string,
    imageRef: string | null,
    linkUrl: string | null,
    assignedPlayer: RandomActionAssignedPlayer,
    timerSeconds: number | null,
    timerUnit: 'seconds' | 'minutes',
    secondStep: SecondStepInput | null,
    nopeAlternative: NopeAlternativeInput | null
  ) => boolean;
  updateRoundName: (roundNumber: number, name: string) => boolean;
  updateRoundIntro: (roundNumber: number, introText: string, introImageRef: string | null) => boolean;
  addRound: () => boolean;
  addSpinnerEntry: (roundNumber: number, spinnerType: SpinnerType, text: string, imageRef: string | null) => boolean;
  updateSpinnerEntry: (
    roundNumber: number,
    spinnerType: SpinnerType,
    entryId: string,
    text: string,
    imageRef: string | null
  ) => boolean;
  deleteSpinnerEntry: (roundNumber: number, spinnerType: SpinnerType, entryId: string) => boolean;
  resetToDefault: (reason: string) => void;
}

function getStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function getHydratedState(): HydrationResult {
  return loadPersistedState(getStorage());
}

async function persistCloudState(state: GameState): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    await fetch('/api/game-state', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ state })
    });
  } catch {
    // Local persistence still succeeds; cloud sync can retry on next save.
  }
}

async function loadCloudState(): Promise<GameState | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const response = await fetch('/api/game-state', {
      method: 'GET',
      cache: 'no-store'
    });
    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as { state?: unknown };
    return validateGameState(body.state);
  } catch {
    return null;
  }
}

function cloneGame(game: GameState): GameState {
  return JSON.parse(JSON.stringify(game)) as GameState;
}

function buildResetTurnCounters(game: GameState): GameState['session']['turnCounters'] {
  const counters: GameState['session']['turnCounters'] = {};
  game.rounds.forEach((round) => {
    counters[String(round.roundNumber)] = { P1: 0, P2: 0 };
  });
  return counters;
}

export const useGameStore = create<GameStoreState>((set, get) => {
  const hydrated = getHydratedState();
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  let cloudHydrated = false;
  let cloudHydrationInFlight = false;

  const queuePersist = (nextGame: GameState) => {
    set({ saveStatus: 'saving' });

    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(() => {
      try {
        persistState(getStorage(), nextGame);
        void persistCloudState(nextGame);
        set({ saveStatus: 'saved' });
      } catch {
        set({ saveStatus: 'error' });
      }
    }, SAVE_DEBOUNCE_MS);
  };

  const commit = (nextGame: GameState, spinError: string | null = null, dashboardError: string | null = null) => {
    set({ game: nextGame, spinError, dashboardError });
    queuePersist(nextGame);
  };

  if (hydrated.wasRecovered) {
    persistState(getStorage(), hydrated.state);
  }

  return {
    game: hydrated.state,
    saveStatus: 'idle',
    recoveryNotice: hydrated.recoveryReason,
    spinError: null,
    dashboardError: null,
    hydrateFromCloud: async () => {
      if (cloudHydrated || cloudHydrationInFlight) {
        return;
      }

      cloudHydrationInFlight = true;
      try {
        const cloudState = await loadCloudState();
        if (!cloudState) {
          return;
        }

        const localUpdatedAt = Date.parse(get().game.session.updatedAt);
        const cloudUpdatedAt = Date.parse(cloudState.session.updatedAt);
        if (Number.isFinite(localUpdatedAt) && Number.isFinite(cloudUpdatedAt) && localUpdatedAt > cloudUpdatedAt) {
          return;
        }

        persistState(getStorage(), cloudState);
        set({ game: cloudState, saveStatus: 'saved', spinError: null, dashboardError: null });
      } finally {
        cloudHydrated = true;
        cloudHydrationInFlight = false;
      }
    },
    pause: () => {
      const cloned = cloneGame(get().game);
      cloned.session.isPaused = true;
      cloned.session.updatedAt = new Date().toISOString();
      commit(cloned);
    },
    resume: () => {
      const cloned = cloneGame(get().game);
      cloned.session.isPaused = false;
      cloned.session.updatedAt = new Date().toISOString();
      commit(cloned);
    },
    spin: (player: Player) => {
      const cloned = cloneGame(get().game);
      const playedRoundNumber = cloned.session.currentRoundNumber;
      const outcome = executeSpin(cloned, player);

      if (!outcome.ok) {
        const reasonMessage = outcome.reason === 'PAUSED' ? 'Game is paused. Resume to spin.' : 'It is not this player turn.';
        set({ spinError: reasonMessage });
        return outcome;
      }

      commit(cloned, null);
      queueSpinTelemetryEvent({
        player,
        roundNumber: playedRoundNumber,
        partText: outcome.result.part?.text ?? null,
        actionText: outcome.result.action.text,
        timerText: outcome.result.timer.text,
        createdAt: cloned.session.updatedAt
      });
      return outcome;
    },
    advanceActionTurn: (player: Player) => {
      const state = get().game;
      if (state.session.isPaused) {
        set({ spinError: 'Game is paused. Resume to continue.' });
        return;
      }
      if (player !== state.session.activePlayer) {
        set({ spinError: 'It is not this player turn.' });
        return;
      }

      const cloned = cloneGame(state);
      const round = cloned.rounds.find((candidate) => candidate.roundNumber === cloned.session.currentRoundNumber);
      if (!round) {
        return;
      }

      const key = String(round.roundNumber);
      if (!cloned.session.turnCounters[key]) {
        cloned.session.turnCounters[key] = { P1: 0, P2: 0 };
      }
      cloned.session.turnCounters[key][player] += 1;

      const counters = cloned.session.turnCounters[key];
      const totalTurnsTaken = counters.P1 + counters.P2;
      const totalLimit = round.totalTurns > 0 ? round.totalTurns : round.quotaPerPlayer * 2;
      const quotaMet = totalTurnsTaken >= totalLimit;
      let roundAdvanced = false;
      if (quotaMet) {
        const currentIndex = cloned.rounds.findIndex((candidate) => candidate.roundNumber === round.roundNumber);
        const hasNextRound = currentIndex >= 0 && currentIndex < cloned.rounds.length - 1;
        if (hasNextRound) {
          const nextRound = cloned.rounds[currentIndex + 1];
          cloned.session.currentRoundNumber = nextRound.roundNumber;
          const nextKey = String(nextRound.roundNumber);
          if (!cloned.session.turnCounters[nextKey]) {
            cloned.session.turnCounters[nextKey] = { P1: 0, P2: 0 };
          }
          roundAdvanced = true;
        }
      }

      cloned.session.activePlayer = roundAdvanced ? 'P1' : player === 'P1' ? 'P2' : 'P1';
      cloned.session.updatedAt = new Date().toISOString();
      commit(cloned, null);
    },
    restartGame: () => {
      const cloned = cloneGame(get().game);
      const firstRoundNumber = cloned.rounds[0]?.roundNumber ?? 1;
      cloned.session = {
        isPaused: false,
        activePlayer: 'P1',
        currentRoundNumber: firstRoundNumber,
        turnCounters: buildResetTurnCounters(cloned),
        completedRandomInstructions: {},
        lastTurnByPlayer: {
          P1: null,
          P2: null
        },
        lastSpinResult: null,
        updatedAt: new Date().toISOString()
      };
      commit(cloned, null, get().dashboardError);
    },
    clearDashboardError: () => {
      set({ dashboardError: null });
    },
    updateRulesText: (rulesText: string) => {
      const result = setRulesText(get().game, rulesText);
      if (!result.ok || !result.value) {
        set({ dashboardError: result.error ?? 'Failed to update rules.' });
        return false;
      }

      commit(result.value, get().spinError, null);
      return true;
    },
    updateSideVideoUrl: (videoUrl: string | null) => {
      const result = setSideVideoUrl(get().game, videoUrl);
      if (!result.ok || !result.value) {
        set({ dashboardError: result.error ?? 'Failed to update side video URL.' });
        return false;
      }

      commit(result.value, get().spinError, null);
      return true;
    },
    updateAudioMuted: (muted: boolean) => {
      const result = setAudioMuted(get().game, muted);
      if (!result.ok || !result.value) {
        set({ dashboardError: result.error ?? 'Failed to update mute state.' });
        return false;
      }

      commit(result.value, get().spinError, null);
      return true;
    },
    updateAudioVolume: (volume: number) => {
      const result = setAudioVolume(get().game, volume);
      if (!result.ok || !result.value) {
        set({ dashboardError: result.error ?? 'Failed to update volume.' });
        return false;
      }

      commit(result.value, get().spinError, null);
      return true;
    },
    updateAudioTrackUrl: (track: 'timerEndAudioRef' | 'roundIntroAudioRef' | 'randomActionAudioRef', url: string | null) => {
      const result = setAudioTrackUrl(get().game, track, url);
      if (!result.ok || !result.value) {
        set({ dashboardError: result.error ?? 'Failed to update audio URL.' });
        return false;
      }

      commit(result.value, get().spinError, null);
      return true;
    },
    updatePlayerImage: (player: Player, imageUrl: string | null) => {
      const result = setPlayerImage(get().game, player, imageUrl);
      if (!result.ok || !result.value) {
        set({ dashboardError: result.error ?? 'Failed to update player image.' });
        return false;
      }

      commit(result.value, get().spinError, null);
      return true;
    },
    updateRoundRandomAction: (
      roundNumber: number,
      index: number,
      actionText: string,
      imageRef: string | null,
      linkUrl: string | null,
      assignedPlayer: RandomActionAssignedPlayer,
      timerSeconds: number | null,
      timerUnit: 'seconds' | 'minutes',
      secondStep: SecondStepInput | null,
      nopeAlternative: NopeAlternativeInput | null
    ) => {
      const result = setRoundRandomAction(get().game, roundNumber, index, {
        text: actionText,
        imageRef,
        linkUrl,
        assignedPlayer,
        timerSeconds,
        timerUnit,
        secondStep,
        nopeAlternative
      });
      if (!result.ok || !result.value) {
        set({ dashboardError: result.error ?? 'Failed to update round random action.' });
        return false;
      }

      commit(result.value, get().spinError, null);
      return true;
    },
    updateResultInfoText: (text: string) => {
      const result = setResultInfoText(get().game, text);
      if (!result.ok || !result.value) {
        set({ dashboardError: result.error ?? 'Failed to update result info text.' });
        return false;
      }

      commit(result.value, get().spinError, null);
      return true;
    },
    markRandomInstructionDone: (roundNumber: number, actionIndex: number) => {
      if (!Number.isInteger(roundNumber) || !Number.isInteger(actionIndex) || actionIndex < 0) {
        return;
      }
      const cloned = cloneGame(get().game);
      const key = String(roundNumber);
      const existing = cloned.session.completedRandomInstructions?.[key] ?? [];
      if (existing.includes(actionIndex)) {
        return;
      }
      cloned.session.completedRandomInstructions = {
        ...cloned.session.completedRandomInstructions,
        [key]: [...existing, actionIndex]
      };
      cloned.session.updatedAt = new Date().toISOString();
      commit(cloned, get().spinError, get().dashboardError);
    },
    updateRoundName: (roundNumber: number, name: string) => {
      const result = renameRound(get().game, roundNumber, name);
      if (!result.ok || !result.value) {
        set({ dashboardError: result.error ?? 'Failed to rename round.' });
        return false;
      }

      commit(result.value, get().spinError, null);
      return true;
    },
    updateRoundIntro: (roundNumber: number, introText: string, introImageRef: string | null) => {
      const result = setRoundIntro(get().game, roundNumber, introText, introImageRef);
      if (!result.ok || !result.value) {
        set({ dashboardError: result.error ?? 'Failed to update round intro.' });
        return false;
      }

      commit(result.value, get().spinError, null);
      return true;
    },
    addRound: () => {
      const result = addRound(get().game);
      if (!result.ok || !result.value) {
        set({ dashboardError: result.error ?? 'Failed to add round.' });
        return false;
      }

      commit(result.value, get().spinError, null);
      return true;
    },
    addSpinnerEntry: (roundNumber: number, spinnerType: SpinnerType, text: string, imageRef: string | null) => {
      const result = addSpinnerEntry(get().game, roundNumber, spinnerType, {
        text,
        imageRef
      });

      if (!result.ok || !result.value) {
        set({ dashboardError: result.error ?? 'Failed to add spinner entry.' });
        return false;
      }

      commit(result.value, get().spinError, null);
      return true;
    },
    updateSpinnerEntry: (roundNumber: number, spinnerType: SpinnerType, entryId: string, text: string, imageRef: string | null) => {
      const result = updateSpinnerEntry(get().game, roundNumber, spinnerType, entryId, {
        text,
        imageRef
      });

      if (!result.ok || !result.value) {
        set({ dashboardError: result.error ?? 'Failed to update spinner entry.' });
        return false;
      }

      commit(result.value, get().spinError, null);
      return true;
    },
    deleteSpinnerEntry: (roundNumber: number, spinnerType: SpinnerType, entryId: string) => {
      const result = deleteSpinnerEntry(get().game, roundNumber, spinnerType, entryId);

      if (!result.ok || !result.value) {
        set({ dashboardError: result.error ?? 'Failed to delete spinner entry.' });
        return false;
      }

      commit(result.value, get().spinError, null);
      return true;
    },
    resetToDefault: (reason: string) => {
      const defaultState = createDefaultGameState();
      set({
        game: defaultState,
        recoveryNotice: reason,
        spinError: null,
        dashboardError: null
      });
      queuePersist(defaultState);
    }
  };
});
