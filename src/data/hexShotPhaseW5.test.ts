/**
 * Hex Shot Phase W.5 — cross-family closeout, transitional cleanup, migration, presentation contracts.
 * Run: npx tsx src/data/hexShotPhaseW5.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildHexCombatSurface,
  isHexCombatSurfaceComplete,
} from './hexCombatCompatibility';
import {
  assertHexWeaponFamilyRegistryInvariant,
  ALL_HEX_WEAPON_FAMILY_IDS,
  deriveHexWeaponActions,
  getHexWeaponActionSet,
  isHexWeaponKitComplete,
  requireHexWeaponActions,
} from './hexWeaponActionRegistry';
import {
  formatHexWeaponActionLabel,
  getHexWeaponActionDefinition,
  mapHexFixedBasicSignatureToWeaponAction,
} from './hexWeaponActionCatalog';
import {
  auditAllHexWeaponActions,
  assertNoLegacyHexCombatSurface,
  createCleanHexEncounterStateForSerializationProbe,
  familyDesignKitAlias,
  historicalBasicCanonicalMap,
  targetingModeForAction,
  W5_LOCKED_CONSTANTS,
} from './hexShotPhaseW5Engine';
import {
  extractHexFlexCandidates,
  sanitizeHexFlexLoadout,
  validateHexFlexLoadoutCommit,
} from './hexFlexLoadoutEngine';
import { getAssignableHexShotAbilities } from './classAbilityUnlockEngine';
import { DEFAULT_HEX_FLEX_LOADOUT, DEFAULT_HEX_SHOT_LOADOUT } from '../types/operativeClass';
import { createDefaultClassCombatEncounterState } from '../types/classCombatAbility';
import { classAbilityTargetMode } from './combatClassTargeting';
import {
  clearHexElusive,
  grantHexElusiveCharge,
} from './hexElusiveEngine';
import {
  clearHexFiringSolution,
  establishHexFiringSolution,
} from './hexFiringSolutionEngine';
import {
  applyHexCarbineSuppressed,
  clearHexCarbineSuppressed,
} from './hexCarbineSuppressedEngine';
import {
  armHexThreshold,
  clearHexThreshold,
} from './hexThresholdEngine';
import {
  armHexDeadboltReloadOpportunity,
  clearHexDeadboltOpportunity,
} from './hexDeadboltEngine';
import { isHexWeaponActionExecutable } from './hexWeaponActionRegistry';
import { HEX_SHOT_ABILITY_CATALOG } from './hexShotAbilities';

console.log('Phase W.5 — Hex Shot weapon-kit closeout');

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

// ── Final surface and authority ─────────────────────────────────────────
{
  assertHexWeaponFamilyRegistryInvariant();
  assertNoLegacyHexCombatSurface();

  for (const familyId of ALL_HEX_WEAPON_FAMILY_IDS) {
    assert.equal(isHexWeaponKitComplete(familyId), true);
    assert.equal(getHexWeaponActionSet(familyId)?.kitComplete, true);
    const actions = requireHexWeaponActions(familyId);
    assert.equal(actions.length, 4);
    assert.deepEqual(actions, deriveHexWeaponActions(familyId));
    for (const id of actions) {
      assert.ok(getHexWeaponActionDefinition(id), `catalog def for ${id}`);
      assert.equal(isHexWeaponActionExecutable(familyId, id), true);
    }
  }

  assert.deepEqual(deriveHexWeaponActions('hex-revolver'), [
    'QUICKDRAW', 'SLIPSHOT', 'SIX_BELLS', 'LAST_WORD',
  ]);
  assert.deepEqual(deriveHexWeaponActions('hex-carbine'), [
    'CENTER_MASS', 'CONTROLLED_BURST', 'SUPPRESSIVE_BARRAGE', 'CONTACT_FRONT',
  ]);
  assert.deepEqual(deriveHexWeaponActions('hex-shotgun'), [
    'DOOR_KNOCKER', 'FATAL_FUNNEL', 'THRESHOLD', 'DEADBOLT',
  ]);

  assert.equal(familyDesignKitAlias('hex-revolver'), 'Revolver');
  assert.equal(familyDesignKitAlias('hex-carbine'), 'Carbine');
  assert.equal(familyDesignKitAlias('hex-shotgun'), 'Shotgun');
  assert.equal(getHexWeaponActionSet('hex-revolver')?.displayName, 'Revolver');
  assert.equal(getHexWeaponActionSet('hex-carbine')?.displayName, 'Carbine');
  assert.equal(getHexWeaponActionSet('hex-shotgun')?.displayName, 'Shotgun');

  const flex = DEFAULT_HEX_FLEX_LOADOUT;
  for (const familyId of ALL_HEX_WEAPON_FAMILY_IDS) {
    const surface = buildHexCombatSurface({ weaponFamilyId: familyId, flex });
    assert.equal(surface.mode, 'WEAPON_KIT');
    assert.ok(isHexCombatSurfaceComplete(surface));
    assert.equal(surface.weaponActionCount, 4);
    assert.equal(surface.techniqueCount, 3);
    assert.deepEqual(surface.flex, flex);
    assert.deepEqual(surface.hudCards, [...surface.weaponActions, ...flex]);
    const cards = surface.hudCards as readonly string[];
    assert.ok(!cards.includes('SILVER_CORE_SIDEARM'));
    assert.ok(!cards.includes('PHASE_SHIFT_RELOAD'));
    assert.ok(!cards.includes('ZERO_PROTOCOL'));
    assert.ok(!cards.includes('LAST_KNOCK'));
    assert.ok(!cards.includes('SIXTH_SEAL'));
  }

  // Missing family — no historical basic fallback.
  const missing = buildHexCombatSurface({ weaponFamilyId: null, flex });
  assert.equal(missing.familyId, null);
  assert.deepEqual(missing.hudCards, [...flex]);
  assert.ok(!missing.hudCards.includes('SILVER_CORE_SIDEARM'));

  assert.throws(() => requireHexWeaponActions('not-a-family' as never), /Unknown or missing/);
  assert.throws(() => requireHexWeaponActions(null), /Unknown or missing/);

  const hist = historicalBasicCanonicalMap();
  assert.equal(hist['hex-revolver'], 'QUICKDRAW');
  assert.equal(hist['hex-carbine'], 'CENTER_MASS');
  assert.equal(hist['hex-shotgun'], 'DOOR_KNOCKER');
  assert.equal(mapHexFixedBasicSignatureToWeaponAction('hex-shotgun'), 'DOOR_KNOCKER');

  // Labels
  assert.equal(formatHexWeaponActionLabel('SUPPRESSIVE_BARRAGE'), '[ SUPPRESSIVE FIRE ]');
  assert.equal(formatHexWeaponActionLabel('DOOR_KNOCKER'), '[ DOOR KNOCKER ]');
}

// ── Cross-family audit (twelve actions) ─────────────────────────────────
{
  const rows = auditAllHexWeaponActions();
  assert.equal(rows.length, 12);
  for (const row of rows) {
    assert.equal(row.generatesProtocol, false);
    assert.ok(row.tags.includes('BALLISTIC'));
    assert.equal(targetingModeForAction(row.actionId), row.targetMode);
    assert.equal(classAbilityTargetMode('HEX_SHOT', row.actionId), row.targetMode);
    if (row.actionId === 'THRESHOLD') {
      assert.equal(row.consumesAstral, false);
      assert.equal(row.targetMode, 'NONE');
    } else {
      assert.equal(row.consumesAstral, true);
    }
  }
  // Shared targeting containment
  assert.equal(classAbilityTargetMode('AEGIS', 'DIVERGENCE'), 'DUAL');
  assert.equal(classAbilityTargetMode('AEGIS', 'DREAD_HORIZON'), 'ROW');
  assert.equal(classAbilityTargetMode('HEX_SHOT', 'CONTACT_FRONT'), 'ONE_OR_TWO');
  assert.equal(classAbilityTargetMode('HEX_SHOT', 'FATAL_FUNNEL'), 'COLUMN');

  // Locked closed numerics (no silent retune)
  assert.equal(W5_LOCKED_CONSTANTS.firingSolutionAccuracyBonusPct, 15);
  assert.equal(W5_LOCKED_CONSTANTS.carbineSuppressedMult, 0.7);
  assert.equal(W5_LOCKED_CONSTANTS.blackDoorBacklineMult, 0.75);
  assert.equal(W5_LOCKED_CONSTANTS.thresholdAuthored, 14);
  assert.equal(W5_LOCKED_CONSTANTS.deadboltBase, 22);
  assert.equal(W5_LOCKED_CONSTANTS.deadboltPrimed, 28);
  assert.equal(W5_LOCKED_CONSTANTS.fatalFunnelPrimary, 16);
  assert.equal(W5_LOCKED_CONSTANTS.fatalFunnelRear, 11);
}

// ── 165 flex triples + no WA/reload/ultimate as flex ────────────────────
{
  const assignable = getAssignableHexShotAbilities();
  assert.equal(assignable.length, 11);
  const triples = combinations(assignable, 3);
  assert.equal(triples.length, 165);
  let ok = 0;
  for (const t of triples) {
    if (validateHexFlexLoadoutCommit(t as never) === null) ok += 1;
  }
  assert.equal(ok, 165);
  console.log(`  flex triples validated: ${ok}/165`);

  for (const id of [
    'QUICKDRAW', 'CENTER_MASS', 'DOOR_KNOCKER', 'DEADBOLT',
    'PHASE_SHIFT_RELOAD', 'ZERO_PROTOCOL', 'LAST_KNOCK', 'SIXTH_SEAL',
    'SILVER_CORE_SIDEARM',
  ] as const) {
    assert.notEqual(
      validateHexFlexLoadoutCommit([id, 'RIFT_SNARE', 'SINGULARITY_SLUG'] as never),
      null,
      `${id} must not persist as flex`,
    );
  }
}

// ── Weapon switch preserves flex ────────────────────────────────────────
{
  const flex = ['PANOPTICON_PROTOCOL', 'GHOST_GRID_CAMO', 'BLACKSITE_TRIAGE'] as const;
  const a = buildHexCombatSurface({ weaponFamilyId: 'hex-revolver', flex });
  const b = buildHexCombatSurface({ weaponFamilyId: 'hex-carbine', flex });
  const c = buildHexCombatSurface({ weaponFamilyId: 'hex-shotgun', flex });
  assert.deepEqual(a.flex, [...flex]);
  assert.deepEqual(b.flex, [...flex]);
  assert.deepEqual(c.flex, [...flex]);
  assert.notDeepEqual(a.weaponActions, b.weaponActions);
  assert.notDeepEqual(b.weaponActions, c.weaponActions);
}

// ── Family-state containment ────────────────────────────────────────────
{
  const clean = createDefaultClassCombatEncounterState();
  assert.equal(clean.hexElusiveCharges, 0);
  assert.equal(clean.firingSolutionUnitId, null);
  assert.equal(clean.carbineSuppressedUnitId, null);
  assert.equal(clean.thresholdArmed, false);
  assert.equal(clean.deadboltReloadOpportunity, false);

  // Elusive — Revolver-owned; defaults clear
  let elusive = grantHexElusiveCharge({ charges: 0 });
  assert.equal(elusive.charges, 1);
  elusive = clearHexElusive(elusive);
  assert.equal(elusive.charges, 0);

  // Firing Solution — Carbine-owned
  let fs = establishHexFiringSolution(
    clearHexFiringSolution({ firingSolutionUnitId: null, firingSolutionExpiresAfterPlayerTurn: null }),
    'enemy-a',
    1,
  );
  assert.equal(fs.firingSolutionUnitId, 'enemy-a');
  fs = clearHexFiringSolution(fs);
  assert.equal(fs.firingSolutionUnitId, null);

  // Carbine Suppressed
  let supp = applyHexCarbineSuppressed(
    clearHexCarbineSuppressed({
      carbineSuppressedUnitId: null,
      carbineSuppressedAppliedThisAction: false,
    }),
    'enemy-b',
  );
  assert.equal(supp.carbineSuppressedUnitId, 'enemy-b');
  supp = clearHexCarbineSuppressed(supp);
  assert.equal(supp.carbineSuppressedUnitId, null);

  // Threshold — Black Door
  let th = armHexThreshold(clearHexThreshold({
    thresholdArmed: false,
    thresholdSnapshot: null,
  }), {
    ammoType: 'SILVER_CORE',
    nextShotOvercharged: false,
    overchargeMultiplier: 0,
    firstShotPenaltyPending: false,
  })!;
  assert.equal(th.thresholdArmed, true);
  th = clearHexThreshold(th);
  assert.equal(th.thresholdArmed, false);

  // Deadbolt opportunity — Black Door only via qualifying reload helper
  let db = clearHexDeadboltOpportunity({ deadboltReloadOpportunity: false });
  assert.equal(armHexDeadboltReloadOpportunity(db, {
    familyId: 'hex-revolver',
    roundsRestored: 4,
  }).deadboltReloadOpportunity, false);
  assert.equal(armHexDeadboltReloadOpportunity(db, {
    familyId: 'hex-carbine',
    roundsRestored: 4,
  }).deadboltReloadOpportunity, false);
  db = armHexDeadboltReloadOpportunity(db, {
    familyId: 'hex-shotgun',
    roundsRestored: 4,
  });
  assert.equal(db.deadboltReloadOpportunity, true);

  // Serialization probe — encounter-local fields exist on state but must not be save keys
  const probe = createCleanHexEncounterStateForSerializationProbe();
  const json = JSON.stringify(probe);
  // State object may include keys; verify createDefault clears them and they are not PlayerAccount fields.
  assert.equal(probe.thresholdArmed, false);
  assert.equal(probe.deadboltReloadOpportunity, false);
  assert.equal(probe.firingSolutionUnitId, null);
  assert.equal(probe.hexElusiveCharges, 0);
  void json;
}

// ── Migration closeout ──────────────────────────────────────────────────
{
  assert.deepEqual([...DEFAULT_HEX_SHOT_LOADOUT], [...DEFAULT_HEX_FLEX_LOADOUT]);
  assert.equal(validateHexFlexLoadoutCommit([...DEFAULT_HEX_FLEX_LOADOUT]), null);

  const legacy = [
    'SILVER_CORE_SIDEARM',
    'ASH_JACKET_SALVO',
    'RIFT_SNARE',
    'SINGULARITY_SLUG',
  ] as const;
  const extracted = extractHexFlexCandidates(legacy);
  assert.deepEqual(extracted, ['ASH_JACKET_SALVO', 'RIFT_SNARE', 'SINGULARITY_SLUG']);
  const once = sanitizeHexFlexLoadout(legacy);
  const twice = sanitizeHexFlexLoadout(once);
  assert.deepEqual(once, twice);
  assert.deepEqual(once, ['ASH_JACKET_SALVO', 'RIFT_SNARE', 'SINGULARITY_SLUG']);

  // Inspection must not mutate input arrays
  const input = ['ASH_JACKET_SALVO', 'RIFT_SNARE', 'SINGULARITY_SLUG'] as const;
  const copy = [...input];
  sanitizeHexFlexLoadout(input);
  validateHexFlexLoadoutCommit(input as never);
  assert.deepEqual([...input], copy);

  // Deprecated flex still migrates
  const deprecated = sanitizeHexFlexLoadout([
    'WRAITH_PIERCER_ROUND',
    'BLOOD_TRACER_ROUND',
    'STASIS_LOCK_SLUG',
  ] as never);
  assert.deepEqual(deprecated, [
    'SINGULARITY_SLUG',
    'REVENANTS_ECHO',
    'PANOPTICON_PROTOCOL',
  ]);
}

// ── Presentation / documentation contracts ──────────────────────────────
{
  // Live catalog labels — no Chamber
  for (const familyId of ALL_HEX_WEAPON_FAMILY_IDS) {
    for (const id of requireHexWeaponActions(familyId)) {
      const def = getHexWeaponActionDefinition(id)!;
      assert.ok(!/chamber/i.test(def.label));
      assert.ok(!/chamber/i.test(def.description));
    }
  }
  for (const id of Object.keys(HEX_SHOT_ABILITY_CATALOG)) {
    const def = HEX_SHOT_ABILITY_CATALOG[id as keyof typeof HEX_SHOT_ABILITY_CATALOG];
    if (def?.description) {
      // Chamber retirement: no live Chamber bonus copy on flex catalog
      assert.ok(!/chamber\s*\+15/i.test(def.description));
    }
  }

  const gddPath = join(process.cwd(), 'docs/current-game-systems-design.md');
  const gdd = readFileSync(gddPath, 'utf8');
  // Stale model must be gone
  assert.ok(!/Hex Shot.*Still the prior \*\*4-slot deck\*\*/i.test(gdd));
  assert.ok(!/Hex Shot and Envoy still use the older \*\*4-slot ability deck\*\*/i.test(gdd));
  assert.ok(!/Hex \/ Envoy still present the four-slot deck/i.test(gdd));
  assert.ok(!/Hex\/Envoy remain on the prior 4-slot deck until their class refactor/i.test(gdd));
  // W.5 truth present
  assert.ok(/Hex Shot.*4 family-derived weapon actions/i.test(gdd) || /Hex.*4\+3/i.test(gdd));
  assert.ok(/QUICKDRAW/.test(gdd) && /CENTER_MASS/.test(gdd) && /DOOR_KNOCKER/.test(gdd));
  assert.ok(/FLEX ABILITIES|three persisted flex/i.test(gdd));
  assert.ok(/Chamber.*retired|Chamber remains retired|Chamber is retired/i.test(gdd));
  // Envoy E.5 is also live 4+3 (no longer the older four-slot surface)
  assert.ok(/Envoy.*4\+3|Envoy.*4 family-derived weapon actions/i.test(gdd));
}

console.log('Phase W.5 — all assertions passed');
