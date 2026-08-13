/**
 * Hex Shot Phase W.3 — Carbine kit + Firing Solution + Suppressed + Contact Front.
 * Run: npx tsx src/data/hexShotPhaseW3.test.ts
 */
import assert from 'node:assert/strict';
import { buildHexCombatSurface } from './hexCombatCompatibility';
import {
  applyCarbineSuppressedDamage,
  applyHexCarbineSuppressed,
  CARBINE_SUPPRESSED_DAMAGE_MULT,
  clearHexCarbineSuppressed,
  isHexCarbineSuppressedEligibleIncoming,
  shouldApplySuppressedFromAuthoredHits,
} from './hexCarbineSuppressedEngine';
import {
  clearHexFiringSolution,
  clearHexFiringSolutionIfUnit,
  establishHexFiringSolution,
  expireHexFiringSolutionAtPlayerTurnEnd,
  FIRING_SOLUTION_ACCURACY_BONUS_PCT,
  firingSolutionAccuracyBonusPct,
  hasFiringSolutionOn,
} from './hexFiringSolutionEngine';
import { validateHexFlexLoadoutCommit } from './hexFlexLoadoutEngine';
import {
  formatHexWeaponActionLabel,
  getHexWeaponActionDefinition,
  mapHexFixedBasicSignatureToWeaponAction,
} from './hexWeaponActionCatalog';
import {
  CENTER_MASS_BASE_DAMAGE,
  CONTACT_FRONT_PACKET_DAMAGE,
  CONTACT_FRONT_ROUNDS,
  CONTROLLED_BURST_PACKET_DAMAGE,
  CONTROLLED_BURST_ROUNDS,
  executeHexWeaponAction,
  isHexWeaponActionEnabled,
  resolveContactFrontAllocation,
  scaleHexWeaponAuthoredDamage,
  SUPPRESSIVE_BARRAGE_PACKET_DAMAGE,
  SUPPRESSIVE_BARRAGE_ROUNDS,
} from './hexWeaponActionExecutor';
import {
  deriveHexWeaponActions,
  isHexWeaponActionExecutable,
  isHexWeaponKitComplete,
} from './hexWeaponActionRegistry';
import { getAssignableHexShotAbilities } from './classAbilityUnlockEngine';
import { classAbilityTargetMode } from './combatClassTargeting';
import { createDefaultClassCombatEncounterState } from '../types/classCombatAbility';
import { DEFAULT_HEX_FLEX_LOADOUT } from '../types/operativeClass';
import type { EnemyCombatProfile } from '../types/run';
import { resolveWeaponState } from './weaponProgressionEngine';
import { classifyAbilitySocket } from './graftSynergy/graftCapacityEngine';
import { resolveHexShotAbilityGraftId } from './hexShotMigration';
import { isHexFixedBasicAbilityId } from './hexShotPhaseH2aEngine';

console.log('Phase W.3 — Hex Carbine kit + Firing Solution');

function enemy(partial: Partial<EnemyCombatProfile> & { unitId: string }): EnemyCombatProfile {
  return {
    designation: 'N',
    currentHp: 80,
    maxHp: 100,
    gridSlot: 'FL_1',
    kineticArmor: 0,
    occultWards: 0,
    ...partial,
  } as EnemyCombatProfile;
}

function combinations<T>(items: readonly T[], k: number): T[][] {
  const out: T[][] = [];
  const n = items.length;
  const idx = Array.from({ length: k }, (_, i) => i);
  const push = () => out.push(idx.map((i) => items[i]!));
  push();
  while (true) {
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i -= 1;
    if (i < 0) break;
    idx[i]! += 1;
    for (let j = i + 1; j < k; j += 1) idx[j] = idx[j - 1]! + 1;
    push();
  }
  return out;
}

// ── Family / surface ────────────────────────────────────────────────────
{
  assert.equal(isHexWeaponKitComplete('hex-carbine'), true);
  assert.equal(isHexWeaponKitComplete('hex-revolver'), true);
  assert.equal(isHexWeaponKitComplete('hex-shotgun'), true);
  assert.deepEqual(deriveHexWeaponActions('hex-carbine'), [
    'CENTER_MASS',
    'CONTROLLED_BURST',
    'SUPPRESSIVE_BARRAGE',
    'CONTACT_FRONT',
  ]);
  assert.equal(formatHexWeaponActionLabel('SUPPRESSIVE_BARRAGE'), '[ SUPPRESSIVE FIRE ]');
  assert.equal(getHexWeaponActionDefinition('SUPPRESSIVE_BARRAGE')?.label, '[ SUPPRESSIVE FIRE ]');
  assert.equal(isHexWeaponActionExecutable('hex-carbine', 'CENTER_MASS'), true);
  assert.equal(isHexWeaponActionExecutable('hex-shotgun', 'DEADBOLT'), true);
  assert.equal(mapHexFixedBasicSignatureToWeaponAction('hex-carbine'), 'CENTER_MASS');
  assert.ok(isHexFixedBasicAbilityId('CENTER_MASS'));
  assert.equal(classifyAbilitySocket('HEX_SHOT', 'CENTER_MASS'), 'FIXED_BASIC_SIGNATURE');
  assert.equal(
    resolveHexShotAbilityGraftId({ SILVER_CORE_SIDEARM: 'BOTTOMLESS_DRUM_GRAFT' as never }, 'CENTER_MASS'),
    'BOTTOMLESS_DRUM_GRAFT',
  );
  assert.equal(classAbilityTargetMode('HEX_SHOT', 'CONTACT_FRONT'), 'ONE_OR_TWO');
  assert.equal(classAbilityTargetMode('HEX_SHOT', 'CENTER_MASS'), 'SINGLE');
  // Aegis DUAL unchanged.
  assert.equal(classAbilityTargetMode('AEGIS', 'DIVERGENCE'), 'DUAL');

  const flex = DEFAULT_HEX_FLEX_LOADOUT;
  const carbine = buildHexCombatSurface({ weaponFamilyId: 'hex-carbine', flex });
  assert.equal(carbine.mode, 'WEAPON_KIT');
  assert.deepEqual(carbine.hudCards, [
    'CENTER_MASS', 'CONTROLLED_BURST', 'SUPPRESSIVE_BARRAGE', 'CONTACT_FRONT', ...flex,
  ]);
  assert.ok(!carbine.hudCards.includes('SILVER_CORE_SIDEARM'));

  const revolver = buildHexCombatSurface({ weaponFamilyId: 'hex-revolver', flex });
  assert.deepEqual(revolver.hudCards.slice(0, 4), ['QUICKDRAW', 'SLIPSHOT', 'SIX_BELLS', 'LAST_WORD']);

  const nullbreach = buildHexCombatSurface({ weaponFamilyId: 'hex-shotgun', flex });
  assert.equal(nullbreach.mode, 'WEAPON_KIT');
  assert.deepEqual(nullbreach.hudCards, [
    'DOOR_KNOCKER', 'FATAL_FUNNEL', 'THRESHOLD', 'DEADBOLT', ...flex,
  ]);
  assert.ok(!nullbreach.hudCards.includes('SILVER_CORE_SIDEARM'));

  const kept = ['PANOPTICON_PROTOCOL', 'GHOST_GRID_CAMO', 'BLACKSITE_TRIAGE'] as const;
  assert.deepEqual(
    buildHexCombatSurface({ weaponFamilyId: 'hex-carbine', flex: kept }).flex,
    [...kept],
  );
  assert.deepEqual(
    buildHexCombatSurface({ weaponFamilyId: 'hex-revolver', flex: kept }).flex,
    [...kept],
  );
}

// ── 165 flex triples ────────────────────────────────────────────────────
{
  const triples = combinations(getAssignableHexShotAbilities(), 3);
  assert.equal(triples.length, 165);
  for (const t of triples) assert.equal(validateHexFlexLoadoutCommit(t), null);
  console.log('  flex triples validated: 165/165');
}

// ── Firing Solution engine ──────────────────────────────────────────────
{
  let fs = clearHexFiringSolution({
    firingSolutionUnitId: null,
    firingSolutionExpiresAfterPlayerTurn: null,
  });
  fs = establishHexFiringSolution(fs, 'e1', 1);
  assert.equal(fs.firingSolutionUnitId, 'e1');
  assert.equal(fs.firingSolutionExpiresAfterPlayerTurn, 2);
  assert.equal(firingSolutionAccuracyBonusPct(fs, 'e1'), FIRING_SOLUTION_ACCURACY_BONUS_PCT);
  assert.equal(firingSolutionAccuracyBonusPct(fs, 'e2'), 0);

  // Miss path does not call establish — transfer only on establish.
  const still = establishHexFiringSolution(fs, 'e2', 1);
  assert.equal(still.firingSolutionUnitId, 'e2');

  // Refresh on turn 2 → expires after 3.
  const refreshed = establishHexFiringSolution(still, 'e2', 2);
  assert.equal(refreshed.firingSolutionExpiresAfterPlayerTurn, 3);

  // Survive end of creation turn.
  let tick = expireHexFiringSolutionAtPlayerTurnEnd(establishHexFiringSolution(
    clearHexFiringSolution(fs),
    'e1',
    1,
  ), 1);
  assert.equal(tick.expired, false);
  assert.equal(tick.next.firingSolutionUnitId, 'e1');
  // Survive through next player turn entirely — expire at end of turn 2.
  tick = expireHexFiringSolutionAtPlayerTurnEnd(tick.next, 2);
  assert.equal(tick.expired, true);
  assert.equal(tick.next.firingSolutionUnitId, null);

  // Refresh on turn 2 moves boundary to 3.
  let live = establishHexFiringSolution(clearHexFiringSolution(fs), 'e1', 1);
  live = establishHexFiringSolution(live, 'e1', 2);
  assert.equal(expireHexFiringSolutionAtPlayerTurnEnd(live, 2).expired, false);
  assert.equal(expireHexFiringSolutionAtPlayerTurnEnd(live, 3).expired, true);

  assert.equal(clearHexFiringSolutionIfUnit(live, 'e1').firingSolutionUnitId, null);
}

// ── Center Mass ─────────────────────────────────────────────────────────
{
  const def = getHexWeaponActionDefinition('CENTER_MASS')!;
  assert.equal(def.apCost, 1);
  assert.equal(def.staminaCost, 0);
  assert.equal(def.ammoCost, 1);
  assert.equal(CENTER_MASS_BASE_DAMAGE, 9);

  let ammo = 5;
  const classState = createDefaultClassCombatEncounterState();
  const squad = [enemy({ unitId: 'e1', currentHp: 80, maxHp: 100 })];
  const packs: number[] = [];
  let landed = false;
  const ok = executeHexWeaponAction({
    actionId: 'CENTER_MASS',
    squad,
    targetId: 'e1',
    currentAmmo: ammo,
    maxAmmo: 5,
    classState,
    resolvedWeapon: resolveWeaponState('hex-carbine'),
    currentPlayerTurn: 1,
    log: () => {},
    spendAmmo: (n) => {
      if (ammo < n) return false;
      ammo -= n;
      return true;
    },
    hurtEnemy: (raw) => {
      packs.push(raw);
      landed = true;
      return true;
    },
  });
  assert.equal(ok.ok, true);
  assert.equal(ammo, 4);
  assert.equal(packs.length, 1);
  assert.equal(packs[0], scaleHexWeaponAuthoredDamage(9, resolveWeaponState('hex-carbine')));
  assert.equal(classState.firingSolutionUnitId, 'e1');
  assert.equal(classState.firingSolutionExpiresAfterPlayerTurn, 2);
  assert.ok(landed);

  // Miss — no FS change.
  const missState = createDefaultClassCombatEncounterState();
  missState.firingSolutionUnitId = 'other';
  missState.firingSolutionExpiresAfterPlayerTurn = 9;
  let ammo2 = 5;
  executeHexWeaponAction({
    actionId: 'CENTER_MASS',
    squad: [enemy({ unitId: 'e1' })],
    targetId: 'e1',
    currentAmmo: ammo2,
    maxAmmo: 5,
    classState: missState,
    resolvedWeapon: resolveWeaponState('hex-carbine'),
    currentPlayerTurn: 1,
    log: () => {},
    spendAmmo: (n) => {
      ammo2 -= n;
      return true;
    },
    hurtEnemy: () => false,
  });
  assert.equal(missState.firingSolutionUnitId, 'other');
  assert.equal(missState.firingSolutionExpiresAfterPlayerTurn, 9);

  // Lethal hit clears dead tracked target.
  const killState = createDefaultClassCombatEncounterState();
  killState.firingSolutionUnitId = 'prev';
  killState.firingSolutionExpiresAfterPlayerTurn = 4;
  const fragile = enemy({ unitId: 'e1', currentHp: 1, maxHp: 100 });
  const killSquad = [fragile];
  executeHexWeaponAction({
    actionId: 'CENTER_MASS',
    squad: killSquad,
    targetId: 'e1',
    currentAmmo: 5,
    maxAmmo: 5,
    classState: killState,
    resolvedWeapon: resolveWeaponState('hex-carbine'),
    currentPlayerTurn: 1,
    log: () => {},
    spendAmmo: () => true,
    hurtEnemy: (_r, _t, _o, tid) => {
      const u = killSquad.find((e) => e.unitId === tid);
      if (u) u.currentHp = 0;
      return true;
    },
  });
  assert.equal(killState.firingSolutionUnitId, null);

  // Invalid — no spend.
  let ammo3 = 5;
  const bad = executeHexWeaponAction({
    actionId: 'CENTER_MASS',
    squad: [enemy({ unitId: 'e1' })],
    targetId: null,
    currentAmmo: ammo3,
    maxAmmo: 5,
    classState: createDefaultClassCombatEncounterState(),
    resolvedWeapon: null,
    log: () => {},
    spendAmmo: (n) => {
      ammo3 -= n;
      return true;
    },
    hurtEnemy: () => true,
  });
  assert.equal(bad.ok, false);
  assert.equal(ammo3, 5);
}

// ── Controlled Burst ────────────────────────────────────────────────────
{
  assert.equal(CONTROLLED_BURST_ROUNDS, 3);
  assert.equal(CONTROLLED_BURST_PACKET_DAMAGE, 6);
  assert.equal(isHexWeaponActionEnabled('CONTROLLED_BURST', 2, 5, 2), false);
  assert.equal(isHexWeaponActionEnabled('CONTROLLED_BURST', 3, 5, 2), true);

  let ammo = 5;
  const classState = createDefaultClassCombatEncounterState();
  classState.firingSolutionUnitId = 'e1';
  classState.firingSolutionExpiresAfterPlayerTurn = 9;
  const acc: number[] = [];
  const packs: number[] = [];
  executeHexWeaponAction({
    actionId: 'CONTROLLED_BURST',
    squad: [enemy({ unitId: 'e1', currentHp: 200, maxHp: 200 })],
    targetId: 'e1',
    currentAmmo: ammo,
    maxAmmo: 5,
    classState,
    resolvedWeapon: resolveWeaponState('hex-carbine'),
    log: () => {},
    spendAmmo: (n) => {
      ammo -= n;
      return true;
    },
    hurtEnemy: (raw, _t, opts) => {
      packs.push(raw);
      acc.push(opts?.accuracyBonusPct ?? 0);
      return true;
    },
  });
  assert.equal(ammo, 2);
  assert.equal(packs.length, 3);
  assert.ok(acc.every((a) => a === FIRING_SOLUTION_ACCURACY_BONUS_PCT));
  // FS not consumed / not established by burst.
  assert.equal(classState.firingSolutionUnitId, 'e1');
  assert.equal(classState.firingSolutionExpiresAfterPlayerTurn, 9);

  // Death truncates without refund.
  let ammoK = 5;
  const fragile = enemy({ unitId: 'e1', currentHp: 1, maxHp: 100 });
  const sq = [fragile];
  let hits = 0;
  executeHexWeaponAction({
    actionId: 'CONTROLLED_BURST',
    squad: sq,
    targetId: 'e1',
    currentAmmo: ammoK,
    maxAmmo: 5,
    classState: createDefaultClassCombatEncounterState(),
    resolvedWeapon: resolveWeaponState('hex-carbine'),
    log: () => {},
    spendAmmo: (n) => {
      ammoK -= n;
      return true;
    },
    hurtEnemy: (_r, _t, _o, tid) => {
      hits += 1;
      const u = sq.find((e) => e.unitId === tid);
      if (u) u.currentHp = 0;
      return true;
    },
  });
  assert.equal(ammoK, 2);
  assert.equal(hits, 1);
}

// ── Suppressive Fire ────────────────────────────────────────────────────
{
  assert.equal(SUPPRESSIVE_BARRAGE_ROUNDS, 2);
  assert.equal(SUPPRESSIVE_BARRAGE_PACKET_DAMAGE, 4);
  assert.equal(CARBINE_SUPPRESSED_DAMAGE_MULT, 0.7);
  assert.equal(shouldApplySuppressedFromAuthoredHits({
    authoredHitCount: 2,
    authoredPacketCount: 2,
    hadFiringSolutionAtStart: false,
  }), true);
  assert.equal(shouldApplySuppressedFromAuthoredHits({
    authoredHitCount: 1,
    authoredPacketCount: 2,
    hadFiringSolutionAtStart: false,
  }), false);
  assert.equal(shouldApplySuppressedFromAuthoredHits({
    authoredHitCount: 1,
    authoredPacketCount: 2,
    hadFiringSolutionAtStart: true,
  }), true);

  assert.equal(isHexCarbineSuppressedEligibleIncoming({
    rawDamage: 10,
    attackerUnitId: 'e1',
    suppressedUnitId: 'e1',
  }), true);
  assert.equal(isHexCarbineSuppressedEligibleIncoming({
    rawDamage: 10,
    attackerUnitId: 'e1',
    suppressedUnitId: 'e1',
    environmental: true,
  }), false);
  assert.equal(applyCarbineSuppressedDamage(100), 70);

  let ammo = 5;
  const classState = createDefaultClassCombatEncounterState();
  let hits = 0;
  executeHexWeaponAction({
    actionId: 'SUPPRESSIVE_BARRAGE',
    squad: [enemy({ unitId: 'e1' })],
    targetId: 'e1',
    currentAmmo: ammo,
    maxAmmo: 5,
    classState,
    resolvedWeapon: resolveWeaponState('hex-carbine'),
    log: () => {},
    spendAmmo: (n) => {
      ammo -= n;
      return true;
    },
    hurtEnemy: () => {
      hits += 1;
      return true;
    },
  });
  assert.equal(ammo, 3);
  assert.equal(hits, 2);
  assert.equal(classState.carbineSuppressedUnitId, 'e1');

  // One hit with FS applies; miss threshold without FS does not.
  const fsState = createDefaultClassCombatEncounterState();
  fsState.firingSolutionUnitId = 'e1';
  fsState.firingSolutionExpiresAfterPlayerTurn = 9;
  let n = 0;
  executeHexWeaponAction({
    actionId: 'SUPPRESSIVE_BARRAGE',
    squad: [enemy({ unitId: 'e1' })],
    targetId: 'e1',
    currentAmmo: 5,
    maxAmmo: 5,
    classState: fsState,
    resolvedWeapon: resolveWeaponState('hex-carbine'),
    log: () => {},
    spendAmmo: () => true,
    hurtEnemy: () => {
      n += 1;
      return n === 1;
    },
  });
  assert.equal(fsState.carbineSuppressedUnitId, 'e1');
  // FS not consumed by Suppressive Fire.
  assert.equal(fsState.firingSolutionUnitId, 'e1');

  const missState = createDefaultClassCombatEncounterState();
  let m = 0;
  executeHexWeaponAction({
    actionId: 'SUPPRESSIVE_BARRAGE',
    squad: [enemy({ unitId: 'e1' })],
    targetId: 'e1',
    currentAmmo: 5,
    maxAmmo: 5,
    classState: missState,
    resolvedWeapon: resolveWeaponState('hex-carbine'),
    log: () => {},
    spendAmmo: () => true,
    hurtEnemy: () => {
      m += 1;
      return m === 1; // one hit only, no FS
    },
  });
  assert.equal(missState.carbineSuppressedUnitId, null);

  const cleared = clearHexCarbineSuppressed(applyHexCarbineSuppressed({
    carbineSuppressedUnitId: null,
    carbineSuppressedAppliedThisAction: false,
  }, 'e1'));
  assert.equal(cleared.carbineSuppressedUnitId, null);
}

// ── Contact Front ───────────────────────────────────────────────────────
{
  assert.equal(CONTACT_FRONT_ROUNDS, 4);
  assert.equal(CONTACT_FRONT_PACKET_DAMAGE, 5);
  assert.deepEqual(resolveContactFrontAllocation('a', null), { kind: '4+0', primaryId: 'a' });
  assert.deepEqual(resolveContactFrontAllocation('a', 'a'), { kind: '4+0', primaryId: 'a' });
  assert.deepEqual(resolveContactFrontAllocation('a', 'b'), {
    kind: '2+2',
    primaryId: 'a',
    secondaryId: 'b',
  });
  assert.equal(resolveContactFrontAllocation(null, 'b'), null);

  let ammo = 5;
  const packs: Array<{ tid: string; dmg: number; acc: number }> = [];
  const classState = createDefaultClassCombatEncounterState();
  classState.firingSolutionUnitId = 'e1';
  classState.firingSolutionExpiresAfterPlayerTurn = 9;
  executeHexWeaponAction({
    actionId: 'CONTACT_FRONT',
    squad: [
      enemy({ unitId: 'e1', currentHp: 200, maxHp: 200 }),
      enemy({ unitId: 'e2', currentHp: 200, maxHp: 200, gridSlot: 'FL_0' }),
    ],
    targetId: 'e1',
    secondaryTargetId: 'e2',
    currentAmmo: ammo,
    maxAmmo: 5,
    classState,
    resolvedWeapon: resolveWeaponState('hex-carbine'),
    log: () => {},
    spendAmmo: (n) => {
      ammo -= n;
      return true;
    },
    hurtEnemy: (raw, _t, opts, tid) => {
      packs.push({ tid: tid ?? opts?.targetId ?? '', dmg: raw, acc: opts?.accuracyBonusPct ?? 0 });
      return true;
    },
  });
  assert.equal(ammo, 1);
  assert.equal(packs.length, 4);
  assert.equal(packs.filter((p) => p.tid === 'e1').length, 2);
  assert.equal(packs.filter((p) => p.tid === 'e2').length, 2);
  assert.ok(packs.filter((p) => p.tid === 'e1').every((p) => p.acc === 15));
  assert.ok(packs.filter((p) => p.tid === 'e2').every((p) => p.acc === 0));
  assert.equal(classState.firingSolutionUnitId, 'e1'); // not consumed

  // 4+0
  let ammo40 = 5;
  const p40: string[] = [];
  executeHexWeaponAction({
    actionId: 'CONTACT_FRONT',
    squad: [enemy({ unitId: 'e1', currentHp: 300, maxHp: 300 })],
    targetId: 'e1',
    secondaryTargetId: null,
    currentAmmo: ammo40,
    maxAmmo: 5,
    classState: createDefaultClassCombatEncounterState(),
    resolvedWeapon: resolveWeaponState('hex-carbine'),
    log: () => {},
    spendAmmo: (n) => {
      ammo40 -= n;
      return true;
    },
    hurtEnemy: (_r, _t, _o, tid) => {
      p40.push(tid ?? '');
      return true;
    },
  });
  assert.equal(ammo40, 1);
  assert.deepEqual(p40, ['e1', 'e1', 'e1', 'e1']);

  // Assigned-target death loses only that target's remaining shots.
  let ammoD = 5;
  const e1 = enemy({ unitId: 'e1', currentHp: 1, maxHp: 100 });
  const e2 = enemy({ unitId: 'e2', currentHp: 200, maxHp: 200, gridSlot: 'FL_0' });
  const sq = [e1, e2];
  const order: string[] = [];
  executeHexWeaponAction({
    actionId: 'CONTACT_FRONT',
    squad: sq,
    targetId: 'e1',
    secondaryTargetId: 'e2',
    currentAmmo: ammoD,
    maxAmmo: 5,
    classState: createDefaultClassCombatEncounterState(),
    resolvedWeapon: resolveWeaponState('hex-carbine'),
    log: () => {},
    spendAmmo: (n) => {
      ammoD -= n;
      return true;
    },
    hurtEnemy: (_r, _t, _o, tid) => {
      order.push(tid ?? '');
      if (tid === 'e1') {
        const u = sq.find((x) => x.unitId === 'e1');
        if (u) u.currentHp = 0;
      }
      return true;
    },
  });
  assert.equal(ammoD, 1);
  assert.equal(order.filter((id) => id === 'e1').length, 1);
  assert.equal(order.filter((id) => id === 'e2').length, 2);

  // Reject below 4 rounds.
  assert.equal(isHexWeaponActionEnabled('CONTACT_FRONT', 3, 5, 2), false);
  let ammoR = 3;
  const rej = executeHexWeaponAction({
    actionId: 'CONTACT_FRONT',
    squad: [enemy({ unitId: 'e1' })],
    targetId: 'e1',
    currentAmmo: ammoR,
    maxAmmo: 5,
    classState: createDefaultClassCombatEncounterState(),
    resolvedWeapon: resolveWeaponState('hex-carbine'),
    log: () => {},
    spendAmmo: (n) => {
      ammoR -= n;
      return true;
    },
    hurtEnemy: () => true,
  });
  assert.equal(rej.ok, false);
  assert.equal(ammoR, 3);
}

// FS accuracy never changes damage
{
  const weapon = resolveWeaponState('hex-carbine');
  const withFs = scaleHexWeaponAuthoredDamage(CENTER_MASS_BASE_DAMAGE, weapon);
  const without = scaleHexWeaponAuthoredDamage(CENTER_MASS_BASE_DAMAGE, weapon);
  assert.equal(withFs, without);
  assert.ok(hasFiringSolutionOn({
    firingSolutionUnitId: 'e1',
    firingSolutionExpiresAfterPlayerTurn: 2,
  }, 'e1'));
}

console.log('Phase W.3 — all assertions passed');
