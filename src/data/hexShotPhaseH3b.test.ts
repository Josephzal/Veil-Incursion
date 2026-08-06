/**
 * Hex Shot Phase H.3b — eleven-flex roster, Cinderline, Blacksite Triage, Salvo packets.
 * Run: npx tsx src/data/hexShotPhaseH3b.test.ts
 */
import assert from 'node:assert/strict';
import {
  getAssignableHexShotAbilities,
  HEX_SHOT_ANCHOR,
  HEX_SHOT_DEPRECATED_ABILITIES,
  HEX_SHOT_INTRINSIC,
  sanitizeHexShotCombatLoadout,
} from './classAbilityUnlockEngine';
import { HEX_SHOT_ABILITY_CATALOG, getHexShotAbilityTags } from './hexShotAbilities';
import { getHexAmmoProfileForAbility, formatHexAmmoCounterHint } from './hexShotAmmoProfiles';
import { shouldApplyPhantomFeed } from './hexShotIntrinsics';
import {
  executeHexShotAbility,
  isHexShotAbilityEnabled,
} from './hexShotAbilityExecutor';
import {
  ASH_JACKET_SALVO_AGGREGATE,
  ASH_JACKET_SALVO_PACKETS,
  BLACKSITE_TRIAGE_STAMINA_COST,
  CINDERLINE_DURATION_ROUNDS,
  CINDERLINE_STAMINA_COST,
  CINDERLINE_TICK_DAMAGE,
  HEX_H3B_ASSIGNABLE_FLEX,
  advanceCinderlineHazardsAfterEnemyPhase,
  canCastBlacksiteTriage,
  clearCinderlineHazards,
  resolveBlacksiteTriageAuthoredHeal,
  resolveBlacksiteTriageEffectiveHeal,
  resolveCinderlineTickForUnit,
  seedCinderlineHazard,
} from './hexShotPhaseH3bEngine';
import { isHexAmmoHeavyShot } from './hexShotPhaseH2aEngine';
import { createDefaultClassCombatEncounterState } from '../types/classCombatAbility';
import { DEFAULT_HEX_SHOT_LOADOUT } from '../types/operativeClass';
import type { HexShotAbilityId } from '../types/operativeClass';
import type { EnemyCombatProfile } from '../types/run';
import {
  normalizeHexShotLoadoutForCommit,
  validateHexShotLoadoutCommit,
} from '../utils/classLoadoutUtils';
import { migrateDeprecatedHexShotLoadoutId, migrateHexShotAbilityId } from './hexShotMigration';
import { classAbilityTargetMode } from './combatClassTargeting';
import type { ResolvedWeaponCombatStats } from './inventory';

console.log('Phase H.3b — Hex eleven-flex roster + repairs');

const strikeStats = {
  strikeDamage: 10,
  strikeStaminaCost: 0,
} as ResolvedWeaponCombatStats;

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

function mockCtx(overrides: Partial<Parameters<typeof executeHexShotAbility>[0]> & {
  abilityId: HexShotAbilityId;
  classState?: ReturnType<typeof createDefaultClassCombatEncounterState>;
}) {
  let ammo = overrides.currentAmmo ?? 6;
  let stam = 100;
  const hurtLog: Array<{ dmg: number; tag: string; opts?: unknown }> = [];
  const classState = overrides.classState ?? createDefaultClassCombatEncounterState();
  let healed = 0;
  const {
    abilityId,
    squad = [enemy({ unitId: 'e1' })],
    targetId = 'e1',
    operativeCurrentHp = 50,
    operativeMaxHp = 100,
    currentAmmo: _ignoredAmmo,
    classState: _ignoredState,
    ...rest
  } = overrides;
  const ctx = {
    abilityId,
    squad,
    targetId,
    strikeStats,
    currentAmmo: ammo,
    maxAmmo: 6,
    maxSoulAnchor: 100,
    classState,
    log: () => {},
    spendAmmo: (n: number) => {
      if (ammo < n) return false;
      ammo -= n;
      return true;
    },
    spendStamina: (n: number) => {
      if (stam < n) return false;
      stam -= n;
      return true;
    },
    spendStaminaPct: () => true,
    hurtEnemy: (raw: number, tag: string, options?: unknown) => {
      hurtLog.push({ dmg: raw, tag, opts: options });
      return true;
    },
    patchUnit: () => {},
    syncSquad: () => {},
    healOperative: (n: number) => { healed += n; },
    reduceEnemyAp: () => {},
    emptyMagazine: () => {},
    operativeCurrentHp,
    operativeMaxHp,
    ...rest,
    get ammoLeft() { return ammo; },
    get stamLeft() { return stam; },
    get healed() { return healed; },
    hurtLog,
  };
  return ctx;
}

// ── Roster ──────────────────────────────────────────────────────────────
{
  assert.equal(Object.keys(HEX_SHOT_ABILITY_CATALOG).length, 18);
  const assignable = getAssignableHexShotAbilities();
  assert.equal(assignable.length, 11);
  assert.deepEqual([...assignable].sort(), [...HEX_H3B_ASSIGNABLE_FLEX].sort());
  assert.deepEqual([...DEFAULT_HEX_SHOT_LOADOUT], [
    'ASH_JACKET_SALVO',
    'RIFT_SNARE',
    'SINGULARITY_SLUG',
  ]);
  assert.equal(HEX_SHOT_ANCHOR, 'SILVER_CORE_SIDEARM');
  for (const id of HEX_SHOT_INTRINSIC) {
    assert.ok(!assignable.includes(id));
  }
  for (const id of HEX_SHOT_DEPRECATED_ABILITIES) {
    assert.ok(!assignable.includes(id));
  }
  assert.ok(!assignable.includes('SILVER_CORE_SIDEARM'));
  assert.equal(HEX_SHOT_ABILITY_CATALOG.PANOPTICON_PROTOCOL.label, '[ PANOPTICON WATCH ]');
  assert.equal(HEX_SHOT_ABILITY_CATALOG.PANOPTICON_PROTOCOL.id, 'PANOPTICON_PROTOCOL');
}

// Loadout validation (W.2 three-flex)
{
  assert.equal(validateHexShotLoadoutCommit([...DEFAULT_HEX_SHOT_LOADOUT]), null);
  assert.ok(validateHexShotLoadoutCommit([
    'WRAITH_PIERCER_ROUND',
    'RIFT_SNARE',
    'SINGULARITY_SLUG',
  ] as never)?.includes('DEPRECATED'));
  assert.ok(validateHexShotLoadoutCommit([
    'ASH_JACKET_SALVO',
    'ASH_JACKET_SALVO',
    'RIFT_SNARE',
  ])?.includes('DUPLICATE'));
  assert.ok(validateHexShotLoadoutCommit([
    'PHASE_SHIFT_RELOAD',
    'RIFT_SNARE',
    'SINGULARITY_SLUG',
  ] as never)?.includes('INTRINSIC'));
  // Legacy 4-tuple migrates by dropping slot0.
  const sanitized = normalizeHexShotLoadoutForCommit([
    'SILVER_CORE_SIDEARM',
    'BLEEDING_PAYLOAD',
    'STASIS_LOCK_SLUG',
    'BLOOD_TRACER_ROUND',
  ]);
  assert.equal(sanitized[0], 'RIFT_SNARE');
  assert.equal(sanitized[1], 'PANOPTICON_PROTOCOL');
  assert.equal(sanitized[2], 'REVENANTS_ECHO');
  assert.equal(validateHexShotLoadoutCommit(sanitized), null);
  assert.equal(migrateHexShotAbilityId('BRIMSTONE_PAYLOAD'), 'BLEEDING_PAYLOAD');
  assert.equal(migrateDeprecatedHexShotLoadoutId('WRAITH_PIERCER_ROUND'), 'SINGULARITY_SLUG');
  assert.deepEqual(
    sanitizeHexShotCombatLoadout([...DEFAULT_HEX_SHOT_LOADOUT]),
    [...DEFAULT_HEX_SHOT_LOADOUT],
  );
}

// ── Ash Jacket Salvo packets ────────────────────────────────────────────
{
  const ctx = mockCtx({ abilityId: 'ASH_JACKET_SALVO', currentAmmo: 6 });
  const result = executeHexShotAbility(ctx as never);
  assert.equal(result.ok, true);
  assert.equal(ctx.ammoLeft, 3);
  assert.equal(ctx.hurtLog.length, 3);
  assert.deepEqual(ctx.hurtLog.map((h) => h.dmg), [...ASH_JACKET_SALVO_PACKETS]);
  assert.equal(ASH_JACKET_SALVO_PACKETS.reduce((a, b) => a + b, 0), ASH_JACKET_SALVO_AGGREGATE);
  const tags = getHexShotAbilityTags('ASH_JACKET_SALVO');
  assert.ok(tags.includes('BALLISTIC'));
  assert.equal(
    isHexAmmoHeavyShot({ abilityId: 'ASH_JACKET_SALVO', abilityTags: tags }),
    false,
  );
  // Cancel / invalid target
  const bad = mockCtx({ abilityId: 'ASH_JACKET_SALVO', targetId: null, currentAmmo: 6 });
  const rejected = executeHexShotAbility(bad as never);
  assert.equal(rejected.ok, false);
  assert.equal(bad.hurtLog.length, 0);
}

// ── Astral profile ──────────────────────────────────────────────────────
{
  assert.equal(getHexAmmoProfileForAbility('ASTRAL_TARGET_LOCK')?.id, 'TACTICAL');
  const hint = formatHexAmmoCounterHint('ASTRAL_TARGET_LOCK') ?? '';
  assert.ok(hint.toLowerCase().includes('setup') || hint.toLowerCase().includes('does not'));
  assert.ok(!hint.toLowerCase().includes('fires round'));
  assert.equal(HEX_SHOT_ABILITY_CATALOG.ASTRAL_TARGET_LOCK.ammoCost, 0);
  assert.ok(!getHexShotAbilityTags('ASTRAL_TARGET_LOCK').includes('BALLISTIC'));
  const state = createDefaultClassCombatEncounterState();
  const ctx = mockCtx({
    abilityId: 'ASTRAL_TARGET_LOCK',
    classState: state,
    currentAmmo: 4,
  });
  assert.equal(executeHexShotAbility(ctx as never).ok, true);
  assert.equal(ctx.ammoLeft, 4);
  assert.equal(state.astralLockUnitId, 'e1');
  // Tactical/self do not consume lock via resolveAstralLockCrit (BALLISTIC gate) — covered in classCombatStateEngine.
}

// ── Cinderline Saturation ───────────────────────────────────────────────
{
  const state = createDefaultClassCombatEncounterState();
  const unit = enemy({ unitId: 'e1', gridSlot: 'FL_0' });
  const ctx = mockCtx({
    abilityId: 'CINDERLINE_SATURATION',
    squad: [unit],
    targetId: 'e1',
    classState: state,
  });
  assert.equal(HEX_SHOT_ABILITY_CATALOG.CINDERLINE_SATURATION.staminaCost, CINDERLINE_STAMINA_COST);
  assert.equal(HEX_SHOT_ABILITY_CATALOG.CINDERLINE_SATURATION.ammoCost, 0);
  assert.ok(!getHexShotAbilityTags('CINDERLINE_SATURATION').includes('BALLISTIC'));
  assert.equal(shouldApplyPhantomFeed('CINDERLINE_SATURATION'), false);
  assert.equal(executeHexShotAbility(ctx as never).ok, true);
  assert.equal(ctx.hurtLog.length, 0);
  assert.equal(ctx.ammoLeft, 6);
  assert.equal(state.cinderlineHazards.FL_0?.roundsRemaining, CINDERLINE_DURATION_ROUNDS);

  const tick1 = resolveCinderlineTickForUnit(state, unit);
  assert.equal(tick1?.damage, CINDERLINE_TICK_DAMAGE);
  const tick1b = resolveCinderlineTickForUnit(state, unit);
  assert.equal(tick1b, null); // once per enemy round

  // Entrant on same slot after phase advance still eligible
  advanceCinderlineHazardsAfterEnemyPhase(state);
  assert.equal(state.cinderlineHazards.FL_0?.roundsRemaining, 1);
  const entrant = enemy({ unitId: 'e2', gridSlot: 'FL_0' });
  const tickEntrant = resolveCinderlineTickForUnit(state, entrant);
  assert.equal(tickEntrant?.damage, CINDERLINE_TICK_DAMAGE);

  // Leaver on different slot — no tick
  const leaver = enemy({ unitId: 'e3', gridSlot: 'BL_1' });
  assert.equal(resolveCinderlineTickForUnit(state, leaver), null);

  // Recast refreshes without stacking
  seedCinderlineHazard(state, 'FL_0');
  assert.equal(state.cinderlineHazards.FL_0?.roundsRemaining, 2);
  seedCinderlineHazard(state, 'BL_1');
  assert.ok(state.cinderlineHazards.FL_0);
  assert.ok(state.cinderlineHazards.BL_1);

  clearCinderlineHazards(state);
  assert.equal(Object.keys(state.cinderlineHazards).length, 0);

  const noTarget = mockCtx({
    abilityId: 'CINDERLINE_SATURATION',
    targetId: null,
  });
  assert.equal(executeHexShotAbility(noTarget as never).ok, false);
  assert.equal(classAbilityTargetMode('HEX_SHOT', 'CINDERLINE_SATURATION'), 'SINGLE');
}

// ── Blacksite Triage ────────────────────────────────────────────────────
{
  assert.equal(HEX_SHOT_ABILITY_CATALOG.BLACKSITE_TRIAGE.staminaCost, BLACKSITE_TRIAGE_STAMINA_COST);
  assert.equal(resolveBlacksiteTriageAuthoredHeal(100), 20);
  assert.equal(resolveBlacksiteTriageEffectiveHeal(95, 100), 5);
  assert.equal(resolveBlacksiteTriageEffectiveHeal(100, 100), 0);
  assert.equal(shouldApplyPhantomFeed('BLACKSITE_TRIAGE'), false);
  assert.equal(classAbilityTargetMode('HEX_SHOT', 'BLACKSITE_TRIAGE'), 'NONE');

  const state = createDefaultClassCombatEncounterState();
  const ok = canCastBlacksiteTriage(state, 40, 100);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.heal, 20);

  const ctx = mockCtx({
    abilityId: 'BLACKSITE_TRIAGE',
    classState: state,
    operativeCurrentHp: 40,
    operativeMaxHp: 100,
    targetId: null,
  });
  assert.equal(executeHexShotAbility(ctx as never).ok, true);
  assert.equal(ctx.healed, 20);
  assert.equal(state.blacksiteTriageUsed, true);
  assert.equal(ctx.ammoLeft, 6);
  assert.equal(ctx.hurtLog.length, 0);

  const again = mockCtx({
    abilityId: 'BLACKSITE_TRIAGE',
    classState: state,
    operativeCurrentHp: 40,
    operativeMaxHp: 100,
  });
  assert.equal(executeHexShotAbility(again as never).ok, false);
  assert.equal(again.healed, 0);

  const full = mockCtx({
    abilityId: 'BLACKSITE_TRIAGE',
    classState: createDefaultClassCombatEncounterState(),
    operativeCurrentHp: 100,
    operativeMaxHp: 100,
  });
  assert.equal(executeHexShotAbility(full as never).ok, false);

  const fresh = createDefaultClassCombatEncounterState();
  assert.equal(fresh.blacksiteTriageUsed, false);
  assert.equal(
    isHexShotAbilityEnabled(
      'BLACKSITE_TRIAGE',
      6,
      6,
      100,
      fresh,
      undefined,
      { current: 50, max: 100 },
    ),
    true,
  );
  fresh.blacksiteTriageUsed = true;
  assert.equal(
    isHexShotAbilityEnabled(
      'BLACKSITE_TRIAGE',
      6,
      6,
      100,
      fresh,
      undefined,
      { current: 50, max: 100 },
    ),
    false,
  );
}

// Heavy / ammo inheritance guards for new flex
{
  assert.equal(
    isHexAmmoHeavyShot({
      abilityId: 'CINDERLINE_SATURATION',
      abilityTags: getHexShotAbilityTags('CINDERLINE_SATURATION'),
    }),
    false,
  );
  assert.equal(
    isHexAmmoHeavyShot({
      abilityId: 'BLACKSITE_TRIAGE',
      abilityTags: getHexShotAbilityTags('BLACKSITE_TRIAGE'),
    }),
    false,
  );
}

console.log('Phase H.3b — all assertions passed');
console.log('  assignable flex =', getAssignableHexShotAbilities().length);
console.log('  Panopticon label =', HEX_SHOT_ABILITY_CATALOG.PANOPTICON_PROTOCOL.label);
console.log('  Salvo packets =', ASH_JACKET_SALVO_PACKETS.join('+'));
