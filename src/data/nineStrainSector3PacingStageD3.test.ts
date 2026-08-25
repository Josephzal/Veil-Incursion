import assert from 'node:assert/strict';
import { getProductionOfferDefinitions, indexDefinitions } from './nineStrain/definitionCatalog';
import { createDefaultNineStrainRuntimeState, createLiveNineStrainRuntimeState } from './nineStrain/persistence';
import { activateNineStrainAcquisition } from './nineStrain/boonSystemMode';
import { applyAcquire } from './nineStrain/ownership';
import {
  markRewardConsumed,
  parseContactStrainOfferId,
  resolveNineStrainRewardTrigger,
  sealPendingOffer,
  selectPendingStrain,
  unlockedStrainIds,
} from './nineStrain/acquisitionDirector';
import { CANONICAL_WEAPON_FAMILY_IDS } from './weaponFamilyIdNormalize';
import type { NineStrainRuntimeState, StrainId } from '../types/nineStrain';
import { SECTOR_2_CONVERGENCE_IDS, SECTOR_3_CONVERGENCE_IDS } from '../types/convergence';
import { CORE_IMPRINTS } from './nineStrain/strainRegistry';
import { AFTERIMAGE_CORE_IDS } from '../types/afterimage';

const S2_PARENT_PAIRS: ReadonlyArray<readonly [StrainId, StrainId]> = [
  ['COUNTERFATE', 'STILLPOINT'],
  ['RITUAL_CADENCE', 'STILLPOINT'],
  ['AFTERIMAGE', 'STILLPOINT'],
  ['COUNTERFATE', 'WOUNDWEAVE'],
  ['RITUAL_CADENCE', 'WOUNDWEAVE'],
  ['AFTERIMAGE', 'WOUNDWEAVE'],
  ['STILLPOINT', 'WOUNDWEAVE'],
];

const S3_PARENT_PAIRS: ReadonlyArray<readonly [StrainId, StrainId]> = [
  ['COUNTERFATE', 'FAULTLINE'],
  ['RITUAL_CADENCE', 'FAULTLINE'],
  ['AFTERIMAGE', 'FAULTLINE'],
  ['STILLPOINT', 'FAULTLINE'],
  ['WOUNDWEAVE', 'FAULTLINE'],
  ['COUNTERFATE', 'SOULWAKE'],
  ['RITUAL_CADENCE', 'SOULWAKE'],
  ['AFTERIMAGE', 'SOULWAKE'],
  ['STILLPOINT', 'SOULWAKE'],
  ['WOUNDWEAVE', 'SOULWAKE'],
  ['FAULTLINE', 'SOULWAKE'],
];

const HOSTILE_TRACE_CORES = new Set<string>([
  AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT,
  AFTERIMAGE_CORE_IDS.LINGERING_INVOCATION,
  AFTERIMAGE_CORE_IDS.REFLEX_REMNANT,
]);

console.log('Stage D.3 — Sector 3 pacing');

const SEEDS = 1000;

type NodeSpec = {
  nodeId: string;
  type: string;
  depth: number;
  combat: boolean;
  boss: boolean;
};

function cadence(includeElite: boolean): NodeSpec[] {
  const d1: NodeSpec[] = [
    { nodeId: 'd1-c1', type: 'STANDARD_COMBAT', depth: 1, combat: true, boss: false },
    { nodeId: 'd1-veil', type: 'VEIL_BLEED_BOON', depth: 1, combat: false, boss: false },
    { nodeId: 'd1-c2', type: 'STANDARD_COMBAT', depth: 1, combat: true, boss: false },
  ];
  if (includeElite) d1.push({ nodeId: 'd1-elite', type: 'ELITE_COMBAT', depth: 1, combat: true, boss: false });
  d1.push({ nodeId: 'd1-boss', type: 'BOSS_COMBAT', depth: 1, combat: true, boss: true });
  const d2: NodeSpec[] = [
    { nodeId: 'd2-c1', type: 'STANDARD_COMBAT', depth: 2, combat: true, boss: false },
    { nodeId: 'd2-veil', type: 'VEIL_BLEED_BOON', depth: 2, combat: false, boss: false },
  ];
  if (includeElite) d2.push({ nodeId: 'd2-elite', type: 'ELITE_COMBAT', depth: 2, combat: true, boss: false });
  d2.push({ nodeId: 'd2-boss', type: 'BOSS_COMBAT', depth: 2, combat: true, boss: true });
  const d3: NodeSpec[] = [
    { nodeId: 'd3-c1', type: 'STANDARD_COMBAT', depth: 3, combat: true, boss: false },
    { nodeId: 'd3-veil', type: 'VEIL_BLEED_BOON', depth: 3, combat: false, boss: false },
    { nodeId: 'd3-boss', type: 'BOSS_COMBAT', depth: 3, combat: true, boss: true },
  ];
  return [...d1, ...d2, ...d3];
}

function parentPairsFor(wave: 1 | 2 | 3): ReadonlyArray<readonly [StrainId, StrainId]> {
  if (wave === 3) return [...S3_PARENT_PAIRS, ...S2_PARENT_PAIRS];
  if (wave === 2) return S2_PARENT_PAIRS;
  return S2_PARENT_PAIRS.slice(0, 3);
}

function runCohort(wave: 1 | 2 | 3) {
  const live = getProductionOfferDefinitions(wave);
  const defs = indexDefinitions(live);
  const unlocked = unlockedStrainIds(wave);
  const pairs = parentPairsFor(wave);

  function pickPreferred(state: NineStrainRuntimeState, cardIds: readonly string[]): string {
    const rows = cardIds.map((id) => defs.get(id)).filter((row): row is NonNullable<typeof row> => Boolean(row));
    const empty = CORE_IMPRINTS.filter((slot) => !state.cores[slot]);
    const hostileTrace = rows.find((row) => (
      row.role === 'CORE'
      && row.imprint
      && empty.includes(row.imprint)
      && HOSTILE_TRACE_CORES.has(row.id)
    ));
    if ((wave === 2 || wave === 3) && hostileTrace) return hostileTrace.id;
    const core = rows.find((row) => row.role === 'CORE' && row.imprint && empty.includes(row.imprint));
    if (core) return core.id;
    const cv = rows.find((row) => row.role === 'CONVERGENCE');
    if (cv) return cv.id;
    const support = rows.find((row) => row.role === 'SUPPORT');
    if (support) return support.id;
    const manifest = rows.find((row) => row.role === 'MANIFESTATION');
    if (manifest) return manifest.id;
    return cardIds[0];
  }

  function engineReady(state: NineStrainRuntimeState): boolean {
    const owned = [
      ...Object.values(state.cores).filter((id): id is string => Boolean(id)),
      ...state.supports,
    ];
    for (const strain of unlocked) {
      const rows = owned.map((id) => defs.get(id)).filter((row) => row?.strainId === strain);
      const cores = rows.filter((row) => row?.role === 'CORE').length;
      if (cores >= 2) return true;
      if (cores >= 1 && rows.length >= 2) return true;
    }
    return false;
  }

  function twoStrainOrConvergence(state: NineStrainRuntimeState): boolean {
    if (state.convergences.length > 0) return true;
    const strains = new Set(
      Object.values(state.cores).flatMap((id) => {
        const def = id ? defs.get(id) : null;
        return def ? [def.strainId] : [];
      }),
    );
    return strains.size >= 2;
  }

  function simulate(seed: number, family: string, includeElite: boolean) {
    let state = activateNineStrainAcquisition(
      wave === 1 ? createDefaultNineStrainRuntimeState() : createLiveNineStrainRuntimeState(),
      {},
    );
    if (wave === 2) {
      state = { ...state, maxAcquisitionWave: 2 };
    }
    let firstOmenByNode2 = false;
    let maxStrains = 0;
    let illegalOffer = false;
    let firstOfferTwoCores = false;
    let accepts = 0;
    let nodes = 0;
    let engineAtD1 = false;
    let developedAtD2 = false;
    const path = cadence(includeElite);
    for (const node of path) {
      nodes += 1;
      const trigger = resolveNineStrainRewardTrigger(state, {
        nodeType: node.type,
        nodeId: `${node.nodeId}:${seed}:w${wave}`,
        depth: node.depth,
        nodesCleared: nodes - 1,
        isBoss: node.boss,
        combatVictory: node.combat,
      });
      if (node.combat) {
        state = {
          ...state,
          acquisition: { ...state.acquisition, combatVictories: state.acquisition.combatVictories + 1 },
        };
      }
      if (!trigger.offer || !trigger.kind) {
        if (node.depth === 1 && node.boss) engineAtD1 = engineReady(state);
        if (node.depth === 2 && node.boss) developedAtD2 = twoStrainOrConvergence(state);
        continue;
      }
      if (nodes <= 2 && trigger.kind === 'FIRST_OMEN_STRAIN') firstOmenByNode2 = true;
      const primary = state.contactedStrains[0]?.strainId ?? null;
      const contacted = state.contactedStrains.map((row) => row.strainId);
      const primaryCores = Object.values(state.cores).filter((id) => id && defs.get(id)?.strainId === primary).length;
      const fresh = unlocked.filter((id) => !contacted.includes(id));
      const pair = pairs[seed % pairs.length];
      const missingParents = pair.filter((id) => !contacted.includes(id) && fresh.includes(id));
      let nextStrain: StrainId | null = primary;
      if (primary && primaryCores >= 2) {
        if (wave === 1) {
          nextStrain = unlocked.find((id) => id !== primary) ?? primary;
        } else if (missingParents.length > 0) {
          nextStrain = missingParents[0];
        } else if (fresh.length > 0 && state.contactedStrains.filter((row) => !row.exceptional).length < 3) {
          nextStrain = fresh[(seed + nodes) % fresh.length];
        }
      }
      state = sealPendingOffer(state, {
        nodeType: node.type,
        nodeId: `${node.nodeId}:${seed}:w${wave}`,
        depth: node.depth,
        nodesCleared: nodes - 1,
        isBoss: node.boss,
        combatVictory: node.combat,
      }, trigger.kind, family, nextStrain);
      let pending = state.acquisition.pendingOffer;
      if (!pending) {
        illegalOffer = true;
        continue;
      }
      if (pending.kind === 'FIRST_OMEN_STRAIN') {
        const options = pending.cardIds.map((id) => parseContactStrainOfferId(id)).filter((id): id is StrainId => Boolean(id));
        const pairPick = pairs[seed % pairs.length];
        const pick = wave >= 2
          ? (options.find((id) => pairPick.includes(id)) ?? options[seed % Math.max(1, options.length)])
          : options[seed % Math.max(1, options.length)];
        if (!pick) {
          illegalOffer = true;
          continue;
        }
        state = selectPendingStrain(state, pick, family);
        pending = state.acquisition.pendingOffer;
      }
      if (!pending || pending.cardIds.length !== 3 || new Set(pending.cardIds).size !== 3) {
        illegalOffer = true;
        continue;
      }
      if (accepts === 0) {
        const cores = pending.cardIds.map((id) => defs.get(id)).filter((row) => row?.role === 'CORE');
        firstOfferTwoCores = cores.length >= 2 && new Set(cores.map((row) => row?.imprint)).size >= 2;
      }
      const chosen = pickPreferred(state, pending.cardIds);
      const acquired = applyAcquire(state, defs, chosen, {
        premiumVerdictSource: pending.kind === 'BOSS_PREMIUM',
        allowVerdictReplace: pending.kind === 'BOSS_PREMIUM',
        combatDepth: pending.depth,
        equippedWeaponFamilyId: family,
        maxAcquisitionWave: wave,
      });
      if (!acquired.eligible) {
        illegalOffer = true;
        continue;
      }
      state = markRewardConsumed(acquired.after);
      accepts += 1;
      maxStrains = Math.max(maxStrains, state.contactedStrains.filter((row) => !row.exceptional).length);
      if (node.depth === 1 && node.boss) engineAtD1 = engineReady(state);
      if (node.depth === 2 && node.boss) developedAtD2 = twoStrainOrConvergence(state);
    }
    return {
      firstOmenByNode2,
      maxStrains,
      illegalOffer,
      firstOfferTwoCores,
      accepts,
      engineAtD1,
      developedAtD2,
      strains: state.contactedStrains.map((row) => row.strainId),
      convergences: [...state.convergences],
    };
  }

  const reachableStrains = new Set<string>();
  const reachableCv = new Set<string>();
  const report: Record<string, {
    firstOmen: number;
    capFail: number;
    illegal: number;
    twoCores: number;
    engineD1: number;
    developedD2: number;
    acceptSum: number;
    acceptMin: number;
    acceptMax: number;
    noEliteEngine: number;
    noEliteDeveloped: number;
  }> = {};

  for (const family of CANONICAL_WEAPON_FAMILY_IDS) {
    const stats = {
      firstOmen: 0,
      capFail: 0,
      illegal: 0,
      twoCores: 0,
      engineD1: 0,
      developedD2: 0,
      acceptSum: 0,
      acceptMin: 99,
      acceptMax: 0,
      noEliteEngine: 0,
      noEliteDeveloped: 0,
    };
    for (let seed = 0; seed < SEEDS; seed += 1) {
      const withElite = simulate(seed, family, true);
      stats.firstOmen += withElite.firstOmenByNode2 ? 1 : 0;
      stats.capFail += withElite.maxStrains > 3 ? 1 : 0;
      stats.illegal += withElite.illegalOffer ? 1 : 0;
      stats.twoCores += withElite.firstOfferTwoCores ? 1 : 0;
      stats.engineD1 += withElite.engineAtD1 ? 1 : 0;
      stats.developedD2 += withElite.developedAtD2 ? 1 : 0;
      stats.acceptSum += withElite.accepts;
      stats.acceptMin = Math.min(stats.acceptMin, withElite.accepts);
      stats.acceptMax = Math.max(stats.acceptMax, withElite.accepts);
      const noElite = simulate(seed, family, false);
      stats.noEliteEngine += noElite.engineAtD1 ? 1 : 0;
      stats.noEliteDeveloped += noElite.developedAtD2 ? 1 : 0;
      for (const id of withElite.strains) reachableStrains.add(id);
      for (const id of noElite.strains) reachableStrains.add(id);
      for (const id of withElite.convergences) reachableCv.add(id);
      for (const id of noElite.convergences) reachableCv.add(id);
      assert.equal(withElite.firstOmenByNode2, true, `w${wave} ${family} omen ${seed}`);
      assert.ok(withElite.maxStrains <= 3, `w${wave} ${family} cap ${seed}`);
      assert.equal(withElite.illegalOffer, false, `w${wave} ${family} illegal ${seed}`);
      assert.equal(withElite.firstOfferTwoCores, true, `w${wave} ${family} cores ${seed}`);
    }
    report[family] = stats;
    assert.ok(stats.engineD1 / SEEDS >= 0.9, `w${wave} ${family} engine D1 ${stats.engineD1}`);
    assert.ok(stats.developedD2 / SEEDS >= 0.9, `w${wave} ${family} developed D2 ${stats.developedD2}`);
    assert.ok(stats.noEliteEngine / SEEDS >= 0.9, `w${wave} ${family} no-elite engine ${stats.noEliteEngine}`);
    const mean = stats.acceptSum / SEEDS;
    console.log(`wave${wave} ${family} accepts mean=${mean.toFixed(2)} min=${stats.acceptMin} max=${stats.acceptMax} engineD1=${(stats.engineD1 / SEEDS * 100).toFixed(1)}% convD2=${(stats.developedD2 / SEEDS * 100).toFixed(1)}%`);
  }

  if (wave === 2) {
    for (const id of unlocked) assert.ok(reachableStrains.has(id), `wave2 strain ${id}`);
    for (const id of SECTOR_2_CONVERGENCE_IDS) {
      assert.ok(reachableCv.has(id), `wave2 convergence ${id}`);
    }
  }
  if (wave === 3) {
    for (const id of unlocked) assert.ok(reachableStrains.has(id), `wave3 strain ${id}`);
    for (const id of SECTOR_3_CONVERGENCE_IDS) {
      assert.ok(reachableCv.has(id), `wave3 convergence ${id}`);
    }
  }

  console.log(JSON.stringify({ wave, report, reachableStrains: [...reachableStrains], reachableCv: [...reachableCv] }, null, 2));
  return report;
}

const wave1 = runCohort(1);
const wave2 = runCohort(2);
const wave3 = runCohort(3);
assert.ok(Object.keys(wave1).length === 9);
assert.ok(Object.keys(wave2).length === 9);
assert.ok(Object.keys(wave3).length === 9);

console.log('Stage D.3 — Sector 3 pacing passed');
