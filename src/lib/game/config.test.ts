import { addRound, addSpinnerEntry, renameRound, setRulesText, updateSpinnerEntry } from './config';
import { createDefaultGameState } from './default-state';
import { MAX_ROUNDS, ROUND_QUOTAS } from './types';

describe('config mutations', () => {
  test('blocks adding rounds beyond max when defaults already fill the array', () => {
    const state = createDefaultGameState();
    expect(state.rounds.length).toBe(MAX_ROUNDS);
    const blocked = addRound(state);
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toContain(`Maximum of ${MAX_ROUNDS} rounds`);
  });

  test('default rounds carry the configured quotas', () => {
    const state = createDefaultGameState();
    state.rounds.forEach((round, index) => {
      expect(round.quotaPerPlayer).toBe(ROUND_QUOTAS[index]);
    });
  });

  test('requires https image urls with allowed image extensions', () => {
    const state = createDefaultGameState();
    const invalid = addSpinnerEntry(state, 1, 'part', {
      text: 'Should fail',
      imageRef: 'http://example.com/not-safe.png'
    });
    expect(invalid.ok).toBe(false);

    const valid = addSpinnerEntry(state, 1, 'part', {
      text: '',
      imageRef: 'https://example.com/safe.webp'
    });
    expect(valid.ok).toBe(true);
  });

  test('requires spinner entries to include text or valid image', () => {
    const state = createDefaultGameState();
    const result = addSpinnerEntry(state, 1, 'action', {
      text: '   ',
      imageRef: null
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('require text or a valid image URL');
  });

  test('defaults empty round names to generated label', () => {
    const state = createDefaultGameState();
    const result = renameRound(state, 2, '   ');

    expect(result.ok).toBe(true);
    if (!result.ok || !result.value) {
      return;
    }

    expect(result.value.rounds[1].name).toBe('Round 2');
  });

  test('updates spinner entry while preserving validation', () => {
    const state = createDefaultGameState();
    const created = addSpinnerEntry(state, 1, 'timer', {
      text: '15 sec',
      imageRef: null
    });
    expect(created.ok).toBe(true);
    if (!created.ok || !created.value) {
      return;
    }

    const entryId = created.value.rounds[0].spinners.timer[0].id;
    const updated = updateSpinnerEntry(created.value, 1, 'timer', entryId, {
      text: '30 sec',
      imageRef: 'https://example.com/timer.gif'
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok || !updated.value) {
      return;
    }

    expect(updated.value.rounds[0].spinners.timer[0].text).toBe('30 sec');
    expect(updated.value.rounds[0].spinners.timer[0].imageRef).toBe('https://example.com/timer.gif');
  });

  test('supports free-text rules updates with size limits', () => {
    const state = createDefaultGameState();
    const rules = '<b>Rule 1:</b> Alternate turns.';
    const validResult = setRulesText(state, rules);
    expect(validResult.ok).toBe(true);
    if (validResult.ok && validResult.value) {
      expect(validResult.value.rulesText).toBe('bRule 1:/b Alternate turns.');
    }

    const tooLong = setRulesText(state, 'x'.repeat(4001));
    expect(tooLong.ok).toBe(true);
    if (tooLong.ok && tooLong.value) {
      expect(tooLong.value.rulesText).toHaveLength(4000);
    }
  });
});
