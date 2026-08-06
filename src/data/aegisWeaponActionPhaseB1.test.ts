/**
 * Phase B.1 — Doomfall interrupt pipeline, Poise/Committed ordering, Rupture accuracy.
 * Run: npx tsx src/data/aegisWeaponActionPhaseB1.test.ts
 */
import assert from 'node:assert/strict';
import { COMBAT_CHANCE } from '../types/combatChance';
import { createDefaultCombatSessionExtras } from '../types/combatHooks';
import { resolveEnemyStatEvadeChance } from './combatChanceEngine';
import {
  assertDoomfallFullyCleared,
  applyAegisControlInterrupt,
  cancelDoomfallForControl,
  resolveAegisInboundHitDefense,
} from './aegisDoomfallInterruptEngine';
import {
  createAegisControlPipelineSession,
  divergenceCancelBeforeCommit,
  hubApplyAegisPlayerControl,
  hubResolveAegisInboundPlayerHit,
  scrubAegisStagedCombatCommand,
} from './aegisCombatHubRuntime';
import {
  beginAegisPlayerTurnWeaponState,
  createDefaultAegisWeaponCombatState,
  enterDoomfallCharge,
  enterPoise,
  expireDoomfallReleaseAtTurnEnd,
} from './aegisWeaponCombatState';
import { planAegisWeaponAction } from './aegisWeaponActionResolveEngine';
import { resolveRuptureBrandGain } from './aegisWeaponActionRuntime';
import type { EnemyCombatProfile } from '../types/run';

console.log('Phase B.1 — Doomfall interrupt + Rupture accuracy + hub runtime');

function chargedState(origin = 'doomfall-origin-1') {
  return enterDoomfallCharge(createDefaultAegisWeaponCombatState(), origin);
}

function enemy(partial: Partial<EnemyCombatProfile> & { evadeChance?: number; evadeActive?: boolean }): EnemyCombatProfile {
  return {
    designation: 'TEST',
    currentHp: 40,
    maxHp: 40,
    evadeChance: partial.evadeChance ?? 0,
    evadeActive: partial.evadeActive ?? false,
    isBoss: false,
    ...partial,
  } as EnemyCombatProfile;
}

// --- Accuracy: first-class +15 vs evade-stat shim (shim is NOT identical with posture) ---
{
  const defender = enemy({ evadeChance: 0.1, evadeActive: true });
  const withAcc = resolveEnemyStatEvadeChance({
    defender,
    accuracyBonusPct: 15,
  });
  const withoutAcc = resolveEnemyStatEvadeChance({ defender });
  // Posture 0.50 + stat 0.10 = 0.60; −0.15 accuracy → 0.45
  assert.ok(Math.abs(withoutAcc - 0.6) < 1e-9);
  assert.ok(Math.abs(withAcc - 0.45) < 1e-9);

  // Shim would only reduce evadeChance field → posture still 0.50 (NOT identical).
  const shimStat = Math.max(0, 0.1 - 0.15);
  const shimTotal = Math.min(1, Math.max(0, shimStat + COMBAT_CHANCE.EVADE_POSTURE_MISS_BONUS));
  assert.equal(shimTotal, 0.5);
  assert.notEqual(withAcc, shimTotal);

  // Clamps: large accuracy cannot drive below 0
  assert.equal(resolveEnemyStatEvadeChance({
    defender: enemy({ evadeChance: 0.05, evadeActive: false }),
    accuracyBonusPct: 50,
  }), 0);

  // Boss / bypass ignores accuracy
  assert.equal(resolveEnemyStatEvadeChance({
    defender: enemy({ isBoss: true, evadeChance: 0.4 }),
    accuracyBonusPct: 15,
  }), 0);
  assert.equal(resolveEnemyStatEvadeChance({
    defender: enemy({ evadeChance: 0.4 }),
    bypassAllEvade: true,
    accuracyBonusPct: 15,
  }), 0);

  // Rupture plan carries +15; Warden's does not
  assert.equal(planAegisWeaponAction('RUPTURE', {
    tempoArmed: false,
    ruptureMastery: { removedFinalArmor: false, enteredFractured: false },
  }).hits[0]!.accuracyBonusPct, 15);
  assert.equal(planAegisWeaponAction('WARDENS_STRIKE', { tempoArmed: false }).hits[0]!.accuracyBonusPct, 0);
}

// --- 1–5, 7–8: Hub runtime Doomfall cancel ---
{
  // Stun cancels
  let ws = chargedState();
  let session = createAegisControlPipelineSession();
  let extras = createDefaultCombatSessionExtras();
  let ctrl = hubApplyAegisPlayerControl({
    weaponState: ws,
    extras,
    pipelineSession: session,
    reason: 'STUN',
    authoredActionId: 'act-stun-1',
    currentBrands: 0,
  });
  assert.ok(ctrl.clearStagedCombatCommand);
  assert.ok(assertDoomfallFullyCleared(ctrl.weaponState));
  assert.ok(extras.structuredDebuffs.some((d) => d.type === 'STUN'));

  // Knockdown cancels
  ws = chargedState();
  session = createAegisControlPipelineSession();
  extras = createDefaultCombatSessionExtras();
  ctrl = hubApplyAegisPlayerControl({
    weaponState: ws,
    extras,
    pipelineSession: session,
    reason: 'KNOCKDOWN',
    authoredActionId: 'act-kd-1',
    currentBrands: 0,
  });
  assert.ok(assertDoomfallFullyCleared(ctrl.weaponState));

  // Non-damaging Stun also cancels (0 damage inbound + control)
  ws = chargedState();
  session = createAegisControlPipelineSession();
  const inbound0 = hubResolveAegisInboundPlayerHit({
    weaponState: ws,
    damage: 0,
    controlEffects: ['STUN'],
    authoredActionId: 'act-stun-0dmg',
    pipelineSession: session,
    currentBrands: 0,
  });
  assert.ok(assertDoomfallFullyCleared(inbound0.weaponState));
  assert.ok(inbound0.clearStagedCombatCommand);

  // Ordinary damage does NOT cancel
  ws = chargedState();
  session = createAegisControlPipelineSession();
  const dmgOnly = hubResolveAegisInboundPlayerHit({
    weaponState: ws,
    damage: 20,
    authoredActionId: 'act-dmg',
    pipelineSession: session,
    currentBrands: 0,
  });
  assert.equal(dmgOnly.weaponState.committed, true);
  assert.equal(dmgOnly.clearStagedCombatCommand, false);

  // Resource drain / environmental DoT does not cancel
  ws = chargedState();
  session = createAegisControlPipelineSession();
  const drain = hubResolveAegisInboundPlayerHit({
    weaponState: ws,
    damage: 8,
    damageOverTime: true,
    environmental: true,
    authoredActionId: 'act-dot',
    pipelineSession: session,
    currentBrands: 0,
  });
  assert.equal(drain.weaponState.committed, true);

  // Multi-hit: one cancel event
  ws = chargedState();
  session = createAegisControlPipelineSession();
  const hit1 = hubResolveAegisInboundPlayerHit({
    weaponState: ws,
    damage: 5,
    controlEffects: ['KNOCKDOWN'],
    authoredActionId: 'multi-1',
    pipelineSession: session,
    currentBrands: 0,
  });
  const hit2 = hubResolveAegisInboundPlayerHit({
    weaponState: hit1.weaponState,
    damage: 5,
    controlEffects: ['KNOCKDOWN'],
    authoredActionId: 'multi-1',
    pipelineSession: hit1.pipelineSession,
    currentBrands: 0,
  });
  assert.equal(hit1.logs.filter((l) => l.includes('Charge cancelled')).length, 1);
  assert.equal(hit2.logs.filter((l) => l.includes('Charge cancelled')).length, 0);

  // Cancellation → no Release next turn
  ws = chargedState();
  const cancelled = cancelDoomfallForControl(ws, 'STUN').state;
  const nextTurn = beginAegisPlayerTurnWeaponState(cancelled, 2);
  assert.equal(nextTurn.doomfallReleaseAvailable, false);
  assert.equal(nextTurn.committed, false);
  assert.equal(nextTurn.doomfallOriginActionId, null);

  // Staged scrub
  const scrubbed = scrubAegisStagedCombatCommand({
    selectedAbility: 'DOOMFALL',
    dualTargetIds: ['e0', null],
    dualPickStep: 1,
    selectedTargetId: 'e0',
  });
  assert.equal(scrubbed.selectedAbility, null);
  assert.deepEqual(scrubbed.dualTargetIds, [null, null]);
  assert.equal(scrubbed.selectedTargetId, null);
}

// --- 6: Poise + Committed ordering ---
{
  let ws = chargedState();
  ws = enterPoise(ws, 3);
  const session = createAegisControlPipelineSession();
  const inbound = hubResolveAegisInboundPlayerHit({
    weaponState: ws,
    damage: 100,
    controlEffects: ['STUN'],
    authoredActionId: 'poise-ctrl',
    pipelineSession: session,
    currentBrands: 0,
  });
  // 35% reduction → 65
  assert.equal(inbound.damage, 65);
  assert.equal(inbound.brandGain, 1);
  assert.ok(assertDoomfallFullyCleared(inbound.weaponState));
  assert.equal(inbound.weaponState.poiseActive, false);
  // Brand decided before COMMITTED clear — brandGain preserved even though committed false
  assert.equal(inbound.weaponState.committed, false);
  assert.ok(inbound.logs.some((l) => l.includes('Committed payoff')));
  assert.ok(inbound.logs.some((l) => l.includes('Charge cancelled')));
  // Order in logs: Poise reduce → Brand → cancel
  const reduceIdx = inbound.logs.findIndex((l) => l.includes('Incoming damage reduced'));
  const brandIdx = inbound.logs.findIndex((l) => l.includes('Committed payoff'));
  const cancelIdx = inbound.logs.findIndex((l) => l.includes('Charge cancelled'));
  assert.ok(reduceIdx < brandIdx && brandIdx < cancelIdx);
}

// Pure engine: brand awarded even when cancel would clear committed first (snapshot)
{
  const result = resolveAegisInboundHitDefense({
    weaponState: enterPoise(chargedState(), 2),
    damage: 0,
    eligible: true,
    controlEffects: ['KNOCKDOWN'],
    authoredActionId: 'ctrl-only',
    currentBrands: 2,
  });
  assert.equal(result.brandGain, 1);
  assert.ok(result.doomfallCancelled);
  assert.ok(assertDoomfallFullyCleared(result.weaponState));
}

// --- 9–10: Rupture accuracy scoped; Brand at most one ---
{
  assert.equal(resolveRuptureBrandGain(0, {
    hit: true, killed: false, removedFinalArmor: true, enteredFractured: true,
  }).brandGain, 1);
  assert.equal(resolveRuptureBrandGain(3, {
    hit: true, killed: false, removedFinalArmor: true, enteredFractured: true,
  }).brandGain, 0);
}

// --- Manual-case automation ---
{
  // Divergence cancel after Blade One — no AP / no commit
  const cancel = divergenceCancelBeforeCommit({
    selectedAbility: 'DIVERGENCE',
    dualTargetIds: ['e0', null],
    dualPickStep: 1,
    selectedTargetId: 'e0',
  });
  assert.equal(cancel.apSpent, 0);
  assert.equal(cancel.actionCommitted, false);
  assert.equal(cancel.staged.selectedAbility, null);

  // Doomfall Charge → Release next turn; expire at end
  let ws = chargedState('origin-shared');
  ws = beginAegisPlayerTurnWeaponState(ws, 2);
  assert.equal(ws.doomfallReleaseAvailable, true);
  assert.equal(ws.committed, false);
  assert.equal(ws.doomfallOriginActionId, 'origin-shared');
  ws = expireDoomfallReleaseAtTurnEnd(ws);
  assert.ok(assertDoomfallFullyCleared(ws));

  // Death interrupt
  const death = applyAegisControlInterrupt({
    weaponState: chargedState(),
    reason: 'DEATH',
    authoredActionId: 'death-1',
  });
  assert.ok(death.cancelled);
  assert.ok(assertDoomfallFullyCleared(death.weaponState));

  // INTERRUPT_CHARGE
  const interrupt = applyAegisControlInterrupt({
    weaponState: chargedState(),
    reason: 'INTERRUPT_CHARGE',
    authoredActionId: 'interrupt-1',
  });
  assert.ok(interrupt.cancelled);

  // Focus deterministic: Release transform keeps same ability id selectable
  const afterTransform = beginAegisPlayerTurnWeaponState(chargedState('o1'), 2);
  assert.equal(afterTransform.doomfallReleaseAvailable, true);
  // Interrupted: scrub clears DOOMFALL selection
  assert.equal(
    scrubAegisStagedCombatCommand({
      selectedAbility: 'DOOMFALL',
      dualTargetIds: [null, null],
      dualPickStep: 0,
      selectedTargetId: null,
    }).selectedAbility,
    null,
  );
}

// Committed blocks: evade chance forced to 0 is hub-side — engine exposes committed flag
{
  const ws = chargedState();
  assert.equal(ws.committed, true);
}

console.log('Phase B.1 OK');
