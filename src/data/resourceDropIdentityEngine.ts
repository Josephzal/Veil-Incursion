import type { RunRewardBias } from '../types/runWorldBrief';
import type { ResourceItemId } from '../types/resourceItem';
import type { VeilBiome } from '../types/encounterSpawn';
import type { EncounterCompositionTemplateId, EncounterRewardTier } from '../types/encounterComposition';
import {
  getSectorResourceTableByBiome,
  sectorIdentityResourcePoolFromTables,
  sectorPrimaryResourcePool,
  sectorResourcesByBand,
} from './sectorResourceTableEngine';
import {
  DEPTH_ROLL_PRESSURE,
  filterResourcesForDepth,
  pickWeightedForDepth,
} from './depthResourceRulesEngine';

/** Phase 2D — primary farming identity mats from sector resource tables. */
export function sectorIdentityResourcePool(veilBiome: VeilBiome | null | undefined): ResourceItemId[] {
  return sectorIdentityResourcePoolFromTables(veilBiome);
}

/** Depth-gated expansion mats — rarity guidance for pools. */
export const EXPANSION_COMMON_STABLE: readonly ResourceItemId[] = [
  'nullcrete-shard',
  'cinder-wire',
];

export const EXPANSION_UNCOMMON_STABLE: readonly ResourceItemId[] = [
  'mycelial-ichor',
  'rail-capacitor',
  'resonant-filament',
  'containment-seal',
];

export const EXPANSION_RARE_GATED: readonly ResourceItemId[] = [
  'anchor-marrow',
  'breach-thread',
  'blacksite-specimen-jar',
];

export interface ExpansionIdentityDropContext {
  districtDepth: 1 | 2 | 3;
  veilBiome?: VeilBiome | null;
  isElite?: boolean;
  highValue?: boolean;
  highRisk?: boolean;
  echoSignal?: boolean;
  anchorSignal?: boolean;
  hasModifier?: boolean;
  hasTwisted?: boolean;
  templateId?: EncounterCompositionTemplateId | null;
  rewardTier?: EncounterRewardTier | null;
  briefRewardBias?: RunRewardBias | null;
  rng: () => number;
}

/**
 * Sparse identity extras — Phase 2E depth gates pools so Threshold stays readable,
 * Breach opens dangerous value, Deep Veil enables contraband / apex pressure.
 */
export function rollExpansionIdentityExtras(ctx: ExpansionIdentityDropContext): ResourceItemId[] {
  const extras: ResourceItemId[] = [];
  const depth = ctx.districtDepth;
  const depthOpts = {
    isElite: ctx.isElite,
    highRisk: ctx.highRisk
      || ctx.rewardTier === 'APEX_CHANCE'
      || ctx.rewardTier === 'RARE',
  };
  const table = getSectorResourceTableByBiome(ctx.veilBiome);
  const primaryPool = filterResourcesForDepth(
    table
      ? sectorPrimaryResourcePool(table.sectorId)
      : sectorIdentityResourcePool(ctx.veilBiome),
    depth,
    depthOpts,
  );
  const rarePool = filterResourcesForDepth(
    table
      ? [
        ...sectorResourcesByBand(table.sectorId, 'RARE'),
        ...sectorResourcesByBand(table.sectorId, 'CROSSOVER'),
      ]
      : [],
    depth,
    depthOpts,
  );
  const apexPool = filterResourcesForDepth(
    table ? sectorResourcesByBand(table.sectorId, 'APEX') : [],
    depth,
    depthOpts,
  );
  const pressure = DEPTH_ROLL_PRESSURE[depth];
  const sectorMult = ctx.briefRewardBias?.sectorResourceMultiplier ?? 1;
  const resonantMult = ctx.briefRewardBias?.resonantMaterialMultiplier ?? 1;
  const marrowMult = ctx.briefRewardBias?.anchorMarrowMultiplier ?? 1;

  // Sector identity — common chance; stronger on elite / resource-guard templates.
  if (primaryPool.length > 0) {
    let sectorChance = (ctx.isElite ? 0.45 : 0.28) * sectorMult;
    if (ctx.templateId === 'RESOURCE_GUARD' || ctx.highValue) sectorChance += 0.12;
    if (ctx.rng() < Math.min(0.85, sectorChance)) {
      const pick = pickWeightedForDepth(primaryPool, depth, ctx.rng);
      if (pick) extras.push(pick);
    }
  }

  // Echo lane — Resonant Filament (not just Echo-Glass).
  if (
    ctx.echoSignal
    || ctx.templateId === 'ECHO_CONTAMINATED'
    || ctx.templateId === 'BOSS_FORESHADOWING'
  ) {
    if (filterResourcesForDepth(['resonant-filament'], depth, depthOpts).length > 0) {
      const filamentChance = (depth >= 2 ? 0.42 : 0.22) * resonantMult;
      if (ctx.rng() < Math.min(0.9, filamentChance)) {
        extras.push('resonant-filament');
      }
    }
  }

  // Anchor lane — Anchor Marrow (never Depth 1 standard soup).
  if (ctx.anchorSignal || ctx.templateId === 'ANCHOR_PATROL') {
    if (
      (depth >= 2 || ctx.isElite)
      && filterResourcesForDepth(['anchor-marrow'], depth, depthOpts).length > 0
    ) {
      const marrowChance = (ctx.templateId === 'ANCHOR_PATROL' || ctx.isElite ? 0.55 : 0.28) * marrowMult;
      if (ctx.rng() < Math.min(0.9, marrowChance)) {
        extras.push('anchor-marrow');
      }
    }
  }

  // Sector rare / crossover — Threshold gets a low intel/rare peek; Breach+ opens up.
  if (rarePool.length > 0) {
    let rareChance = pressure.rareChance;
    if (ctx.isElite) rareChance += depth === 1 ? 0.07 : 0.14;
    if (ctx.highRisk || ctx.rewardTier === 'RARE' || ctx.rewardTier === 'APEX_CHANCE') {
      rareChance += 0.1;
    }
    if (ctx.rng() < rareChance) {
      const pick = pickWeightedForDepth(rarePool, depth, ctx.rng);
      if (pick) extras.push(pick);
    }
  }

  // Breach Thread — Distortion / high-risk on sectors that list it (Depth 2+).
  if (depth >= 2) {
    const distortion =
      ctx.hasTwisted
      || ctx.hasModifier
      || ctx.highRisk
      || ctx.templateId === 'HIGH_RISK_CARGO_GUARD'
      || ctx.rewardTier === 'RARE'
      || ctx.rewardTier === 'APEX_CHANCE';
    const threadOnTable = Boolean(
      table?.resources.some((entry) => entry.resourceId === 'breach-thread'),
    );
    if (
      distortion
      && threadOnTable
      && filterResourcesForDepth(['breach-thread'], depth, depthOpts).length > 0
    ) {
      if (ctx.rng() < pressure.breachThreadChance) {
        extras.push('breach-thread');
      }
    }
  }

  // Apex band — Deep Veil marked high-risk only.
  if (apexPool.length > 0 && depth >= 3) {
    if (ctx.rng() < pressure.apexChance) {
      const pick = pickWeightedForDepth(apexPool, depth, ctx.rng);
      if (pick) extras.push(pick);
    }
  }

  // Specimen Jar — Deep Veil blacksite pressure (also covered by CROSSOVER when eligible).
  if (
    depth >= 3
    && (ctx.veilBiome === 'BLACKLINE_TERMINUS' || ctx.veilBiome === 'ABYSSAL_SINK')
    && (ctx.highRisk || ctx.isElite || ctx.rewardTier === 'RARE' || ctx.rewardTier === 'APEX_CHANCE')
    && filterResourcesForDepth(['blacksite-specimen-jar'], depth, depthOpts).length > 0
  ) {
    if (ctx.rng() < 0.14) {
      extras.push('blacksite-specimen-jar');
    }
  }

  return extras;
}
