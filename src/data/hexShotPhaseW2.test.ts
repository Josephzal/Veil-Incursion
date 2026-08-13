/**
 * Hex Shot Phase W.2 — 4+3 scaffold + Revolver kit.
 * Run: npx tsx src/data/hexShotPhaseW2.test.ts
 */
import assert from 'node:assert/strict';
import { buildHexCombatSurface } from './hexCombatCompatibility';
import {
  clearHexElusive,
  grantHexElusiveCharge,
  hasHexElusiveCharge,
  isHexElusiveEligibleIncoming,
  tryConsumeHexElusive,
} from './hexElusiveEngine';
import {
  extractHexFlexCandidates,
  sanitizeHexFlexLoadout,
  validateHexFlexLoadoutCommit,
} from './hexFlexLoadoutEngine';
import {
  getHexWeaponActionDefinition,
  HEX_REVOLVER_CATALOG,
  mapHexFixedBasicSignatureToWeaponAction,
} from './hexWeaponActionCatalog';
import {
  executeHexWeaponAction,
  isHexWeaponActionEnabled,
  isLastWordLegalTarget,
  LAST_WORD_BASE_DAMAGE,
  LAST_WORD_HP_RATIO,
  previewSixBellsRounds,
  scaleSidearmAuthoredDamage,
  SIX_BELLS_MIN_ROUNDS,
  SIX_BELLS_PACKET_DAMAGE,
  SLIPSHOT_BASE_DAMAGE,
} from './hexWeaponActionExecutor';
import {
  deriveHexWeaponActions,
  isHexWeaponActionExecutable,
  isHexWeaponActionId,
  isHexWeaponKitComplete,
} from './hexWeaponActionRegistry';
import { getAssignableHexShotAbilities } from './classAbilityUnlockEngine';
import { buildAegisCombatSurface } from './aegisCombatCompatibility';
import { DEFAULT_AEGIS_TECHNIQUE_LOADOUT } from '../types/aegisCombat';
import { createDefaultClassCombatEncounterState } from '../types/classCombatAbility';
import { DEFAULT_HEX_FLEX_LOADOUT, DEFAULT_HEX_SHOT_LOADOUT } from '../types/operativeClass';
import type { HexShotAbilityId } from '../types/operativeClass';
import type { EnemyCombatProfile } from '../types/run';
import { resolveWeaponState } from './weaponProgressionEngine';
import { resolveHexBasicShot } from './weaponBasicEngine';
import {
  normalizeHexShotLoadoutForCommit,
  validateHexShotLoadoutCommit,
} from '../utils/classLoadoutUtils';
import { getHexShotAbilityTags, HEX_SHOT_ABILITY_CATALOG } from './hexShotAbilities';
import { isHexAmmoHeavyShot, isHexFixedBasicAbilityId } from './hexShotPhaseH2aEngine';
import { classifyAbilitySocket } from './graftSynergy/graftCapacityEngine';
import { resolveHexShotAbilityGraftId } from './hexShotMigration';

console.log('Phase W.2 — Hex 4+3 scaffold + Revolver');

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

// ── Structural: Revolver kit + family gate ──────────────────────────────
{
  assert.equal(isHexWeaponKitComplete('hex-revolver'), true);
  assert.equal(isHexWeaponKitComplete('hex-carbine'), true);
  assert.equal(isHexWeaponKitComplete('hex-shotgun'), true);
  assert.deepEqual(deriveHexWeaponActions('hex-revolver'), [
    'QUICKDRAW',
    'SLIPSHOT',
    'SIX_BELLS',
    'LAST_WORD',
  ]);
  assert.equal(isHexWeaponActionExecutable('hex-revolver', 'QUICKDRAW'), true);
  assert.equal(isHexWeaponActionExecutable('hex-carbine', 'CENTER_MASS'), true);
  assert.equal(isHexWeaponActionExecutable('hex-shotgun', 'DEADBOLT'), true);
  assert.equal(isHexWeaponActionId('QUICKDRAW'), true);
  assert.equal(isHexWeaponActionId('ASH_JACKET_SALVO'), false);
  assert.equal(mapHexFixedBasicSignatureToWeaponAction('hex-revolver'), 'QUICKDRAW');
  assert.equal(mapHexFixedBasicSignatureToWeaponAction('hex-carbine'), 'CENTER_MASS');
}

// ── Combat surface: complete vs legacy ──────────────────────────────────
{
  const flex = DEFAULT_HEX_FLEX_LOADOUT;
  const revolver = buildHexCombatSurface({
    weaponFamilyId: 'hex-revolver',
    flex,
  });
  assert.equal(revolver.mode, 'WEAPON_KIT');
  assert.equal(revolver.weaponActionCount, 4);
  assert.equal(revolver.techniqueCount, 3);
  assert.deepEqual(revolver.hudCards, [
    'QUICKDRAW',
    'SLIPSHOT',
    'SIX_BELLS',
    'LAST_WORD',
    ...flex,
  ]);
  assert.ok(!revolver.hudCards.includes('SILVER_CORE_SIDEARM'));

  const ash = buildHexCombatSurface({
    weaponFamilyId: 'hex-carbine',
    flex,
  });
  assert.equal(ash.mode, 'WEAPON_KIT');
  assert.equal(ash.weaponActionCount, 4);
  assert.equal(ash.techniqueCount, 3);
  assert.deepEqual(ash.hudCards, [
    'CENTER_MASS',
    'CONTROLLED_BURST',
    'SUPPRESSIVE_BARRAGE',
    'CONTACT_FRONT',
    ...flex,
  ]);
  assert.ok(!ash.hudCards.includes('SILVER_CORE_SIDEARM'));

  const nullbreach = buildHexCombatSurface({
    weaponFamilyId: 'hex-shotgun',
    flex: ['REVENANTS_ECHO', 'RIFT_SNARE', 'SINGULARITY_SLUG'],
  });
  assert.equal(nullbreach.mode, 'WEAPON_KIT');
  assert.deepEqual(nullbreach.flex, ['REVENANTS_ECHO', 'RIFT_SNARE', 'SINGULARITY_SLUG']);
  assert.ok(nullbreach.hudCards.includes('DEADBOLT'));
  assert.ok(!nullbreach.hudCards.includes('SILVER_CORE_SIDEARM'));
}

// ── Flex persistence / migration ────────────────────────────────────────
{
  assert.deepEqual([...DEFAULT_HEX_SHOT_LOADOUT], [...DEFAULT_HEX_FLEX_LOADOUT]);
  assert.equal(validateHexShotLoadoutCommit([...DEFAULT_HEX_FLEX_LOADOUT]), null);

  const legacy = [
    'SILVER_CORE_SIDEARM',
    'ASH_JACKET_SALVO',
    'RIFT_SNARE',
    'SINGULARITY_SLUG',
  ] as const;
  assert.deepEqual(extractHexFlexCandidates(legacy), [
    'ASH_JACKET_SALVO',
    'RIFT_SNARE',
    'SINGULARITY_SLUG',
  ]);
  assert.deepEqual(sanitizeHexFlexLoadout(legacy), [
    'ASH_JACKET_SALVO',
    'RIFT_SNARE',
    'SINGULARITY_SLUG',
  ]);

  const deprecatedLegacy = [
    'SILVER_CORE_SIDEARM',
    'WRAITH_PIERCER_ROUND',
    'BLEEDING_PAYLOAD',
    'BLOOD_TRACER_ROUND',
  ];
  const migrated = normalizeHexShotLoadoutForCommit(deprecatedLegacy);
  assert.equal(migrated.length, 3);
  assert.equal(validateHexShotLoadoutCommit(migrated), null);
  assert.ok(!migrated.includes('SILVER_CORE_SIDEARM' as HexShotAbilityId));
  assert.ok(!migrated.includes('WRAITH_PIERCER_ROUND' as HexShotAbilityId));

  assert.ok(validateHexFlexLoadoutCommit(['QUICKDRAW', 'RIFT_SNARE', 'SINGULARITY_SLUG'] as never)?.includes('WEAPON ACTIONS'));
  assert.ok(validateHexFlexLoadoutCommit(['SILVER_CORE_SIDEARM', 'RIFT_SNARE', 'SINGULARITY_SLUG'] as never)?.includes('FIXED BASIC'));
  assert.ok(validateHexFlexLoadoutCommit(['ASH_JACKET_SALVO', 'ASH_JACKET_SALVO', 'RIFT_SNARE'])?.includes('DUPLICATE'));
  assert.ok(validateHexFlexLoadoutCommit(['PHASE_SHIFT_RELOAD', 'RIFT_SNARE', 'SINGULARITY_SLUG'] as never)?.includes('INTRINSIC'));
  assert.ok(validateHexFlexLoadoutCommit(['ZERO_PROTOCOL', 'RIFT_SNARE', 'SINGULARITY_SLUG'] as never)?.includes('ULTIMATE'));
  assert.ok(validateHexFlexLoadoutCommit(['WARDENS_STRIKE', 'RIFT_SNARE', 'SINGULARITY_SLUG'] as never)?.includes('NOT AN ASSIGNABLE'));

  // Inspection does not mutate input.
  const frozen = ['ASH_JACKET_SALVO', 'RIFT_SNARE', 'SINGULARITY_SLUG'] as HexShotAbilityId[];
  const snapshot = [...frozen];
  sanitizeHexFlexLoadout(frozen);
  validateHexFlexLoadoutCommit(frozen);
  assert.deepEqual(frozen, snapshot);

  // Weapon switch preserves flex (surface rebuild only).
  const flexKept = ['PANOPTICON_PROTOCOL', 'GHOST_GRID_CAMO', 'BLACKSITE_TRIAGE'] as const;
  const sidearmSurface = buildHexCombatSurface({
    weaponFamilyId: 'hex-revolver',
    flex: flexKept,
  });
  const ashSurface = buildHexCombatSurface({
    weaponFamilyId: 'hex-carbine',
    flex: flexKept,
  });
  assert.deepEqual(sidearmSurface.flex, [...flexKept]);
  assert.deepEqual(ashSurface.flex, [...flexKept]);
}

// ── All 165 unique flex triples ─────────────────────────────────────────
{
  const assignable = getAssignableHexShotAbilities();
  assert.equal(assignable.length, 11);
  const triples = combinations(assignable, 3);
  assert.equal(triples.length, 165);
  let ok = 0;
  for (const triple of triples) {
    const rejection = validateHexFlexLoadoutCommit(triple);
    assert.equal(rejection, null, String(triple));
    ok += 1;
  }
  assert.equal(ok, 165);
  console.log(`  flex triples validated: ${ok}/165`);
}

// ── Aegis grouping unchanged ────────────────────────────────────────────
{
  const surface = buildAegisCombatSurface({
    weaponFamilyId: 'aegis-longsword',
    techniques: DEFAULT_AEGIS_TECHNIQUE_LOADOUT,
  });
  assert.equal(surface.weaponActions.length, 4);
  assert.equal(surface.techniques.length, 3);
  assert.equal(surface.hudCards.length, 7);
}

// ── Quickdraw ladder / tags / heavy-shot parity ─────────────────────────
{
  const qd = getHexWeaponActionDefinition('QUICKDRAW')!;
  assert.equal(qd.apCost, 1);
  assert.equal(qd.ammoCost, 1);
  assert.equal(qd.staminaCost, 0);
  assert.ok(qd.tags.includes('BALLISTIC'));
  assert.ok(qd.tags.includes('ARMOR_BREAK'));
  assert.ok(isHexFixedBasicAbilityId('QUICKDRAW'));
  assert.ok(isHexFixedBasicAbilityId('SILVER_CORE_SIDEARM'));
  assert.ok(isHexAmmoHeavyShot({
    abilityId: 'QUICKDRAW',
    abilityTags: getHexShotAbilityTags('QUICKDRAW'),
  }));
  assert.equal(classifyAbilitySocket('HEX_SHOT', 'QUICKDRAW'), 'FIXED_BASIC_SIGNATURE');
  assert.equal(
    resolveHexShotAbilityGraftId({ SILVER_CORE_SIDEARM: 'BOTTOMLESS_DRUM_GRAFT' as never }, 'QUICKDRAW'),
    'BOTTOMLESS_DRUM_GRAFT',
  );

  // Stage II-C — tierless baseline; former T1/T2/T3 ladder collapsed to Tier I output.
  const ladder = [0, 1, 2].map(() => {
    const plan = resolveHexBasicShot({
      weapon: resolveWeaponState('hex-revolver'),
      squad: [enemy({ unitId: 'e1', currentHp: 100, maxHp: 100 })],
      primaryTargetId: 'e1',
      catalogBaseDamage: HEX_SHOT_ABILITY_CATALOG.SILVER_CORE_SIDEARM.baseDamage,
    });
    return plan.hits[0]!.damage;
  });
  assert.deepEqual(ladder, [10, 10, 10]);

  let ammo = 6;
  const squad = [enemy({ unitId: 'e1', currentHp: 20, maxHp: 100 })];
  const classState = createDefaultClassCombatEncounterState();
  const weapon = resolveWeaponState('hex-revolver');
  const hurt: number[] = [];
  const result = executeHexWeaponAction({
    actionId: 'QUICKDRAW',
    squad,
    targetId: 'e1',
    currentAmmo: ammo,
    maxAmmo: 6,
    classState,
    resolvedWeapon: weapon,
    log: () => {},
    spendAmmo: (n) => {
      if (ammo < n) return false;
      ammo -= n;
      return true;
    },
    hurtEnemy: (raw) => {
      hurt.push(raw);
      return true;
    },
  });
  assert.equal(result.ok, true);
  assert.equal(ammo, 5);
  assert.ok(hurt.length >= 1);
  // Tier I base 10; wounded ≤30% applies Sidearm window in resolveHexBasicShot.
  assert.ok(hurt[0]! >= 10);
}

// ── Slipshot + Elusive ──────────────────────────────────────────────────
{
  assert.equal(SLIPSHOT_BASE_DAMAGE, 8);
  assert.equal(HEX_REVOLVER_CATALOG.SLIPSHOT.apCost, 1);
  assert.equal(HEX_REVOLVER_CATALOG.SLIPSHOT.ammoCost, 1);

  let ammo = 6;
  const classState = createDefaultClassCombatEncounterState();
  assert.equal(classState.hexElusiveCharges, 0);
  const missResult = executeHexWeaponAction({
    actionId: 'SLIPSHOT',
    squad: [enemy({ unitId: 'e1' })],
    targetId: 'e1',
    currentAmmo: ammo,
    maxAmmo: 6,
    classState,
    resolvedWeapon: resolveWeaponState('hex-revolver'),
    log: () => {},
    spendAmmo: (n) => {
      if (ammo < n) return false;
      ammo -= n;
      return true;
    },
    hurtEnemy: () => false, // miss
  });
  assert.equal(missResult.ok, true);
  assert.equal(classState.hexElusiveCharges, 1);
  assert.ok(hasHexElusiveCharge({ charges: classState.hexElusiveCharges }));

  // Refresh, never stack.
  classState.hexElusiveCharges = grantHexElusiveCharge({ charges: 1 }).charges;
  assert.equal(classState.hexElusiveCharges, 1);

  // Invalid target — no spend, no Elusive.
  const dry = createDefaultClassCombatEncounterState();
  let ammo2 = 6;
  const bad = executeHexWeaponAction({
    actionId: 'SLIPSHOT',
    squad: [enemy({ unitId: 'e1' })],
    targetId: null,
    currentAmmo: ammo2,
    maxAmmo: 6,
    classState: dry,
    resolvedWeapon: null,
    log: () => {},
    spendAmmo: (n) => {
      ammo2 -= n;
      return true;
    },
    hurtEnemy: () => true,
  });
  assert.equal(bad.ok, false);
  assert.equal(ammo2, 6);
  assert.equal(dry.hexElusiveCharges, 0);

  // Eligibility gates.
  assert.equal(isHexElusiveEligibleIncoming({
    rawDamage: 10,
    hasAttacker: true,
  }), true);
  assert.equal(isHexElusiveEligibleIncoming({
    rawDamage: 10,
    hasAttacker: true,
    environmental: true,
  }), false);
  assert.equal(isHexElusiveEligibleIncoming({
    rawDamage: 10,
    hasAttacker: true,
    damageOverTime: true,
  }), false);
  assert.equal(isHexElusiveEligibleIncoming({
    rawDamage: 10,
    hasAttacker: true,
    indirectDamage: true,
  }), false);
  assert.equal(isHexElusiveEligibleIncoming({
    rawDamage: 10,
    hasAttacker: true,
    rollEvade: false,
  }), false);
  assert.equal(isHexElusiveEligibleIncoming({
    rawDamage: 10,
    hasAttacker: false,
  }), false);

  const consumed = tryConsumeHexElusive({ charges: 1 });
  assert.equal(consumed.forcedEvade, true);
  assert.equal(consumed.next.charges, 0);
  assert.equal(clearHexElusive({ charges: 1 }).charges, 0);
}

// ── Six Bells ───────────────────────────────────────────────────────────
{
  assert.equal(SIX_BELLS_PACKET_DAMAGE, 5);
  assert.equal(SIX_BELLS_MIN_ROUNDS, 2);
  assert.equal(previewSixBellsRounds(0, 6), 0);
  assert.equal(previewSixBellsRounds(1, 6), 0);
  assert.equal(previewSixBellsRounds(2, 6), 2);
  assert.equal(previewSixBellsRounds(6, 6), 6);
  assert.equal(previewSixBellsRounds(6, 4), 4);
  assert.equal(isHexWeaponActionEnabled('SIX_BELLS', 1, 6, 2), false);
  assert.equal(isHexWeaponActionEnabled('SIX_BELLS', 2, 6, 2), true);
  assert.equal(isHexWeaponActionEnabled('SIX_BELLS', 6, 6, 1), false);

  let ammo = 4;
  const target = enemy({ unitId: 'e1', currentHp: 200, maxHp: 200 });
  const squad = [target];
  const packets: number[] = [];
  const abilityIds: string[] = [];
  const result = executeHexWeaponAction({
    actionId: 'SIX_BELLS',
    squad,
    targetId: 'e1',
    currentAmmo: ammo,
    maxAmmo: 6,
    classState: createDefaultClassCombatEncounterState(),
    resolvedWeapon: resolveWeaponState('hex-revolver'),
    log: () => {},
    spendAmmo: (n) => {
      if (ammo < n) return false;
      ammo -= n;
      return true;
    },
    hurtEnemy: (raw, _tag, opts) => {
      packets.push(raw);
      abilityIds.push(String(opts?.abilityId));
      return true;
    },
  });
  assert.equal(result.ok, true);
  assert.equal(ammo, 0);
  assert.equal(packets.length, 4);
  packets.forEach((p) => {
    assert.equal(p, scaleSidearmAuthoredDamage(SIX_BELLS_PACKET_DAMAGE, resolveWeaponState('hex-revolver')));
  });
  assert.ok(abilityIds.every((id) => id === 'SIX_BELLS'));

  // Death truncates without refund.
  let ammoKill = 6;
  const fragile = enemy({ unitId: 'e1', currentHp: 1, maxHp: 100 });
  const killSquad = [fragile];
  let hits = 0;
  executeHexWeaponAction({
    actionId: 'SIX_BELLS',
    squad: killSquad,
    targetId: 'e1',
    currentAmmo: ammoKill,
    maxAmmo: 6,
    classState: createDefaultClassCombatEncounterState(),
    resolvedWeapon: resolveWeaponState('hex-revolver'),
    log: () => {},
    spendAmmo: (n) => {
      ammoKill -= n;
      return true;
    },
    hurtEnemy: (_raw, _tag, _opts, tid) => {
      hits += 1;
      const u = killSquad.find((e) => e.unitId === tid);
      if (u) u.currentHp = 0;
      return true;
    },
  });
  assert.equal(ammoKill, 0);
  assert.equal(hits, 1);
}

// ── Last Word ───────────────────────────────────────────────────────────
{
  assert.equal(LAST_WORD_BASE_DAMAGE, 14);
  assert.equal(LAST_WORD_HP_RATIO, 0.3);
  assert.equal(isLastWordLegalTarget(enemy({ unitId: 'e1', currentHp: 30, maxHp: 100 })), true);
  assert.equal(isLastWordLegalTarget(enemy({ unitId: 'e1', currentHp: 31, maxHp: 100 })), false);

  let ammo = 6;
  const above = enemy({ unitId: 'e1', currentHp: 50, maxHp: 100 });
  const reject = executeHexWeaponAction({
    actionId: 'LAST_WORD',
    squad: [above],
    targetId: 'e1',
    currentAmmo: ammo,
    maxAmmo: 6,
    classState: createDefaultClassCombatEncounterState(),
    resolvedWeapon: resolveWeaponState('hex-revolver'),
    log: () => {},
    spendAmmo: (n) => {
      ammo -= n;
      return true;
    },
    hurtEnemy: () => true,
  });
  assert.equal(reject.ok, false);
  assert.equal(ammo, 6);

  let ammoOk = 6;
  let killCb = 0;
  const low = enemy({ unitId: 'e1', currentHp: 20, maxHp: 100 });
  const squad = [low];
  const ok = executeHexWeaponAction({
    actionId: 'LAST_WORD',
    squad,
    targetId: 'e1',
    currentAmmo: ammoOk,
    maxAmmo: 6,
    classState: createDefaultClassCombatEncounterState(),
    resolvedWeapon: resolveWeaponState('hex-revolver'),
    log: () => {},
    spendAmmo: (n) => {
      ammoOk -= n;
      return true;
    },
    hurtEnemy: (_raw, _tag, _opts, tid) => {
      const u = squad.find((e) => e.unitId === tid);
      if (u) u.currentHp = 0;
      return true;
    },
    onLastWordSynchronousKill: () => {
      killCb += 1;
    },
  });
  assert.equal(ok.ok, true);
  assert.equal(ammoOk, 5);
  assert.equal(killCb, 1);

  // Miss / nonlethal — no refund callback.
  let missCb = 0;
  const low2 = enemy({ unitId: 'e1', currentHp: 20, maxHp: 100 });
  executeHexWeaponAction({
    actionId: 'LAST_WORD',
    squad: [low2],
    targetId: 'e1',
    currentAmmo: 6,
    maxAmmo: 6,
    classState: createDefaultClassCombatEncounterState(),
    resolvedWeapon: resolveWeaponState('hex-revolver'),
    log: () => {},
    spendAmmo: () => true,
    hurtEnemy: () => false,
    onLastWordSynchronousKill: () => {
      missCb += 1;
    },
  });
  assert.equal(missCb, 0);
}

console.log('Phase W.2 — all assertions passed');
