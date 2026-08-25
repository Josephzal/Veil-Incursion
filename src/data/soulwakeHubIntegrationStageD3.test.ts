import assert from 'node:assert/strict';
import {
  applySoulwakeHubEffects,
  type SoulwakeHubEffectFlags,
  type SoulwakeHubLiveState,
} from './nineStrain/soulwakeHubConsumer';
import {
  activateRecordedWake,
  beginSoulwakePlayerTurn,
  createDefaultSoulwakeState,
  requestResidualCarry,
} from './nineStrain/soulwakeEngine';

console.log('Stage D.3 — Soulwake Hub integration');

{
  const live: SoulwakeHubLiveState = {
    playerAp: 2,
    playerHp: 90,
    playerShield: 0,
    abyssalReserve: 1,
    veilFlux: 0,
    ammo: 3,
    maxAmmo: 6,
    committedAbilityCooldown: 2,
    classId: 'AEGIS',
  };
  const flags: SoulwakeHubEffectFlags = {
    lastApRefund: 1,
    lastCooldownAdvanced: true,
    lastBarrierGranted: 4,
    playerHp: 80,
    openConduitGain: 2,
    openConduitPreserved: 1,
  };
  const first = applySoulwakeHubEffects(live, flags);
  assert.equal(first.live.playerAp, 3);
  assert.equal(first.live.playerShield, 4);
  assert.equal(first.live.playerHp, 80);
  assert.equal(first.live.abyssalReserve, 4);
  assert.equal(first.live.committedAbilityCooldown, 1);
  assert.equal(first.applied.apRefund, 1);
  assert.equal(first.applied.cooldownAdvanced, true);
  assert.equal(first.applied.barrier, 4);
  assert.equal(first.applied.hpSynced, true);
  assert.equal(first.applied.currentGain, 2);
  assert.equal(first.applied.currentPreserved, 1);
  assert.deepEqual(first.clearedFlags, {
    lastApRefund: 0,
    lastCooldownAdvanced: false,
    lastBarrierGranted: 0,
    playerHp: 80,
    openConduitGain: 0,
    openConduitPreserved: 0,
  });

  const second = applySoulwakeHubEffects(first.live, first.clearedFlags);
  assert.deepEqual(second.live, first.live);
  assert.equal(second.applied.apRefund, 0);
  assert.equal(second.applied.cooldownAdvanced, false);
  assert.equal(second.applied.barrier, 0);
  assert.equal(second.applied.hpSynced, false);
  assert.equal(second.applied.currentGain, 0);
  assert.equal(second.applied.currentPreserved, 0);
}

{
  let sw = createDefaultSoulwakeState();
  sw = { ...sw, playerHp: 100, playerMaxHp: 100, playerTurnIndex: 0 };
  const carry = requestResidualCarry(sw, {
    sourceId: 'TEST_CARRY',
    amount: 8,
    triggerId: 'TEST_CARRY',
    sourceWakeKind: 'NORMAL',
  });
  assert.equal(carry.accepted, true);
  assert.equal(carry.amount, 8);
  assert.ok(carry.state.pendingCarry);
  assert.equal(carry.state.pendingCarry?.amount, 8);
  assert.equal(carry.state.pendingCarry?.activateAtPlayerTurn, 1);

  let next = beginSoulwakePlayerTurn(carry.state);
  assert.equal(next.playerTurnIndex, 1);
  next = activateRecordedWake(next, ['SW_CORE_HOLLOW_EDGE']);
  assert.equal(next.activeWake, 8);
  assert.equal(next.activeWakeKind, 'RESIDUAL');
  assert.equal(next.pendingCarry, null);
  assert.equal(next.recordedWake, 0);
}

{
  let sw = createDefaultSoulwakeState();
  sw = { ...sw, recordedWake: 10, playerMaxHp: 100 };
  sw = beginSoulwakePlayerTurn(sw);
  sw = activateRecordedWake(sw, ['SW_CORE_HOLLOW_EDGE']);
  assert.equal(sw.activeWake, 10);
  assert.equal(sw.activeWakeKind, 'NORMAL');
  assert.equal(sw.recordedWake, 0);
}

console.log('Stage D.3 — Soulwake Hub integration passed');
