import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SOULWAKE_CORE_IDS,
  SOULWAKE_MANIFESTATION_ID,
  SOULWAKE_SUPPORT_IDS,
  SOULWAKE_VERDICT_ID,
} from '../types/soulwake';
import { getLiveUniversalBoonDefinitions } from './nineStrain/definitionCatalog';
import { createNineStrainRuntime, weaponFamilyExecutionContext } from './nineStrain/runtime';
import { createLiveNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { CANONICAL_WEAPON_FAMILY_IDS } from './weaponFamilyIdNormalize';
import { canFireWeaponUltimate } from './weaponUltimateRegistry';
import { hostileSnapshotInput } from './nineStrain/hostileField';
import { classIdForWeaponFamily } from './nineStrain/classWeaponAdapter';
import type { TargetNativeResult } from '../types/nineStrain';

console.log('Stage D.2 — Soulwake compatibility');

const live = getLiveUniversalBoonDefinitions();
const src = join(process.cwd(), 'src/data/nineStrain');
for (const name of readdirSync(src)) {
  if (!name.endsWith('.ts')) continue;
  if (name.includes('soulwake') || name.includes('Definition')) continue;
  const text = readFileSync(join(src, name), 'utf8');
  assert.equal(text.includes("if (def.id === 'SW_"), false, name);
  assert.equal(text.includes("case 'SW_"), false, name);
}

function rt() {
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  runtime.syncPlayerVitals({ hp: 100, maxHp: 100 });
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

const CORES = Object.values(SOULWAKE_CORE_IDS);
assert.equal(CORES.length, 4);
for (const family of CANONICAL_WEAPON_FAMILY_IDS) {
  for (const core of CORES) {
    const runtime = rt();
    grant(runtime, core, { family });
    runtime.syncHostileIntents([
      hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FRONT_LEFT', hp: 80, maxHp: 80 }),
    ]);
    runtime.setCombatDepth(2);
    runtime.recordHpLoss({
      lossEventId: 'seed',
      rootActionId: null,
      actualHpRemoved: 10,
      currentHpBefore: 100,
      currentHpAfter: 90,
      maxHpBefore: 100,
      maxHpAfter: 100,
      provenance: 'HOSTILE',
      overdrawKind: 'NONE',
    });
    runtime.runTurnStart();
    if (core === SOULWAKE_CORE_IDS.PAIN_REFLEX) {
      runtime.resolveInstinct({
        classId: classIdForWeaponFamily(family),
        perfectParry: classIdForWeaponFamily(family) === 'AEGIS',
        reloadQuality: classIdForWeaponFamily(family) === 'HEX_SHOT' ? 'PERFECT' : null,
        riftPreventedDamage: 10,
        riftWouldReachHp: 10,
      });
      assert.ok(runtime.getState().soulwake.lastBarrierGranted > 0, `${core} ${family}`);
    } else if (core === SOULWAKE_CORE_IDS.OPEN_CONDUIT) {
      runtime.commitRootAction(weaponFamilyExecutionContext(family, {
        actionSurface: 'WEAPON',
        nativeByTarget: [native('enemy-a', 8)],
      }));
      runtime.resolveCurrent({
        classId: classIdForWeaponFamily(family),
        ordinaryGain: classIdForWeaponFamily(family) !== 'HEX_SHOT',
        actualGained: 6,
        reloadRestoredRounds: classIdForWeaponFamily(family) === 'HEX_SHOT',
        reloadRestoredCount: 2,
        magazineSpace: 4,
      });
      assert.ok(
        runtime.metric('soulwake_current_gain') > 0 || runtime.getState().soulwake.openConduitUsedThisPlayerTurn,
        `${core} ${family}`,
      );
    } else {
      runtime.commitRootAction(weaponFamilyExecutionContext(family, {
        actionSurface: core === SOULWAKE_CORE_IDS.BORROWED_NERVE ? 'TECHNIQUE' : 'WEAPON',
        actualCostsPaid: { ap: 2 },
        startsCooldown: true,
        nativeByTarget: [native('enemy-a', 8)],
      }));
      if (core === SOULWAKE_CORE_IDS.HOLLOW_EDGE) {
        assert.ok(runtime.getState().soulwake.lastPackets.length <= 1, `${core} ${family}`);
      }
      if (core === SOULWAKE_CORE_IDS.BORROWED_NERVE) {
        assert.equal(runtime.metric('ap_refund') >= 1, true, `${core} ${family}`);
      }
    }
  }
}

for (const family of CANONICAL_WEAPON_FAMILY_IDS) {
  const runtime = rt();
  grant(runtime, SOULWAKE_CORE_IDS.HOLLOW_EDGE, { family });
  grant(runtime, SOULWAKE_SUPPORT_IDS.OPEN_NERVE, { family });
  grant(runtime, SOULWAKE_SUPPORT_IDS.PAIN_DIVIDEND, { family });
  grant(runtime, SOULWAKE_MANIFESTATION_ID, { family });
  runtime.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FRONT_LEFT', hp: 80, maxHp: 80 }),
  ]);
  runtime.setCombatDepth(2);
  runtime.runTurnStart();
  runtime.commitOverdraw(`od:${family}`);
  assert.ok(runtime.getState().soulwake.activeWake > 0 || runtime.getState().soulwake.recordedWake > 0, family);
}

for (const family of CANONICAL_WEAPON_FAMILY_IDS) {
  const runtime = rt();
  grant(runtime, SOULWAKE_VERDICT_ID, { premium: true, family });
  runtime.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FRONT_LEFT', hp: 90, maxHp: 90 }),
  ]);
  runtime.setCombatDepth(2);
  runtime.runTurnStart();
  runtime.setLastHeartbeatOverdraw(true);
  assert.equal(canFireWeaponUltimate(family), true);
  runtime.commitRootAction(weaponFamilyExecutionContext(family, {
    sourceKind: 'ULTIMATE',
    actionSurface: 'ULTIMATE',
    nativeByTarget: [native('enemy-a', 12)],
  }));
  assert.equal(runtime.getState().soulwake.playerHp, 90);
  runtime.commitRootAction(weaponFamilyExecutionContext(family, {
    rootActionId: `root:${family}:open`,
    sourceKind: 'ULTIMATE',
    actionSurface: 'ULTIMATE',
    committed: false,
    nativeByTarget: [native('enemy-a', 12)],
  }));
}

{
  const runtime = rt();
  grant(runtime, SOULWAKE_CORE_IDS.HOLLOW_EDGE);
  runtime.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FRONT_LEFT', hp: 5, maxHp: 80 }),
  ]);
  runtime.recordHpLoss({
    lossEventId: 'cf',
    rootActionId: null,
    actualHpRemoved: 10,
    currentHpBefore: 100,
    currentHpAfter: 90,
    maxHpBefore: 100,
    maxHpAfter: 100,
    provenance: 'HOSTILE',
    overdrawKind: 'NONE',
  });
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    actionSurface: 'WEAPON',
    nativeByTarget: [native('enemy-a', 4)],
  }));
  assert.equal(runtime.events().some((event) => event.type === 'DERIVATIVE_RESOLVED'), true);
}

console.log('Stage D.2 — Soulwake compatibility passed');
