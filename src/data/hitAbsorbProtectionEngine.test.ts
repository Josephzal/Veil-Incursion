/**
 * Phase D.2 — Martyr / Juggernaut hit-absorb protection provenance + presentation.
 * Run: npx tsx src/data/hitAbsorbProtectionEngine.test.ts
 */
import assert from 'node:assert/strict';
import {
  absorbHitAbsorbProtection,
  armHitAbsorbProtection,
  clearHitAbsorbProtection,
  createDefaultHitAbsorbProtectionState,
  formatHitAbsorbProtectionAbsorbLog,
  formatHitAbsorbProtectionArmedLog,
  formatHitAbsorbProtectionStatusChip,
  hydrateHitAbsorbProtectionState,
  JUGGERNAUT_PROTECTION_HITS,
  MARTYR_PROTECTION_HITS,
  readHitAbsorbProtectionFromBoonEncounter,
  writeHitAbsorbProtectionToBoonEncounter,
} from './hitAbsorbProtectionEngine';
import { createDefaultBoonEncounterState } from '../types/boonHooks';

function visibleCharges(state: { hitsRemaining: number; source: string | null }): number {
  const chip = formatHitAbsorbProtectionStatusChip(state as never);
  if (!chip) return 0;
  const m = chip.label.match(/×(\d+)/);
  return m ? Number(m[1]) : 0;
}

// 1. MARTYR_GRAFT initializes two charges with Martyr provenance
{
  const empty = createDefaultHitAbsorbProtectionState();
  const { next, applied } = armHitAbsorbProtection(empty, 'MARTYR_GRAFT', MARTYR_PROTECTION_HITS);
  assert.equal(applied, true);
  assert.equal(next.hitsRemaining, 2);
  assert.equal(next.source, 'MARTYR_GRAFT');
  const chip = formatHitAbsorbProtectionStatusChip(next);
  assert.ok(chip);
  assert.equal(chip!.label, 'MARTYR ×2');
  assert.match(formatHitAbsorbProtectionArmedLog('MARTYR_GRAFT', next.hitsRemaining), /MARTYR/);
  assert.doesNotMatch(formatHitAbsorbProtectionArmedLog('MARTYR_GRAFT', next.hitsRemaining), /JUGGERNAUT/);
}

// 2. Visible/status representation reports two, then one, then zero
{
  let state = createDefaultHitAbsorbProtectionState();
  state = armHitAbsorbProtection(state, 'MARTYR_GRAFT', 2).next;
  assert.equal(visibleCharges(state), 2);

  let step = absorbHitAbsorbProtection(state);
  state = step.next;
  assert.equal(step.remaining, 1);
  assert.equal(visibleCharges(state), 1);
  assert.equal(formatHitAbsorbProtectionStatusChip(state)?.label, 'MARTYR ×1');

  step = absorbHitAbsorbProtection(state);
  state = step.next;
  assert.equal(step.remaining, 0);
  assert.equal(visibleCharges(state), 0);
  assert.equal(formatHitAbsorbProtectionStatusChip(state), null);
}

// 3. Log identifies Martyr for both absorbed hits
{
  let state = armHitAbsorbProtection(
    createDefaultHitAbsorbProtectionState(),
    'MARTYR_GRAFT',
    2,
  ).next;
  const first = absorbHitAbsorbProtection(state);
  assert.match(formatHitAbsorbProtectionAbsorbLog(first.source, first.remaining), /\[MARTYR\]/);
  assert.doesNotMatch(formatHitAbsorbProtectionAbsorbLog(first.source, first.remaining), /JUGGERNAUT|MARTYR SHIELD/);
  state = first.next;
  const second = absorbHitAbsorbProtection(state);
  assert.match(formatHitAbsorbProtectionAbsorbLog(second.source, second.remaining), /\[MARTYR\]/);
  assert.equal(second.remaining, 0);
}

// 4–5. JUGGERNAUT_PLATING uses own provenance / log; never labeled Martyr
{
  const { next, applied } = armHitAbsorbProtection(
    createDefaultHitAbsorbProtectionState(),
    'JUGGERNAUT_PLATING',
    JUGGERNAUT_PROTECTION_HITS,
  );
  assert.equal(applied, true);
  assert.equal(next.hitsRemaining, 1);
  assert.equal(next.source, 'JUGGERNAUT_PLATING');
  assert.equal(formatHitAbsorbProtectionStatusChip(next)?.label, 'JUGGERNAUT PLATING ×1');
  const armedLog = formatHitAbsorbProtectionArmedLog('JUGGERNAUT_PLATING', next.hitsRemaining);
  assert.match(armedLog, /JUGGERNAUT PLATING/);
  assert.doesNotMatch(armedLog, /MARTYR/);

  const absorbed = absorbHitAbsorbProtection(next);
  const absorbLog = formatHitAbsorbProtectionAbsorbLog(absorbed.source, absorbed.remaining);
  assert.match(absorbLog, /\[JUGGERNAUT PLATING\]/);
  assert.doesNotMatch(absorbLog, /MARTYR/);
}

// Juggernaut cannot overwrite a stronger Martyr counter; provenance stays Martyr
{
  let state = armHitAbsorbProtection(
    createDefaultHitAbsorbProtectionState(),
    'MARTYR_GRAFT',
    2,
  ).next;
  const offer = armHitAbsorbProtection(state, 'JUGGERNAUT_PLATING', 1);
  assert.equal(offer.applied, false);
  assert.equal(offer.next.hitsRemaining, 2);
  assert.equal(offer.next.source, 'MARTYR_GRAFT');
  const log = formatHitAbsorbProtectionAbsorbLog(offer.next.source, 1);
  assert.match(log, /\[MARTYR\]/);
  assert.doesNotMatch(log, /JUGGERNAUT/);
}

// 6. Multi-hit actions decrement the shared counter correctly (per-hit absorb)
{
  let state = armHitAbsorbProtection(
    createDefaultHitAbsorbProtectionState(),
    'MARTYR_GRAFT',
    2,
  ).next;
  // Simulate a 3-hit enemy action: only two absorbs succeed
  const hits: boolean[] = [];
  for (let i = 0; i < 3; i += 1) {
    const step = absorbHitAbsorbProtection(state);
    hits.push(step.absorbed);
    state = step.next;
  }
  assert.deepEqual(hits, [true, true, false]);
  assert.equal(state.hitsRemaining, 0);
  assert.equal(state.source, null);
}

// 7. Zero charges clear both the counter and its source
{
  let state = armHitAbsorbProtection(
    createDefaultHitAbsorbProtectionState(),
    'JUGGERNAUT_PLATING',
    1,
  ).next;
  state = absorbHitAbsorbProtection(state).next;
  assert.equal(state.hitsRemaining, 0);
  assert.equal(state.source, null);

  const enc = createDefaultBoonEncounterState();
  writeHitAbsorbProtectionToBoonEncounter(enc, {
    hitsRemaining: 0,
    source: 'MARTYR_GRAFT',
  });
  assert.equal(enc.juggernautShieldHits, 0);
  assert.equal(enc.hitAbsorbProtectionSource, null);
}

// 8. Expiry / encounter cleanup clear both fields
{
  const enc = createDefaultBoonEncounterState();
  writeHitAbsorbProtectionToBoonEncounter(
    enc,
    armHitAbsorbProtection(createDefaultHitAbsorbProtectionState(), 'MARTYR_GRAFT', 2).next,
  );
  assert.equal(enc.juggernautShieldHits, 2);
  assert.equal(enc.hitAbsorbProtectionSource, 'MARTYR_GRAFT');

  writeHitAbsorbProtectionToBoonEncounter(enc, clearHitAbsorbProtection());
  assert.equal(enc.juggernautShieldHits, 0);
  assert.equal(enc.hitAbsorbProtectionSource, null);

  // New-deployment / encounter reset shape
  const fresh = createDefaultBoonEncounterState();
  assert.equal(fresh.juggernautShieldHits, 0);
  assert.equal(fresh.hitAbsorbProtectionSource, null);
}

// 9. Hydration with absent or stale source metadata is safe
{
  assert.deepEqual(hydrateHitAbsorbProtectionState(null), { hitsRemaining: 0, source: null });
  assert.deepEqual(hydrateHitAbsorbProtectionState(undefined), { hitsRemaining: 0, source: null });
  assert.deepEqual(hydrateHitAbsorbProtectionState({}), { hitsRemaining: 0, source: null });

  // Hits without source — keep count, do NOT invent Martyr
  const orphan = hydrateHitAbsorbProtectionState({ juggernautShieldHits: 2 });
  assert.equal(orphan.hitsRemaining, 2);
  assert.equal(orphan.source, null);
  assert.equal(formatHitAbsorbProtectionStatusChip(orphan)?.label, 'PROTECTION ×2');
  assert.match(formatHitAbsorbProtectionAbsorbLog(orphan.source, 1), /\[PROTECTION\]/);
  assert.doesNotMatch(formatHitAbsorbProtectionAbsorbLog(orphan.source, 1), /MARTYR/);

  // Invalid source string ignored
  const stale = hydrateHitAbsorbProtectionState({
    juggernautShieldHits: 1,
    hitAbsorbProtectionSource: 'LEGACY_JUGGERNAUT_SHIELD',
  });
  assert.equal(stale.hitsRemaining, 1);
  assert.equal(stale.source, null);

  // Authoritative Juggernaut source preserved
  const jug = hydrateHitAbsorbProtectionState({
    hitsRemaining: 1,
    source: 'JUGGERNAUT_PLATING',
  });
  assert.equal(jug.source, 'JUGGERNAUT_PLATING');

  // Encounter read/write round-trip
  const enc = createDefaultBoonEncounterState();
  writeHitAbsorbProtectionToBoonEncounter(enc, {
    hitsRemaining: 2,
    source: 'MARTYR_GRAFT',
  });
  const roundTrip = readHitAbsorbProtectionFromBoonEncounter(enc);
  assert.deepEqual(roundTrip, { hitsRemaining: 2, source: 'MARTYR_GRAFT' });
}

// Orphan hits can adopt source on next equal-or-lower arm (refresh-unset path)
{
  const orphan = hydrateHitAbsorbProtectionState({ juggernautShieldHits: 2 });
  const tagged = armHitAbsorbProtection(orphan, 'MARTYR_GRAFT', 2);
  assert.equal(tagged.applied, true);
  assert.equal(tagged.next.source, 'MARTYR_GRAFT');
  assert.equal(tagged.next.hitsRemaining, 2);
}

console.log('hitAbsorbProtectionEngine.test.ts: all assertions passed');
