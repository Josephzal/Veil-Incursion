/**
 * Run: npx tsx --test src/utils/combatTurnOrderWindow.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  TURN_ORDER_WINDOW_SIZE,
  resolveTurnOrderEmphasis,
  resolveTurnOrderOpacity,
  windowTurnOrderEntries,
} from './combatTurnOrderWindow';

const entry = (id: string, state: string) => ({ id, state });

describe('combatTurnOrderWindow', () => {
  it('renders short rosters whole without duplicating actors', () => {
    const entries = [entry('operative', 'active'), entry('h1', 'queued')];
    assert.deepEqual(windowTurnOrderEntries(entries), entries);
  });

  it('shows the current actor plus the next three', () => {
    const entries = [
      entry('operative', 'waiting'),
      entry('h1', 'queued'),
      entry('h2', 'active'),
      entry('h3', 'queued'),
      entry('h4', 'queued'),
      entry('h5', 'waiting'),
    ];
    const windowed = windowTurnOrderEntries(entries);
    assert.equal(windowed.length, TURN_ORDER_WINDOW_SIZE);
    assert.deepEqual(windowed.map((e) => e.id), ['h2', 'h3', 'h4', 'h5']);
  });

  it('wraps past the end of the sequence to keep the window size stable', () => {
    const entries = [
      entry('operative', 'waiting'),
      entry('h1', 'waiting'),
      entry('h2', 'waiting'),
      entry('h3', 'waiting'),
      entry('h4', 'active'),
    ];
    const windowed = windowTurnOrderEntries(entries);
    assert.equal(windowed.length, TURN_ORDER_WINDOW_SIZE);
    assert.deepEqual(windowed.map((e) => e.id), ['h4', 'operative', 'h1', 'h2']);
  });

  it('starts at the head when no actor is active', () => {
    const entries = [
      entry('operative', 'waiting'),
      entry('h1', 'queued'),
      entry('h2', 'queued'),
      entry('h3', 'queued'),
      entry('h4', 'queued'),
    ];
    assert.deepEqual(
      windowTurnOrderEntries(entries).map((e) => e.id),
      ['operative', 'h1', 'h2', 'h3'],
    );
  });

  it('ranks current, next and later actors', () => {
    assert.equal(
      resolveTurnOrderEmphasis({ state: 'active', indexInWindow: 0, hasCurrentActor: true }),
      'current',
    );
    assert.equal(
      resolveTurnOrderEmphasis({ state: 'queued', indexInWindow: 1, hasCurrentActor: true }),
      'next',
    );
    assert.equal(
      resolveTurnOrderEmphasis({ state: 'queued', indexInWindow: 2, hasCurrentActor: true }),
      'upcoming',
    );
    assert.equal(
      resolveTurnOrderEmphasis({ state: 'defeated', indexInWindow: 3, hasCurrentActor: true }),
      'inactive',
    );
  });

  it('fades later actors but keeps them legible', () => {
    assert.equal(resolveTurnOrderOpacity('current', 0), 1);
    assert.ok(resolveTurnOrderOpacity('upcoming', 3) >= 0.7);
    assert.ok(resolveTurnOrderOpacity('upcoming', 9) >= 0.7);
    assert.ok(resolveTurnOrderOpacity('next', 1) > resolveTurnOrderOpacity('upcoming', 2));
  });
});
