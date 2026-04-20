import { createDefaultGameState } from './default-state';
import { loadPersistedState, persistState, validateGameState } from './persistence';
import { STORAGE_KEY } from './types';

describe('persistence', () => {
  test('validates default state', () => {
    const valid = validateGameState(createDefaultGameState());
    expect(valid).not.toBeNull();
  });

  test('resets deterministically when persisted state is corrupted json', () => {
    localStorage.setItem(STORAGE_KEY, '{broken json');

    const hydrated = loadPersistedState(localStorage);

    expect(hydrated.wasRecovered).toBe(true);
    expect(hydrated.state).toEqual(createDefaultGameState());
  });

  test('round-trips persisted state', () => {
    const state = createDefaultGameState();
    state.session.activePlayer = 'P2';

    persistState(localStorage, state);

    const hydrated = loadPersistedState(localStorage);
    expect(hydrated.wasRecovered).toBe(false);
    expect(hydrated.state.session.activePlayer).toBe('P2');
  });
});
