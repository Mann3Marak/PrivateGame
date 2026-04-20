import { createDefaultGameState } from './default-state';
import { executeSpin } from './engine';

describe('executeSpin', () => {
  test('blocks non-active player', () => {
    const state = createDefaultGameState();
    const outcome = executeSpin(state, 'P2');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('NOT_ACTIVE_PLAYER');
    }
  });

  test('blocks while paused', () => {
    const state = createDefaultGameState();
    state.session.isPaused = true;

    const outcome = executeSpin(state, 'P1');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('PAUSED');
    }
  });

  test('applies fallback labels when pools are empty and alternates player', () => {
    const state = createDefaultGameState();
    const outcome = executeSpin(state, 'P1');

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.part?.text).toBe('Part');
      expect(outcome.result.action.text).toBe('Action');
      expect(outcome.result.timer.text).toBe('Timer');
    }

    expect(state.session.activePlayer).toBe('P2');
    expect(state.session.turnCounters['1'].P1).toBe(1);
  });

  test('auto-advances when the round total-turn limit is reached', () => {
    const state = createDefaultGameState();
    state.rounds[0].quotaPerPlayer = 1;
    state.rounds[0].totalTurns = 2;

    executeSpin(state, 'P1', { randomIndex: () => 0, nowIso: () => '2026-03-16T00:00:00.000Z' });
    executeSpin(state, 'P2', { randomIndex: () => 0, nowIso: () => '2026-03-16T00:00:01.000Z' });

    expect(state.session.currentRoundNumber).toBe(2);
    expect(state.session.activePlayer).toBe('P1');
  });

  test('advances after an odd total-turns round ending on P1 and resets active player to P1', () => {
    const state = createDefaultGameState();
    state.rounds[0].quotaPerPlayer = 2;
    state.rounds[0].totalTurns = 3;

    executeSpin(state, 'P1', { randomIndex: () => 0 });
    executeSpin(state, 'P2', { randomIndex: () => 0 });
    executeSpin(state, 'P1', { randomIndex: () => 0 });

    expect(state.session.currentRoundNumber).toBe(2);
    expect(state.session.activePlayer).toBe('P1');
  });

  test('stays on final round indefinitely after quota completion', () => {
    const state = createDefaultGameState();
    const lastRoundNumber = state.rounds[state.rounds.length - 1].roundNumber;
    state.session.currentRoundNumber = lastRoundNumber;
    state.rounds[state.rounds.length - 1].quotaPerPlayer = 1;
    state.rounds[state.rounds.length - 1].totalTurns = 2;

    executeSpin(state, 'P1', { randomIndex: () => 0 });
    executeSpin(state, 'P2', { randomIndex: () => 0 });

    expect(state.session.currentRoundNumber).toBe(lastRoundNumber);
  });

  test('drops invalid image urls from spin result but keeps text', () => {
    const state = createDefaultGameState();
    state.rounds[0].spinners.part.push({
      id: 'entry-1',
      text: 'Arms',
      imageRef: 'javascript:alert(1)'
    });

    const outcome = executeSpin(state, 'P1', { randomIndex: () => 0 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }

    expect(outcome.result.part?.text).toBe('Arms');
    expect(outcome.result.part?.imageRef).toBeNull();
  });

  test('last round skips part spinner', () => {
    const state = createDefaultGameState();
    const lastRoundNumber = state.rounds[state.rounds.length - 1].roundNumber;
    state.session.currentRoundNumber = lastRoundNumber;

    const outcome = executeSpin(state, 'P1', { randomIndex: () => 0 });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.part).toBeUndefined();
      expect(outcome.result.action.text).toBe('Action');
      expect(outcome.result.timer.text).toBe('Timer');
    }
  });
});
