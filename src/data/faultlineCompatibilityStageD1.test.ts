import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FAULTLINE_CORE_IDS,
  FAULTLINE_MANIFESTATION_ID,
  FAULTLINE_SUPPORT_IDS,
  FAULTLINE_VERDICT_ID,
} from '../types/faultline';
import { getLiveUniversalBoonDefinitions } from './nineStrain/definitionCatalog';
import { createNineStrainRuntime, weaponFamilyExecutionContext } from './nineStrain/runtime';
import { createLiveNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { CANONICAL_WEAPON_FAMILY_IDS } from './weaponFamilyIdNormalize';
import { canFireWeaponUltimate } from './weaponUltimateRegistry';
import { hostileSnapshotInput } from './nineStrain/hostileField';
import { classIdForWeaponFamily } from './nineStrain/classWeaponAdapter';
import type { TargetNativeResult } from '../types/nineStrain';

console.log('Stage D.1 — Faultline compatibility');

const live = getLiveUniversalBoonDefinitions();
const src = join(process.cwd(), 'src/data/nineStrain');

for (const name of readdirSync(src)) {
  if (!name.endsWith('.ts')) continue;
  if (name.includes('faultline') || name.includes('Definition')) continue;
  const text = readFileSync(join(src, name), 'utf8');
  assert.equal(text.includes("if (def.id === 'FL_"), false, name);
  assert.equal(text.includes("case 'FL_"), false, name);
}

function rt() {
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  return runtime;
}

function grant(runtime: ReturnType<typeof rt>, id: string, extra: { premium?: boolean; family?: string } = {}) {
  const result = runtime.commit(id, {
    maxAcquisitionWave: 3,
    premiumVerdictSource: extra.premium,
    allowVerdictReplace: extra.premium,
    combatDepth: 2,
    equippedWeaponFamilyId: extra.family ?? 'aegis-longsword',
  });
  if (!result.eligible) runtime.grantFixture(id);
}

function native(targetId: string, damage: number, extra: Partial<TargetNativeResult> = {}): TargetNativeResult {
  return {
    targetId, hits: 1, misses: 0, crits: 0, nativeDirectDamage: damage, defenseDamage: 0, defenseBreaks: 0,
    fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0, ...extra,
  };
}

const CORES = Object.values(FAULTLINE_CORE_IDS);
assert.equal(CORES.length, 4);
for (const family of CANONICAL_WEAPON_FAMILY_IDS) {
  for (const core of CORES) {
    const runtime = rt();
    grant(runtime, core, { family });
    runtime.syncHostileIntents([
      hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FRONT_LEFT', hp: 80, maxHp: 80, kineticArmor: 1 }),
    ]);
    runtime.setCombatDepth(2);
    runtime.runTurnStart();
    const surface = core === FAULTLINE_CORE_IDS.APPLIED_FRACTURE ? 'TECHNIQUE'
      : core === FAULTLINE_CORE_IDS.COUNTERPRESSURE ? 'INSTINCT'
        : 'WEAPON';
    if (core === FAULTLINE_CORE_IDS.COUNTERPRESSURE) {
      runtime.resolveInstinct({
        classId: classIdForWeaponFamily(family),
        perfectParry: classIdForWeaponFamily(family) === 'AEGIS',
        reloadQuality: classIdForWeaponFamily(family) === 'HEX_SHOT' ? 'PERFECT' : null,
        riftPreventedDamage: 10,
        riftWouldReachHp: 10,
        associatedHostileUnitId: 'enemy-a',
      });
    } else if (core === FAULTLINE_CORE_IDS.LOAD_LIMIT) {
      runtime.commitRootAction(weaponFamilyExecutionContext(family, {
        rootActionId: `load:${family}`,
        actionSurface: 'WEAPON',
        nativeByTarget: [native('enemy-a', 8)],
        lockedTargetIds: ['enemy-a'],
      }));
      runtime.resolveCurrent({ classId: classIdForWeaponFamily(family), ordinarySpend: true, associatedHostileUnitId: 'enemy-a' });
    } else {
      runtime.commitRootAction(weaponFamilyExecutionContext(family, {
        rootActionId: `core:${core}:${family}`,
        actionSurface: surface,
        nativeByTarget: [native('enemy-a', 8)],
        lockedTargetIds: ['enemy-a'],
        actualCostsPaid: { ap: 2 },
      }));
    }
    assert.ok(Object.values(runtime.getState().faultline.faultByUnitId).some((value) => value > 0) || runtime.getState().faultline.lastRuptures.length > 0, `${core} ${family}`);
  }
}

for (const family of CANONICAL_WEAPON_FAMILY_IDS) {
  assert.equal(canFireWeaponUltimate(family), true);
  const runtime = rt();
  grant(runtime, FAULTLINE_CORE_IDS.STRESS_PATTERN, { family });
  grant(runtime, FAULTLINE_SUPPORT_IDS.HAIRLINE_CASCADE, { family });
  grant(runtime, FAULTLINE_SUPPORT_IDS.RESIDUAL_STRESS, { family });
  grant(runtime, FAULTLINE_MANIFESTATION_ID, { family });
  grant(runtime, FAULTLINE_VERDICT_ID, { premium: true, family });
  runtime.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FRONT_LEFT', hp: 90, maxHp: 90, kineticArmor: 1 }),
    hostileSnapshotInput({ unitId: 'enemy-b', intentKind: 'STRIKE', hostileTurnOrder: 1, slot: 'FRONT_RIGHT', hp: 90, maxHp: 90, kineticArmor: 1 }),
  ]);
  runtime.setCombatDepth(2);
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext(family, {
    rootActionId: `ult:${family}`,
    sourceKind: 'ULTIMATE',
    actionSurface: 'ULTIMATE',
    nativeByTarget: [native('enemy-a', 12), native('enemy-b', 12)],
    lockedTargetIds: ['enemy-a', 'enemy-b'],
  }));
  assert.ok(runtime.getState().faultline.lastRuptures.length >= 1, family);
  runtime.commitRootAction(weaponFamilyExecutionContext(family, {
    rootActionId: `open:${family}`,
    sourceKind: 'ULTIMATE',
    actionSurface: 'ULTIMATE',
    committed: false,
    nativeByTarget: [native('enemy-a', 12)],
    lockedTargetIds: ['enemy-a'],
  }));
}

console.log('Stage D.1 — Faultline compatibility passed');
