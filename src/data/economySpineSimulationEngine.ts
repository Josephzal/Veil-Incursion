import type { ResourceItemId, ResourceDepthIndex } from '../types/resourceItem';
import type { SectorId } from '../types/worldState';
import type { BreachGradeId } from '../types/progression';
import type { VeilBiome } from '../types/encounterSpawn';
import { RESOURCE_REGISTRY, getResourceDisplayName } from './resourceRegistry';
import { ECONOMY_V1_RESOURCE_IDS } from './economyRosterV1';
import { ALL_SECTOR_IDS, sectorIdToVeilBiome } from './sectorBiomeBridge';
import { rollCombatResourceDrops } from './combatRewardEngine';
import { rollProceduralResourcePool } from './proceduralResourceEngine';
import { rollNodeRewardPackets, classifyExtractedYieldCounts, EXTRACTED_YIELD_TARGETS } from './resourceRewardPacketEngine';
import { isResourceEligibleAtDepth } from './depthResourceRulesEngine';
import { sectorsListingResource } from './sectorResourceTableEngine';

/**
 * Phase 2H — economy drop / run simulations for tuning (not vibes).
 */

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface DropSimBucket {
  resourceId: ResourceItemId;
  count: number;
  perRun: number;
}

export interface SectorDepthDropSimResult {
  sectorId: SectorId;
  districtDepth: ResourceDepthIndex;
  breachGrade: BreachGradeId;
  iterations: number;
  totals: DropSimBucket[];
  averageDropsPerIteration: number;
}

export interface ResourceNodeSimResult {
  sectorId: SectorId;
  iterations: number;
  totals: DropSimBucket[];
  averageDropsPerNode: number;
}

export interface EconomyRunSimAverages {
  runs: number;
  avgExtractedStable: number;
  avgExtractedIntelRare: number;
  avgExtractedUnstable: number;
  avgExtractedContrabandApex: number;
  avgDroppedTotal: number;
  avgAbandonedEstimate: number;
  avgLostOnDeathEstimate: number;
  avgValuePerCargoSlot: number;
  perResourceExtracted: DropSimBucket[];
}

function tally(ids: readonly ResourceItemId[]): Map<ResourceItemId, number> {
  const map = new Map<ResourceItemId, number>();
  ids.forEach((id) => map.set(id, (map.get(id) ?? 0) + 1));
  return map;
}

function bucketsFromMap(map: Map<ResourceItemId, number>, iterations: number): DropSimBucket[] {
  return [...map.entries()]
    .map(([resourceId, count]) => ({
      resourceId,
      count,
      perRun: iterations > 0 ? count / iterations : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function depthNodeDepth(districtDepth: ResourceDepthIndex): number {
  if (districtDepth === 1) return 8;
  if (districtDepth === 2) return 22;
  return 38;
}

/** Simulate combat salvage for a sector/depth/grade. */
export function simulateSectorDepthDrops(args: {
  sectorId: SectorId;
  districtDepth: ResourceDepthIndex;
  breachGrade?: BreachGradeId;
  iterations?: number;
  isElite?: boolean;
  seed?: string;
}): SectorDepthDropSimResult {
  const iterations = args.iterations ?? 100;
  const grade = args.breachGrade ?? 'I';
  const biome = sectorIdToVeilBiome(args.sectorId) as VeilBiome;
  const totals = new Map<ResourceItemId, number>();
  let dropSum = 0;

  for (let i = 0; i < iterations; i += 1) {
    const drops = rollCombatResourceDrops({
      depth: depthNodeDepth(args.districtDepth),
      districtDepth: args.districtDepth,
      isElite: Boolean(args.isElite),
      isGatekeeper: false,
      veilBiome: biome,
      breachGrade: grade,
      seed: `${args.seed ?? 'sec-depth'}:${args.sectorId}:D${args.districtDepth}:${grade}:${i}`,
      slainEnemies: [],
    });
    dropSum += drops.length;
    drops.forEach((id) => totals.set(id, (totals.get(id) ?? 0) + 1));
  }

  return {
    sectorId: args.sectorId,
    districtDepth: args.districtDepth,
    breachGrade: grade,
    iterations,
    totals: bucketsFromMap(totals, iterations),
    averageDropsPerIteration: dropSum / iterations,
  };
}

/** Simulate 100 resource anomaly nodes per sector. */
export function simulateResourceNodesPerSector(args?: {
  iterationsPerSector?: number;
  breachGrade?: BreachGradeId;
  seed?: string;
}): ResourceNodeSimResult[] {
  const iterations = args?.iterationsPerSector ?? 100;
  const grade = args?.breachGrade ?? 'I';
  return ALL_SECTOR_IDS.map((sectorId) => {
    const biome = sectorIdToVeilBiome(sectorId);
    const totals = new Map<ResourceItemId, number>();
    let dropSum = 0;
    for (let i = 0; i < iterations; i += 1) {
      const depth = 5 + Math.floor((i % 3) * 12);
      const drops = rollProceduralResourcePool(
        depth,
        `${args?.seed ?? 'res-node'}:${sectorId}:${i}`,
        { veilBiome: biome, breachGrade: grade },
      );
      dropSum += drops.length;
      drops.forEach((id) => totals.set(id, (totals.get(id) ?? 0) + 1));
    }
    return {
      sectorId,
      iterations,
      totals: bucketsFromMap(totals, iterations),
      averageDropsPerNode: dropSum / iterations,
    };
  });
}

/**
 * Simulate N abstract successful runs through D1→D3 combat + harvest packets.
 * Abandoned / death estimates are cargo-pressure proxies (not full cargo grid).
 */
export function simulateEconomyRuns(args?: {
  runs?: number;
  breachGrade?: BreachGradeId;
  sectorId?: SectorId;
  seed?: string;
}): EconomyRunSimAverages {
  const runs = args?.runs ?? 100;
  const grade = args?.breachGrade ?? 'II';
  const sectorId = args?.sectorId ?? 'THE_NULL_ZONE';
  const biome = sectorIdToVeilBiome(sectorId);
  const extracted = new Map<ResourceItemId, number>();
  let sumStable = 0;
  let sumIntel = 0;
  let sumUnstable = 0;
  let sumContra = 0;
  let sumDropped = 0;
  let sumAbandoned = 0;
  let sumLost = 0;
  let sumSlotValue = 0;

  for (let r = 0; r < runs; r += 1) {
    const rng = mulberry32(hashSeed(`${args?.seed ?? 'econ-run'}:${r}:${sectorId}:${grade}`));
    const runDrops: ResourceItemId[] = [];

    // D1 normal + elite + harvest
    runDrops.push(...rollCombatResourceDrops({
      depth: 8,
      districtDepth: 1,
      isElite: false,
      isGatekeeper: false,
      veilBiome: biome,
      breachGrade: grade,
      seed: `run:${r}:d1n`,
      slainEnemies: [],
    }));
    runDrops.push(...rollCombatResourceDrops({
      depth: 12,
      districtDepth: 1,
      isElite: true,
      isGatekeeper: false,
      veilBiome: biome,
      breachGrade: grade,
      seed: `run:${r}:d1e`,
      slainEnemies: [],
    }));
    runDrops.push(...rollProceduralResourcePool(10, `run:${r}:harvest`, {
      veilBiome: biome,
      breachGrade: grade,
    }));

    // D2 push
    if (rng() < 0.75) {
      runDrops.push(...rollCombatResourceDrops({
        depth: 22,
        districtDepth: 2,
        isElite: rng() < 0.4,
        isGatekeeper: false,
        veilBiome: biome,
        breachGrade: grade,
        highRisk: rng() < 0.25,
        seed: `run:${r}:d2`,
        slainEnemies: [],
      }));
    }

    // D3 / boss chance
    if (rng() < 0.45) {
      runDrops.push(...rollNodeRewardPackets({
        nodeKind: 'BOSS',
        depth: 38,
        districtDepth: 3,
        veilBiome: biome,
        sectorId,
        breachGrade: grade,
        highRisk: true,
        isElite: true,
        rng: mulberry32(hashSeed(`run:${r}:boss`)),
      }).resourceIds);
    }

    sumDropped += runDrops.length;

    // Extract success proxy: keep ~65% of drops (cargo/stack pressure).
    const keepRatio = 0.55 + rng() * 0.25;
    const kept: ResourceItemId[] = [];
    runDrops.forEach((id) => {
      if (rng() < keepRatio) kept.push(id);
      else sumAbandoned += 1;
    });

    // Death proxy on remaining: ~12% of abandoned-style loss from kept if "failed extract".
    if (rng() < 0.18) {
      const loseCount = Math.floor(kept.length * (0.35 + rng() * 0.4));
      for (let i = 0; i < loseCount && kept.length > 0; i += 1) {
        const idx = Math.floor(rng() * kept.length);
        const [lost] = kept.splice(idx, 1);
        if (lost) sumLost += 1;
      }
    }

    kept.forEach((id) => extracted.set(id, (extracted.get(id) ?? 0) + 1));
    const classified = classifyExtractedYieldCounts(kept);
    sumStable += classified.stable;
    sumIntel += classified.intelRare;
    sumUnstable += classified.unstable;
    sumContra += classified.contrabandApex;

    const slotValue = kept.reduce((sum, id) => {
      const def = RESOURCE_REGISTRY[id];
      const cells = Math.max(1, def.gridWidth * def.gridHeight);
      return sum + def.baseCapitalValue / cells;
    }, 0);
    sumSlotValue += kept.length > 0 ? slotValue / kept.length : 0;
  }

  return {
    runs,
    avgExtractedStable: sumStable / runs,
    avgExtractedIntelRare: sumIntel / runs,
    avgExtractedUnstable: sumUnstable / runs,
    avgExtractedContrabandApex: sumContra / runs,
    avgDroppedTotal: sumDropped / runs,
    avgAbandonedEstimate: sumAbandoned / runs,
    avgLostOnDeathEstimate: sumLost / runs,
    avgValuePerCargoSlot: sumSlotValue / runs,
    perResourceExtracted: bucketsFromMap(extracted, runs),
  };
}

export function formatSectorDepthDropSimReport(result: SectorDepthDropSimResult): string {
  const lines = [
    `=== DROP SIM // ${result.sectorId} D${result.districtDepth} Grade ${result.breachGrade} ×${result.iterations} ===`,
    `Avg drops/iteration: ${result.averageDropsPerIteration.toFixed(2)}`,
    'Top resources:',
    ...result.totals.slice(0, 14).map((b) => (
      `  ${getResourceDisplayName(b.resourceId).padEnd(22)} ${b.count}  (~${b.perRun.toFixed(2)}/iter)`
    )),
  ];
  return lines.join('\n');
}

export function formatResourceNodeSimReport(results: ResourceNodeSimResult[]): string {
  const n = results[0]?.iterations ?? 0;
  const lines = [`=== RESOURCE NODE SIM // ${n} nodes/sector ===`, ''];
  results.forEach((result) => {
    lines.push(`${result.sectorId} — avg ${result.averageDropsPerNode.toFixed(2)} drops/node`);
    result.totals.slice(0, 6).forEach((b) => {
      lines.push(`  ${getResourceDisplayName(b.resourceId)} ~${b.perRun.toFixed(2)}`);
    });
    lines.push('');
  });
  return lines.join('\n');
}

export function formatEconomyRunSimReport(avg: EconomyRunSimAverages): string {
  const d3 = EXTRACTED_YIELD_TARGETS.find((b) => b.id === 'D3_EXTRACT');
  const lines = [
    `=== ECONOMY RUN SIM // ${avg.runs} runs ===`,
    `Avg extracted stable: ${avg.avgExtractedStable.toFixed(1)} (target D3 ${d3?.stable[0]}–${d3?.stable[1]})`,
    `Avg extracted intel/rare: ${avg.avgExtractedIntelRare.toFixed(1)}`,
    `Avg extracted unstable: ${avg.avgExtractedUnstable.toFixed(1)}`,
    `Avg extracted contraband/apex: ${avg.avgExtractedContrabandApex.toFixed(2)}`,
    `Avg dropped total: ${avg.avgDroppedTotal.toFixed(1)}`,
    `Avg abandoned (cargo pressure proxy): ${avg.avgAbandonedEstimate.toFixed(1)}`,
    `Avg lost on death (proxy): ${avg.avgLostOnDeathEstimate.toFixed(1)}`,
    `Avg value / cargo slot: ${avg.avgValuePerCargoSlot.toFixed(1)}`,
    '',
    'Top extracted resources:',
    ...avg.perResourceExtracted.slice(0, 12).map((b) => (
      `  ${getResourceDisplayName(b.resourceId).padEnd(22)} ~${b.perRun.toFixed(2)}/run`
    )),
  ];
  return lines.join('\n');
}

/** Average extraction rate for a resource in a sector (combat D2 elite×50). */
export function estimateSectorExtractionRate(
  resourceId: ResourceItemId,
  sectorId: SectorId,
  opts?: { districtDepth?: ResourceDepthIndex; iterations?: number },
): number {
  const depth = opts?.districtDepth ?? 2;
  if (!isResourceEligibleAtDepth(resourceId, depth, { highRisk: true, isElite: true })) {
    return 0;
  }
  const sim = simulateSectorDepthDrops({
    sectorId,
    districtDepth: depth,
    isElite: true,
    iterations: opts?.iterations ?? 50,
    seed: `est:${resourceId}:${sectorId}`,
  });
  return sim.totals.find((b) => b.resourceId === resourceId)?.perRun ?? 0;
}

export function primarySectorsForResource(resourceId: ResourceItemId): SectorId[] {
  const listed = sectorsListingResource(resourceId, 'PRIMARY');
  if (listed.length > 0) return listed;
  return [...RESOURCE_REGISTRY[resourceId].primarySectors];
}

export { ECONOMY_V1_RESOURCE_IDS, tally };
