import assert from 'node:assert/strict';
import { GRAVEMARK_CORE_IDS, GRAVEMARK_SUPPORT_IDS } from '../types/gravemark';
import { getLiveUniversalBoonDefinitions } from './nineStrain/definitionCatalog';
import { createNineStrainRuntime, weaponFamilyExecutionContext } from './nineStrain/runtime';
import { createLiveNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { hostileSnapshotInput } from './nineStrain/hostileField';
import type { TargetNativeResult } from '../types/nineStrain';
import type { CombatGridSlotId } from '../types/combatGrid';

console.log('Stage E.1 — Gravemark boss & movement');

const live = getLiveUniversalBoonDefinitions();

function rt() {
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  return runtime;
}

function hostiles(
  runtime: ReturnType<typeof rt>,
  rows: ReadonlyArray<{ id: string; slot: CombatGridSlotId; hp?: number; immovable?: boolean; protectedPhase?: boolean; authoredCounter?: boolean; invulnerable?: boolean; alive?: boolean }>,
) {
  runtime.syncHostileIntents(rows.map((row, index) => hostileSnapshotInput({
    unitId: row.id,
    intentKind: 'STRIKE',
    hostileTurnOrder: index,
    slot: row.slot,
    designation: row.id,
    hp: row.hp ?? 80,
    maxHp: row.hp ?? 80,
    immovable: row.immovable,
    protectedPhase: row.protectedPhase,
    authoredCounter: row.authoredCounter,
    invulnerable: row.invulnerable,
    alive: row.alive,
  })));
}

function native(targetId: string, damage: number, extra: Partial<TargetNativeResult> = {}): TargetNativeResult {
  return {
    targetId, hits: 1, misses: 0, crits: 0, nativeDirectDamage: damage, defenseDamage: 0, defenseBreaks: 0,
    fractures: 0, statusesApplied: 0, killed: false, healingDealt: 0, movement: 0, ...extra,
  };
}

function strike(runtime: ReturnType<typeof rt>, rootActionId: string, targets: TargetNativeResult[], extra: Parameters<typeof weaponFamilyExecutionContext>[1] = {}) {
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId,
    actionSurface: extra.actionSurface ?? 'WEAPON',
    nativeByTarget: targets,
    lockedTargetIds: extra.lockedTargetIds ?? targets.map((row) => row.targetId),
    ...extra,
  }));
}

function slot(runtime: ReturnType<typeof rt>, unitId: string): CombatGridSlotId | undefined {
  return runtime.hostileIntents().find((row) => row.unitId === unitId)?.gridSlot;
}

function hp(runtime: ReturnType<typeof rt>, unitId: string): number {
  return runtime.hostileIntents().find((row) => row.unitId === unitId)?.hp ?? 0;
}

// --- Immovable boss with an authored translation: stays in place, becomes Unmoored, cap consumed ---
{
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.IMPACT_VECTOR);
  hostiles(runtime, [{ id: 'boss', slot: 'FL_0', immovable: true, authoredCounter: true, hp: 500 }]);
  runtime.runTurnStart();
  strike(runtime, 'seed', [native('boss', 10)]);
  assert.equal(runtime.getState().gravemark.polarityByUnitId.boss, 'ARMAMENT');
  strike(runtime, 'r2', [native('boss', 10)], { actionSurface: 'TECHNIQUE' }); // no-op: TECHNIQUE not owned as a core here
  // Force a Polarity change via a different surface owner so the immovable translation actually fires.
  runtime.grantFixture(GRAVEMARK_CORE_IDS.FOLDED_SPACE);
  strike(runtime, 'r3', [native('boss', 10)], { actionSurface: 'TECHNIQUE', actualCostsPaid: { ap: 2 } });
  assert.equal(runtime.getState().gravemark.polarityByUnitId.boss, 'DISCIPLINE');
  assert.equal(slot(runtime, 'boss'), 'FL_0', 'immovable boss never changes position');
  assert.equal(runtime.getState().gravemark.lastDisplacement?.kind, 'IMMOVABLE');
  assert.equal(runtime.getState().gravemark.lastBossTranslation?.translated, true, 'authored translation applies');
  assert.ok((runtime.getState().gravemark.unmooredExpiryByUnitId.boss ?? 0) > 0, 'immovable target still becomes Unmoored');
  assert.equal(runtime.getState().gravemark.displacementCountByUnitId.boss, 1, 'immovable translation still consumes the trigger-owner cap');
}

// --- Immovable boss with no authored translation: bounded fizzle, no invented universal damage ---
{
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.IMPACT_VECTOR);
  runtime.grantFixture(GRAVEMARK_CORE_IDS.FOLDED_SPACE);
  hostiles(runtime, [{ id: 'boss', slot: 'FL_0', immovable: true, authoredCounter: false, hp: 500 }]);
  runtime.runTurnStart();
  strike(runtime, 'seed', [native('boss', 10)]);
  const hpBefore = hp(runtime, 'boss');
  strike(runtime, 'r2', [native('boss', 10)], { actionSurface: 'TECHNIQUE', actualCostsPaid: { ap: 2 } });
  assert.equal(runtime.getState().gravemark.lastDisplacement?.kind, 'IMMOVABLE');
  assert.equal(runtime.getState().gravemark.lastBossTranslation?.translated, false);
  assert.equal(runtime.getState().gravemark.lastBossTranslation?.reason, 'NO_AUTHORED_TRANSLATION');
  assert.equal(runtime.getState().gravemark.lastLog, 'DISPLACEMENT // IMMOVABLE FIZZLE');
  assert.equal(hp(runtime, 'boss'), hpBefore, 'no invented universal damage on a bounded fizzle');
}

// --- Invulnerable enemy: Displaces/swaps normally but never takes Collision Course damage ---
{
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
  runtime.grantFixture(GRAVEMARK_SUPPORT_IDS.COLLISION_COURSE);
  hostiles(runtime, [
    { id: 'enemy-a', slot: 'FL_0' },
    { id: 'boss', slot: 'BL_0', invulnerable: true, hp: 500 },
  ]);
  runtime.setCombatDepth(1);
  runtime.runTurnStart();
  runtime.resolveInstinct({ classId: 'AEGIS', perfectParry: true, parryAttempted: true, associatedHostileUnitId: 'enemy-a' });
  assert.equal(slot(runtime, 'enemy-a'), 'BL_0', 'swap still occurs');
  assert.equal(slot(runtime, 'boss'), 'FL_0', 'swap still occurs');
  // enemy-a still legally takes its own Collision Course packet — only the invulnerable passenger is blocked.
  assert.equal(hp(runtime, 'boss'), 500, 'invulnerable passenger takes no Collision Course damage');
  assert.equal(hp(runtime, 'enemy-a'), 80 - 8, 'non-invulnerable trigger owner still takes its own packet');
  assert.ok((runtime.getState().gravemark.unmooredExpiryByUnitId['enemy-a'] ?? 0) > 0);
  assert.ok((runtime.getState().gravemark.unmooredExpiryByUnitId['boss'] ?? 0) > 0, 'invulnerability blocks damage, not Unmoored');
}

// --- Protected-phase enemy: Collision Course blocked unless authoredCounter is set ---
{
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
  runtime.grantFixture(GRAVEMARK_SUPPORT_IDS.COLLISION_COURSE);
  hostiles(runtime, [
    { id: 'enemy-a', slot: 'FL_0' },
    { id: 'boss', slot: 'BL_0', protectedPhase: true, authoredCounter: false, hp: 500 },
  ]);
  runtime.setCombatDepth(1);
  runtime.runTurnStart();
  runtime.resolveInstinct({ classId: 'AEGIS', perfectParry: true, parryAttempted: true, associatedHostileUnitId: 'enemy-a' });
  assert.equal(hp(runtime, 'boss'), 500, 'protected phase without authoredCounter blocks Collision Course damage on the boss');
  assert.equal(hp(runtime, 'enemy-a'), 80 - 8, 'the non-protected trigger owner still legally takes its own packet');
}

{
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
  runtime.grantFixture(GRAVEMARK_SUPPORT_IDS.COLLISION_COURSE);
  hostiles(runtime, [
    { id: 'enemy-a', slot: 'FL_0' },
    { id: 'boss', slot: 'BL_0', protectedPhase: true, authoredCounter: true, hp: 500 },
  ]);
  runtime.setCombatDepth(1);
  runtime.runTurnStart();
  runtime.resolveInstinct({ classId: 'AEGIS', perfectParry: true, parryAttempted: true, associatedHostileUnitId: 'enemy-a' });
  assert.equal(hp(runtime, 'boss'), 500 - 8, 'authoredCounter allows Collision Course through a protected phase');
}

// --- Same-unit phase transition: authored successor inherits Polarity, Unmoored, and cap once ---
{
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
  hostiles(runtime, [{ id: 'boss-p1', slot: 'FL_0' }]);
  runtime.runTurnStart();
  runtime.resolveInstinct({ classId: 'AEGIS', perfectParry: true, parryAttempted: true, associatedHostileUnitId: 'boss-p1' });
  assert.equal(runtime.getState().gravemark.polarityByUnitId['boss-p1'], 'INSTINCT');
  assert.ok((runtime.getState().gravemark.unmooredExpiryByUnitId['boss-p1'] ?? 0) > 0);
  assert.equal(runtime.getState().gravemark.displacementCountByUnitId['boss-p1'], 1);
  runtime.setWoundweavePhaseSuccessor('boss-p1', 'boss-p2');
  hostiles(runtime, [{ id: 'boss-p2', slot: 'FL_0' }]);
  const gm = runtime.getState().gravemark;
  assert.equal(gm.polarityByUnitId['boss-p1'], undefined, 'retired id pruned');
  assert.equal(gm.polarityByUnitId['boss-p2'], 'INSTINCT', 'successor inherits Polarity');
  assert.ok((gm.unmooredExpiryByUnitId['boss-p2'] ?? 0) > 0, 'successor inherits Unmoored expiry');
  assert.equal(gm.displacementCountByUnitId['boss-p2'], 1, 'successor inherits the cycle guard once');
}

// --- Dead/removed targets cannot receive new Polarity or movement ---
{
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.IMPACT_VECTOR);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0', alive: false }]);
  runtime.runTurnStart();
  strike(runtime, 'seed', [native('enemy-a', 10)]);
  assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], undefined, 'dead target gets no Polarity');
  assert.equal(runtime.getState().gravemark.lastDisplacement, null);
}

// --- Save/resume: pruning of unmapped retired IDs across a hydrate round-trip ---
{
  const runtime = rt();
  runtime.grantFixture(GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
  hostiles(runtime, [{ id: 'enemy-a', slot: 'FL_0' }]);
  runtime.runTurnStart();
  runtime.resolveInstinct({ classId: 'AEGIS', perfectParry: true, parryAttempted: true, associatedHostileUnitId: 'enemy-a' });
  assert.equal(runtime.getState().gravemark.polarityByUnitId['enemy-a'], 'INSTINCT');
  const saved = runtime.serialize();
  const resumed = rt();
  resumed.hydrate(saved);
  // Retire enemy-a with no successor mapping — its Gravemark bookkeeping must be pruned, not carried forever.
  hostiles(resumed, [{ id: 'enemy-b', slot: 'FL_0' }]);
  assert.equal(resumed.getState().gravemark.polarityByUnitId['enemy-a'], undefined, 'unmapped retired id pruned after resume');
}

console.log('Stage E.1 — Gravemark boss & movement passed');
