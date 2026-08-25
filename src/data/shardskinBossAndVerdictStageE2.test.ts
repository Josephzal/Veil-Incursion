import assert from 'node:assert/strict';
import { SHARDSKIN_CORE_IDS, SHARDSKIN_VERDICT_ID } from '../types/shardskin';
import { createNineStrainRuntime, weaponFamilyExecutionContext } from './nineStrain/runtime';
import { createLiveNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { getLiveUniversalBoonDefinitions } from './nineStrain/definitionCatalog';
import { CANONICAL_WEAPON_FAMILY_IDS } from './weaponFamilyIdNormalize';
import { canFireWeaponUltimate } from './weaponUltimateRegistry';
import { hostileSnapshotInput } from './nineStrain/hostileField';
import type { TargetNativeResult } from '../types/nineStrain';

console.log('Stage E.2 — Shardskin boss/objective and Verdict');

const live = getLiveUniversalBoonDefinitions();

function rt() {
  const runtime = createNineStrainRuntime({ definitions: live });
  runtime.hydrate(activateNineStrainAcquisition(createLiveNineStrainRuntimeState(), {}));
  return runtime;
}

function grant(runtime: ReturnType<typeof rt>, id: string, extra: { family?: string; premium?: boolean } = {}) {
  const result = runtime.commit(id, {
    maxAcquisitionWave: 4,
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

function hp(runtime: ReturnType<typeof rt>, unitId: string): number {
  return runtime.hostileIntents().find((row) => row.unitId === unitId)?.hp ?? 0;
}

function seedEdge(runtime: ReturnType<typeof rt>, targetId = 'enemy-a', extraTargets: string[] = []) {
  runtime.grantFixture(SHARDSKIN_CORE_IDS.CRYSTAL_EDGE);
  runtime.syncHostileIntents([
    hostileSnapshotInput({ unitId: targetId, intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 90, maxHp: 90 }),
    ...extraTargets.map((id, i) => hostileSnapshotInput({ unitId: id, intentKind: 'STRIKE', hostileTurnOrder: i + 1, slot: 'FL_1', hp: 90, maxHp: 90 })),
  ]);
  runtime.setCombatDepth(1);
  runtime.runTurnStart();
  runtime.commitRootAction(weaponFamilyExecutionContext('aegis-longsword', {
    rootActionId: 'seed',
    actionSurface: 'WEAPON',
    nativeByTarget: [native(targetId, 20)],
    lockedTargetIds: [targetId, ...extraTargets],
    totalNativeDirectDamage: 20,
  }));
  runtime.endPlayerTurn();
  runtime.runTurnStart();
  assert.equal(runtime.shardskinPresentation().currentEdge, 4, 'seedEdge produced 4 Edge');
}

// --- Cathedral Break across all nine real production ultimates ---
for (const family of CANONICAL_WEAPON_FAMILY_IDS) {
  assert.equal(canFireWeaponUltimate(family), true);
  const runtime = rt();
  grant(runtime, SHARDSKIN_VERDICT_ID, { premium: true, family });
  runtime.setCathedralBreakSelected(true);
  runtime.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 90, maxHp: 90 }),
  ]);
  runtime.setCombatDepth(1);
  runtime.runTurnStart();
  // Fill Shards + Edge: 8 Shards via Crystal Edge... but Crystal Edge is not owned here — hydrate
  // an exact combined pool instead, matching the "state-only" precision used elsewhere.
  const snap = runtime.getState();
  runtime.hydrate({ ...snap, shardskin: { ...snap.shardskin, currentShards: 3, currentEdge: 5 } });

  const rootActionId = `ult:${family}`;
  const begin = runtime.beginCathedralBreakUltimate(rootActionId, ['enemy-a']);
  assert.equal(begin.active, true, `${family} Cathedral Break armed`);
  assert.equal(begin.consumedShards, 3);
  assert.equal(begin.consumedEdge, 5);
  assert.equal(runtime.shardskinPresentation().currentShards, 0, `${family} Shards consumed up front`);
  assert.equal(runtime.shardskinPresentation().currentEdge, 0, `${family} Edge consumed up front`);

  // Native ultimate resolves unchanged (simulated — real production damage is applied by the Hub).
  const hpBefore = hp(runtime, 'enemy-a');
  const finish = runtime.finishCathedralBreakUltimate(rootActionId);
  // budget = floor((3+5)*1.5) = 12, single locked target receives it all.
  assert.equal(finish.budget, 12, `${family} Cathedral Break budget`);
  assert.equal(finish.packets.length, 1);
  assert.equal(finish.packets[0].amount, 12, `${family} single-target packet gets the full budget`);
  assert.equal(hpBefore - hp(runtime, 'enemy-a'), 12, `${family} Occult packet actually applied`);
  assert.equal(finish.gained, 10, `${family} +10 Shards post-resolution`);
  assert.equal(runtime.shardskinPresentation().currentShards, 10, `${family} post-gain reflected in current Shards`);
}

// --- Canceling/closing the ultimate before commitment changes nothing ---
{
  const runtime = rt();
  grant(runtime, SHARDSKIN_VERDICT_ID, { premium: true });
  runtime.setCathedralBreakSelected(true);
  runtime.syncHostileIntents([hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 90, maxHp: 90 })]);
  runtime.setCombatDepth(1);
  runtime.runTurnStart();
  const snap = runtime.getState();
  runtime.hydrate({ ...snap, shardskin: { ...snap.shardskin, currentShards: 4, currentEdge: 0 } });
  // Toggle off before commitment — never armed, never consumed.
  runtime.setCathedralBreakSelected(false);
  assert.equal(runtime.shardskinPresentation().currentShards, 4, 'toggling off before commit leaves Shards untouched');
}

// --- If Cathedral Break is not selected, no Shard/Edge consumption or +10 gain occurs at commit ---
{
  const runtime = rt();
  grant(runtime, SHARDSKIN_VERDICT_ID, { premium: true });
  runtime.syncHostileIntents([hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 90, maxHp: 90 })]);
  runtime.setCombatDepth(1);
  runtime.runTurnStart();
  const snap = runtime.getState();
  runtime.hydrate({ ...snap, shardskin: { ...snap.shardskin, currentShards: 4, currentEdge: 0 } });
  const begin = runtime.beginCathedralBreakUltimate('ult-not-selected', ['enemy-a']);
  assert.equal(begin.active, false, 'Cathedral Break not selected — pre-native pass is a no-op');
  assert.equal(runtime.shardskinPresentation().currentShards, 4, 'Shards untouched when Cathedral Break was not selected');
}

// --- Positive combined value required; combined 0 does nothing ---
{
  const runtime = rt();
  grant(runtime, SHARDSKIN_VERDICT_ID, { premium: true });
  runtime.setCathedralBreakSelected(true);
  runtime.syncHostileIntents([hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 90, maxHp: 90 })]);
  runtime.setCombatDepth(1);
  runtime.runTurnStart();
  const begin = runtime.beginCathedralBreakUltimate('ult-zero', ['enemy-a']);
  assert.equal(begin.active, false, 'zero combined Shards+Edge — Cathedral Break cannot commit');
}

// --- Ordinary ultimate Edge consumption when Cathedral Break is not selected ---
{
  const runtime = rt();
  seedEdge(runtime);
  const hpBefore = hp(runtime, 'enemy-a');
  const result = runtime.consumeEdgeForUltimate('ult-ordinary', 'enemy-a', []);
  assert.equal(result.consumedEdge, 4);
  assert.equal(hpBefore - hp(runtime, 'enemy-a'), 4, 'ordinary ultimate Edge consumption delivers the derivative Occult packet');
  assert.equal(runtime.shardskinPresentation().currentEdge, 0);
}

// --- Protected/invulnerable boss phase: Edge and Cathedral packets fizzle without bypass or redistribution ---
{
  const runtime = rt();
  seedEdge(runtime, 'enemy-a');
  runtime.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 90, maxHp: 90, invulnerable: true }),
  ]);
  const hpBefore = hp(runtime, 'enemy-a');
  const result = runtime.consumeEdgeForUltimate('ult-invuln', 'enemy-a', []);
  assert.equal(result.consumedEdge, 4, 'Edge is still consumed even though the packet fizzles');
  assert.equal(hpBefore - hp(runtime, 'enemy-a'), 0, 'invulnerability is never bypassed');
}
{
  const runtime = rt();
  grant(runtime, SHARDSKIN_VERDICT_ID, { premium: true });
  runtime.setCathedralBreakSelected(true);
  runtime.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 90, maxHp: 90 }),
    hostileSnapshotInput({ unitId: 'enemy-b', intentKind: 'STRIKE', hostileTurnOrder: 1, slot: 'FL_1', hp: 90, maxHp: 90, protectedPhase: true, authoredCounter: false }),
  ]);
  runtime.setCombatDepth(1);
  runtime.runTurnStart();
  const snap = runtime.getState();
  runtime.hydrate({ ...snap, shardskin: { ...snap.shardskin, currentShards: 4, currentEdge: 0 } });
  runtime.beginCathedralBreakUltimate('ult-protected', ['enemy-a', 'enemy-b']);
  const beforeA = hp(runtime, 'enemy-a');
  const beforeB = hp(runtime, 'enemy-b');
  const finish = runtime.finishCathedralBreakUltimate('ult-protected');
  // budget = floor(4*1.5) = 6, split across 2 targets -> 3 each; enemy-b's portion fizzles (protected, uncountered).
  const bPacket = finish.packets.find((p) => p.targetId === 'enemy-b');
  assert.equal(bPacket?.fizzled, true, 'protected-phase portion fizzles rather than bypassing or redistributing');
  assert.equal(beforeB - hp(runtime, 'enemy-b'), 0);
  const aPacket = finish.packets.find((p) => p.targetId === 'enemy-a');
  assert.equal(aPacket?.fizzled, false);
  assert.equal(beforeA - hp(runtime, 'enemy-a'), aPacket?.amount ?? -1, 'the legal portion still resolves against its own original target');
  // No redistribution of the fizzled half onto enemy-a.
  assert.notEqual(beforeA - hp(runtime, 'enemy-a'), finish.budget, 'fizzled portion is not redistributed onto the legal target');
}

// --- Portions assigned to targets removed by native resolution fizzle without redistribution ---
{
  const runtime = rt();
  grant(runtime, SHARDSKIN_VERDICT_ID, { premium: true });
  runtime.setCathedralBreakSelected(true);
  runtime.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 90, maxHp: 90 }),
    hostileSnapshotInput({ unitId: 'enemy-b', intentKind: 'STRIKE', hostileTurnOrder: 1, slot: 'FL_1', hp: 90, maxHp: 90 }),
  ]);
  runtime.setCombatDepth(1);
  runtime.runTurnStart();
  const snap = runtime.getState();
  runtime.hydrate({ ...snap, shardskin: { ...snap.shardskin, currentShards: 4, currentEdge: 0 } });
  runtime.beginCathedralBreakUltimate('ult-removed', ['enemy-a', 'enemy-b']);
  // Native ultimate resolution removed enemy-b from the field entirely before the post-native pass.
  runtime.syncHostileIntents([
    hostileSnapshotInput({ unitId: 'enemy-a', intentKind: 'STRIKE', hostileTurnOrder: 0, slot: 'FL_0', hp: 90, maxHp: 90 }),
  ]);
  const beforeA = hp(runtime, 'enemy-a');
  const finish = runtime.finishCathedralBreakUltimate('ult-removed');
  const aPacket = finish.packets.find((p) => p.targetId === 'enemy-a');
  assert.equal(aPacket?.fizzled, false);
  assert.notEqual(beforeA - hp(runtime, 'enemy-a'), finish.budget, 'the removed target\'s portion is not redistributed onto the survivor');
}

console.log('Stage E.2 — Shardskin boss/objective and Verdict passed');
