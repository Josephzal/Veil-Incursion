/**
 * Hex Shot Phase W.4 — Black Door kit + lane targeting + Threshold + Deadbolt.
 * Run: npx tsx src/data/hexShotPhaseW4.test.ts
 */
import assert from 'node:assert/strict';
import { buildHexCombatSurface } from './hexCombatCompatibility';
import {
  applyBlackDoorBacklineFalloff,
  BLACK_DOOR_BACKLINE_DAMAGE_MULT,
} from './hexBlackDoorPositionEngine';
import {
  armHexDeadboltReloadOpportunity,
  clearHexDeadboltOpportunity,
  consumeHexDeadboltReloadOpportunity,
  DEADBOLT_BASE_DAMAGE,
  DEADBOLT_PRIMED_DAMAGE,
  deadboltAuthoredBase,
} from './hexDeadboltEngine';
import {
  FATAL_FUNNEL_PRIMARY_DAMAGE,
  FATAL_FUNNEL_REAR_DAMAGE,
  previewFatalFunnelUnitIds,
  resolveFatalFunnelLane,
} from './hexFatalFunnelEngine';
import {
  armHexThreshold,
  clearHexThreshold,
  consumeHexThresholdArm,
  isHexThresholdEligibleEnemyAction,
  THRESHOLD_AUTHORED_DAMAGE,
  THRESHOLD_STAMINA_COST,
} from './hexThresholdEngine';
import { validateHexFlexLoadoutCommit } from './hexFlexLoadoutEngine';
import {
  formatHexWeaponActionLabel,
  getHexWeaponActionDefinition,
  mapHexFixedBasicSignatureToWeaponAction,
} from './hexWeaponActionCatalog';
import {
  DEADBOLT_BASE_AUTHORED,
  DEADBOLT_PRIMED_AUTHORED,
  executeHexWeaponAction,
  isHexWeaponActionEnabled,
  scaleHexWeaponAuthoredDamage,
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
import { resolveHexBasicShot } from './weaponBasicEngine';
import { HEX_SHOT_ABILITY_CATALOG } from './hexShotAbilities';

console.log('Phase W.4 — Hex Black Door kit + Threshold + Deadbolt');

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
  assert.equal(isHexWeaponKitComplete('hex-revolver'), true);
  assert.equal(isHexWeaponKitComplete('hex-carbine'), true);
  assert.equal(isHexWeaponKitComplete('hex-shotgun'), true);
  assert.deepEqual(deriveHexWeaponActions('hex-shotgun'), [
    'DOOR_KNOCKER',
    'FATAL_FUNNEL',
    'THRESHOLD',
    'DEADBOLT',
  ]);
  assert.equal(formatHexWeaponActionLabel('DOOR_KNOCKER'), '[ DOOR KNOCKER ]');
  assert.equal(formatHexWeaponActionLabel('FATAL_FUNNEL'), '[ FATAL FUNNEL ]');
  assert.equal(formatHexWeaponActionLabel('THRESHOLD'), '[ THRESHOLD ]');
  assert.equal(formatHexWeaponActionLabel('DEADBOLT'), '[ DEADBOLT ]');
  assert.equal(mapHexFixedBasicSignatureToWeaponAction('hex-shotgun'), 'DOOR_KNOCKER');
  assert.ok(isHexFixedBasicAbilityId('DOOR_KNOCKER'));
  assert.equal(classifyAbilitySocket('HEX_SHOT', 'DOOR_KNOCKER'), 'FIXED_BASIC_SIGNATURE');
  assert.equal(
    resolveHexShotAbilityGraftId({ SILVER_CORE_SIDEARM: 'BOTTOMLESS_DRUM_GRAFT' as never }, 'DOOR_KNOCKER'),
    'BOTTOMLESS_DRUM_GRAFT',
  );
  assert.equal(classAbilityTargetMode('HEX_SHOT', 'FATAL_FUNNEL'), 'COLUMN');
  assert.equal(classAbilityTargetMode('HEX_SHOT', 'THRESHOLD'), 'NONE');
  assert.equal(classAbilityTargetMode('HEX_SHOT', 'CONTACT_FRONT'), 'ONE_OR_TWO');
  assert.equal(classAbilityTargetMode('AEGIS', 'DIVERGENCE'), 'DUAL');
  assert.equal(classAbilityTargetMode('AEGIS', 'DREAD_HORIZON'), 'ROW');

  const flex = DEFAULT_HEX_FLEX_LOADOUT;
  const nullbreach = buildHexCombatSurface({ weaponFamilyId: 'hex-shotgun', flex });
  assert.equal(nullbreach.mode, 'WEAPON_KIT');
  assert.equal(nullbreach.weaponActionCount, 4);
  assert.equal(nullbreach.techniqueCount, 3);
  assert.deepEqual(nullbreach.hudCards, [
    'DOOR_KNOCKER', 'FATAL_FUNNEL', 'THRESHOLD', 'DEADBOLT', ...flex,
  ]);
  assert.ok(!nullbreach.hudCards.includes('SILVER_CORE_SIDEARM'));

  const revolver = buildHexCombatSurface({ weaponFamilyId: 'hex-revolver', flex });
  assert.deepEqual(revolver.hudCards.slice(0, 4), ['QUICKDRAW', 'SLIPSHOT', 'SIX_BELLS', 'LAST_WORD']);
  const carbine = buildHexCombatSurface({ weaponFamilyId: 'hex-carbine', flex });
  assert.deepEqual(carbine.hudCards.slice(0, 4), [
    'CENTER_MASS', 'CONTROLLED_BURST', 'SUPPRESSIVE_BARRAGE', 'CONTACT_FRONT',
  ]);
  assert.deepEqual(revolver.flex, flex);
  assert.deepEqual(carbine.flex, flex);
  assert.deepEqual(nullbreach.flex, flex);

  // No WA IDs as flex.
  for (const id of ['DOOR_KNOCKER', 'DEADBOLT', 'QUICKDRAW', 'CENTER_MASS'] as const) {
    assert.notEqual(
      validateHexFlexLoadoutCommit([id, 'RIFT_SNARE', 'SINGULARITY_SLUG'] as never),
      null,
    );
  }
}

// ── 165 flex triples ────────────────────────────────────────────────────
{
  const assignable = getAssignableHexShotAbilities();
  const triples = combinations(assignable, 3);
  assert.equal(triples.length, 165);
  let ok = 0;
  for (const t of triples) {
    if (validateHexFlexLoadoutCommit(t as never) === null) ok += 1;
  }
  assert.equal(ok, 165);
  console.log(`  flex triples validated: ${ok}/165`);
}

// ── Position falloff ────────────────────────────────────────────────────
{
  assert.equal(BLACK_DOOR_BACKLINE_DAMAGE_MULT, 0.75);
  assert.equal(applyBlackDoorBacklineFalloff(20, false), 20);
  assert.equal(applyBlackDoorBacklineFalloff(20, true), 15);
}

// ── Door Knocker ────────────────────────────────────────────────────────
{
  const weapon = resolveWeaponState('hex-shotgun');
  const fl = enemy({ unitId: 'fl', gridSlot: 'FL_0', kineticArmor: 0 });
  const plan = resolveHexBasicShot({
    weapon,
    squad: [fl],
    primaryTargetId: 'fl',
    catalogBaseDamage: 16,
  });
  assert.equal(plan.hits[0]!.damage, 19);
  assert.ok(plan.staminaCost >= 4);
  assert.equal(plan.innateArmorPressureLayers, 1);

  const armored = enemy({ unitId: 'a', gridSlot: 'FL_0', kineticArmor: 2 });
  const armoredPlan = resolveHexBasicShot({
    weapon,
    squad: [armored],
    primaryTargetId: 'a',
    catalogBaseDamage: 16,
  });
  assert.equal(armoredPlan.hits[0]!.damage, Math.floor(19 * 1.1));

  const bl = enemy({ unitId: 'bl', gridSlot: 'BL_0' });
  const blPlan = resolveHexBasicShot({
    weapon,
    squad: [bl],
    primaryTargetId: 'bl',
    catalogBaseDamage: 16,
  });
  assert.equal(blPlan.hits[0]!.damage, Math.floor(19 * 0.75));

  let ammo = 4;
  let stam = 40;
  const hits: number[] = [];
  const state = createDefaultClassCombatEncounterState();
  const res = executeHexWeaponAction({
    actionId: 'DOOR_KNOCKER',
    squad: [fl],
    targetId: 'fl',
    currentAmmo: ammo,
    maxAmmo: 4,
    classState: state,
    resolvedWeapon: weapon,
    log: () => {},
    spendAmmo: (n) => { ammo -= n; return true; },
    spendStamina: (n) => { if (stam < n) return false; stam -= n; return true; },
    hurtEnemy: (raw) => { hits.push(raw); return true; },
  });
  assert.equal(res.ok, true);
  assert.equal(hits[0], 19);
  assert.equal(ammo, 3);
  assert.ok(stam < 40);
  assert.equal(getHexWeaponActionDefinition('DOOR_KNOCKER')?.apCost, 1);
}

// ── Fatal Funnel ────────────────────────────────────────────────────────
{
  const weapon = resolveWeaponState('hex-shotgun');
  const fl = enemy({ unitId: 'fl0', gridSlot: 'FL_0', currentHp: 100 });
  const bl = enemy({ unitId: 'bl0', gridSlot: 'BL_0', currentHp: 100 });
  const other = enemy({ unitId: 'fl1', gridSlot: 'FL_1', currentHp: 100 });

  assert.equal(resolveFatalFunnelLane([fl, bl, other], null), null);
  const both = resolveFatalFunnelLane([fl, bl, other], 'fl0')!;
  assert.equal(both.hits.length, 2);
  assert.equal(both.hits[0]!.authoredDamage, FATAL_FUNNEL_PRIMARY_DAMAGE);
  assert.equal(both.hits[1]!.authoredDamage, FATAL_FUNNEL_REAR_DAMAGE);
  assert.ok(!previewFatalFunnelUnitIds([fl, bl, other], 'fl0').includes('fl1'));

  const rearOnly = resolveFatalFunnelLane([bl], 'bl0')!;
  assert.equal(rearOnly.hits.length, 1);
  assert.equal(rearOnly.hits[0]!.authoredDamage, 16);
  assert.equal(rearOnly.hits[0]!.isBackline, true);

  let ammo = 4;
  let stam = 40;
  const packets: Array<{ id: string; dmg: number }> = [];
  const state = createDefaultClassCombatEncounterState();
  const res = executeHexWeaponAction({
    actionId: 'FATAL_FUNNEL',
    squad: [fl, bl, other],
    targetId: 'fl0',
    currentAmmo: ammo,
    maxAmmo: 4,
    classState: state,
    resolvedWeapon: weapon,
    log: () => {},
    spendAmmo: (n) => { ammo -= n; return true; },
    spendStamina: (n) => { stam -= n; return true; },
    hurtEnemy: (raw, _t, opts) => {
      packets.push({ id: opts?.targetId ?? '', dmg: raw });
      return true;
    },
  });
  assert.equal(res.ok, true);
  assert.equal(ammo, 3);
  assert.equal(stam, 40 - 12);
  assert.equal(packets.length, 2);
  assert.equal(packets[0]!.id, 'fl0');
  assert.equal(packets[0]!.dmg, scaleHexWeaponAuthoredDamage(16, weapon));
  assert.equal(
    packets[1]!.dmg,
    applyBlackDoorBacklineFalloff(scaleHexWeaponAuthoredDamage(11, weapon), true),
  );
  assert.ok(!packets.some((p) => p.id === 'fl1'));

  // Primary death does not stop snapshotted rear.
  const flLow = enemy({ unitId: 'fl0', gridSlot: 'FL_0', currentHp: 1 });
  const blLive = enemy({ unitId: 'bl0', gridSlot: 'BL_0', currentHp: 50 });
  const squad = [flLow, blLive];
  const seen: string[] = [];
  executeHexWeaponAction({
    actionId: 'FATAL_FUNNEL',
    squad,
    targetId: 'fl0',
    currentAmmo: 4,
    maxAmmo: 4,
    classState: createDefaultClassCombatEncounterState(),
    resolvedWeapon: weapon,
    log: () => {},
    spendAmmo: () => true,
    spendStamina: () => true,
    hurtEnemy: (_r, _t, opts) => {
      const id = opts?.targetId!;
      seen.push(id);
      const u = squad.find((x) => x.unitId === id)!;
      u.currentHp = 0;
      return true;
    },
  });
  assert.deepEqual(seen, ['fl0', 'bl0']);

  // Reject empty lane / insufficient ammo without mutation.
  let ammo2 = 0;
  const reject = executeHexWeaponAction({
    actionId: 'FATAL_FUNNEL',
    squad: [fl],
    targetId: 'fl0',
    currentAmmo: ammo2,
    maxAmmo: 4,
    classState: createDefaultClassCombatEncounterState(),
    resolvedWeapon: weapon,
    log: () => {},
    spendAmmo: () => { ammo2 -= 1; return true; },
    spendStamina: () => true,
    hurtEnemy: () => true,
  });
  assert.equal(reject.ok, false);
  assert.equal(ammo2, 0);
}

// ── Threshold engine ────────────────────────────────────────────────────
{
  assert.equal(THRESHOLD_AUTHORED_DAMAGE, 14);
  assert.equal(THRESHOLD_STAMINA_COST, 15);
  assert.equal(isHexThresholdEligibleEnemyAction('STRIKE'), true);
  assert.equal(isHexThresholdEligibleEnemyAction('DOUBLE_STRIKE'), true);
  assert.equal(isHexThresholdEligibleEnemyAction('EVADE'), false);
  assert.equal(isHexThresholdEligibleEnemyAction('FIELD_REPAIR'), false);
  assert.equal(isHexThresholdEligibleEnemyAction('STRIP_STAMINA'), false);
  assert.equal(isHexThresholdEligibleEnemyAction('FORTIFY'), false);

  let armed = armHexThreshold(clearHexThreshold({
    thresholdArmed: false,
    thresholdSnapshot: null,
  }), {
    ammoType: 'SILVER_CORE',
    nextShotOvercharged: true,
    overchargeMultiplier: 0.2,
    firstShotPenaltyPending: false,
  })!;
  assert.equal(armed.thresholdArmed, true);
  assert.equal(armHexThreshold(armed, {
    ammoType: 'SILVER_CORE',
    nextShotOvercharged: false,
    overchargeMultiplier: 0,
    firstShotPenaltyPending: false,
  }), null);

  const consumed = consumeHexThresholdArm(armed);
  assert.equal(consumed.fired, true);
  assert.equal(consumed.snapshot?.nextShotOvercharged, true);
  assert.equal(consumed.next.thresholdArmed, false);

  // Arm via executor
  const weapon = resolveWeaponState('hex-shotgun');
  let ammo = 4;
  let stam = 40;
  let clearedFlags = false;
  const state = createDefaultClassCombatEncounterState();
  state.deadboltReloadOpportunity = true;
  const res = executeHexWeaponAction({
    actionId: 'THRESHOLD',
    squad: [],
    targetId: null,
    currentAmmo: ammo,
    maxAmmo: 4,
    classState: state,
    resolvedWeapon: weapon,
    thresholdArmSnapshot: {
      ammoType: 'WRAITHGLASS',
      nextShotOvercharged: true,
      overchargeMultiplier: 0.2,
      firstShotPenaltyPending: false,
    },
    onThresholdArmed: () => { clearedFlags = true; },
    log: () => {},
    spendAmmo: (n) => { ammo -= n; return true; },
    spendStamina: (n) => { stam -= n; return true; },
    hurtEnemy: () => true,
  });
  assert.equal(res.ok, true);
  assert.equal(ammo, 3);
  assert.equal(stam, 25);
  assert.equal(state.thresholdArmed, true);
  assert.equal(state.thresholdAmmoType, 'WRAITHGLASS');
  assert.equal(state.thresholdNextShotOvercharged, true);
  assert.equal(state.deadboltReloadOpportunity, true); // not consumed
  assert.equal(clearedFlags, true);
  assert.equal(isHexWeaponActionEnabled('THRESHOLD', 3, 4, 2, {
    stamina: 40,
    thresholdArmed: true,
  }), false);

  // Reject while armed
  const reject = executeHexWeaponAction({
    actionId: 'THRESHOLD',
    squad: [],
    targetId: null,
    currentAmmo: 3,
    maxAmmo: 4,
    classState: state,
    resolvedWeapon: weapon,
    thresholdArmSnapshot: {
      ammoType: 'SILVER_CORE',
      nextShotOvercharged: false,
      overchargeMultiplier: 0,
      firstShotPenaltyPending: false,
    },
    log: () => {},
    spendAmmo: () => true,
    spendStamina: () => true,
    hurtEnemy: () => true,
  });
  assert.equal(reject.ok, false);
}

// ── Deadbolt opportunity + shot ─────────────────────────────────────────
{
  assert.equal(DEADBOLT_BASE_DAMAGE, 22);
  assert.equal(DEADBOLT_PRIMED_DAMAGE, 28);
  assert.equal(deadboltAuthoredBase(false), 22);
  assert.equal(deadboltAuthoredBase(true), 28);

  let opp = clearHexDeadboltOpportunity({ deadboltReloadOpportunity: false });
  assert.equal(armHexDeadboltReloadOpportunity(opp, {
    familyId: 'hex-carbine',
    roundsRestored: 4,
  }).deadboltReloadOpportunity, false);
  assert.equal(armHexDeadboltReloadOpportunity(opp, {
    familyId: 'hex-shotgun',
    roundsRestored: 0,
  }).deadboltReloadOpportunity, false);
  opp = armHexDeadboltReloadOpportunity(opp, {
    familyId: 'hex-shotgun',
    roundsRestored: 4,
  });
  assert.equal(opp.deadboltReloadOpportunity, true);
  opp = armHexDeadboltReloadOpportunity(opp, {
    familyId: 'hex-shotgun',
    roundsRestored: 4,
  });
  assert.equal(opp.deadboltReloadOpportunity, true); // refresh, no stack

  const weapon = resolveWeaponState('hex-shotgun');
  const target = enemy({ unitId: 't', gridSlot: 'FL_0' });

  // Unprimed 22
  let ammo = 4;
  let stam = 40;
  let dmg = 0;
  const state = createDefaultClassCombatEncounterState();
  executeHexWeaponAction({
    actionId: 'DEADBOLT',
    squad: [target],
    targetId: 't',
    currentAmmo: ammo,
    maxAmmo: 4,
    classState: state,
    resolvedWeapon: weapon,
    log: () => {},
    spendAmmo: (n) => { ammo -= n; return true; },
    spendStamina: (n) => { stam -= n; return true; },
    hurtEnemy: (raw) => { dmg = raw; return true; },
  });
  assert.equal(dmg, scaleHexWeaponAuthoredDamage(DEADBOLT_BASE_AUTHORED, weapon));
  assert.equal(ammo, 3);
  assert.equal(stam, 26);

  // Primed 28 — consumed on miss too
  const state2 = createDefaultClassCombatEncounterState();
  state2.deadboltReloadOpportunity = true;
  let dmg2 = 0;
  executeHexWeaponAction({
    actionId: 'DEADBOLT',
    squad: [target],
    targetId: 't',
    currentAmmo: 4,
    maxAmmo: 4,
    classState: state2,
    resolvedWeapon: weapon,
    log: () => {},
    spendAmmo: () => true,
    spendStamina: () => true,
    hurtEnemy: (raw) => { dmg2 = raw; return false; }, // miss
  });
  assert.equal(dmg2, scaleHexWeaponAuthoredDamage(DEADBOLT_PRIMED_AUTHORED, weapon));
  assert.equal(state2.deadboltReloadOpportunity, false);

  // Reject does not consume
  const state3 = createDefaultClassCombatEncounterState();
  state3.deadboltReloadOpportunity = true;
  const rej = executeHexWeaponAction({
    actionId: 'DEADBOLT',
    squad: [target],
    targetId: null,
    currentAmmo: 4,
    maxAmmo: 4,
    classState: state3,
    resolvedWeapon: weapon,
    log: () => {},
    spendAmmo: () => true,
    spendStamina: () => true,
    hurtEnemy: () => true,
  });
  assert.equal(rej.ok, false);
  assert.equal(state3.deadboltReloadOpportunity, true);

  // Backline falloff on primed
  const bl = enemy({ unitId: 'b', gridSlot: 'BL_0' });
  const state4 = createDefaultClassCombatEncounterState();
  state4.deadboltReloadOpportunity = true;
  let dmgBl = 0;
  executeHexWeaponAction({
    actionId: 'DEADBOLT',
    squad: [bl],
    targetId: 'b',
    currentAmmo: 4,
    maxAmmo: 4,
    classState: state4,
    resolvedWeapon: weapon,
    log: () => {},
    spendAmmo: () => true,
    spendStamina: () => true,
    hurtEnemy: (raw) => { dmgBl = raw; return true; },
  });
  const primedScaled = scaleHexWeaponAuthoredDamage(28, weapon);
  assert.equal(dmgBl, applyBlackDoorBacklineFalloff(primedScaled, true));

  void consumeHexDeadboltReloadOpportunity;
  void HEX_SHOT_ABILITY_CATALOG;
}

console.log('Phase W.4 — all assertions passed');
