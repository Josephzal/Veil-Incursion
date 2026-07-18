import { CRAFTING_REGISTRY } from './craftingRegistry';
import {
  ALL_RESOURCE_ITEM_IDS,
  CONTRACT_TARGET_RESOURCE_IDS,
  RESOURCE_REGISTRY,
  RESOURCES_BY_CATEGORY,
  canResourceSpawnInSector,
} from './resourceRegistry';
import {
  ECONOMY_V1_CONTRABAND_IDS,
  ECONOMY_V1_COUNTS,
  ECONOMY_V1_INTEL_IDS,
  ECONOMY_V1_RESOURCE_IDS,
  ECONOMY_V1_ROSTER_FROZEN,
  ECONOMY_V1_STABLE_IDS,
  ECONOMY_V1_UNSTABLE_IDS,
  PHASE_2C_FULL_ROSTER_IDS,
  ROUTE_INTEL_V1_IDS,
  isEconomyV1ResourceId,
  isRouteIntelV1ResourceId,
} from './economyRosterV1';
import { RESOURCE_SOURCE_IDENTITY } from './resourceSourceIdentity';
import {
  SECTOR_RESOURCE_TABLES,
  listEconomyResourcesMissingFromSectorTables,
} from './sectorResourceTableEngine';
import { ALL_SECTOR_IDS } from './sectorBiomeBridge';
import {
  DEPTH_ECONOMY_POLICIES,
  economyPoolAtDepth,
  isApexEconomyResource,
  isResourceEligibleAtDepth,
  NULL_ZONE_THRESHOLD_EXAMPLE_IDS,
} from './depthResourceRulesEngine';
import {
  BREACH_GRADE_PACKET_QUALITY,
  EXTRACTED_YIELD_TARGETS,
  assembleNodeRewardPackets,
  buildBaseNodeRewardPackets,
} from './resourceRewardPacketEngine';
import type { RewardNodeKind } from '../types/resourceRewardPacket';
import type { BreachGradeId } from '../types/progression';
import { createDefaultProgressionProfile } from './progressionProfileEngine';
import { resolveResourceSourceHint } from './resourceSourceHintEngine';
import {
  UNSTABLE_CARRIED_EFFECTS,
} from './unstableCargoEffectsEngine';
import { UNSTABLE_CARRIED_EFFECT_IDS } from '../types/unstableCargoEffects';
import type { UnstableCargoEffectId } from '../types/unstableCargoEffects';
import type { ResourceDepthIndex, ResourceItemId } from '../types/resourceItem';
import type { SectorId } from '../types/worldState';

export interface ResourceValidationIssue {
  severity: 'warn' | 'error';
  resourceId?: ResourceItemId;
  recipeId?: string;
  message: string;
}

const CRAFTING_RELATED_TAGS = new Set([
  'CRAFTING_MATERIAL',
  'WEAPON_BLUEPRINT_MATERIAL',
  'STARTING_REQUISITION_MATERIAL',
  'SCANNER_INTEL',
  'EXPLOSIVE_MATERIAL',
  'OCCULT_MATERIAL',
  'CONSUMABLE_MATERIAL',
  'SECTOR_MATERIAL',
  'DEFENSIVE_MATERIAL',
  'SURVIVAL_MATERIAL',
  'EXTRACTION_MATERIAL',
  'TECH_MATERIAL',
  'INDUSTRIAL_MATERIAL',
  'WEAPON_MATERIAL',
  'CONTAINMENT_MATERIAL',
  'APPRAISAL_MATERIAL',
  'ECHO_MATERIAL',
  'RESONANCE_MATERIAL',
  'ANCHOR_MATERIAL',
  'DEPTH_MATERIAL',
  'BREACH_MATERIAL',
  'SCANNER_MATERIAL',
  'MASTERWORK_MATERIAL',
]);

function pushIssue(
  issues: ResourceValidationIssue[],
  issue: ResourceValidationIssue,
): void {
  issues.push(issue);
}

/** Validates resource definitions and crafting recipe compatibility. */
export function validateResourceRegistry(): ResourceValidationIssue[] {
  const issues: ResourceValidationIssue[] = [];

  ALL_RESOURCE_ITEM_IDS.forEach((resourceId) => {
    const def = RESOURCE_REGISTRY[resourceId];

    if (!def.category) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Resource missing category.',
      });
    }

    if (def.usageTags.length === 0) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Resource missing usage tags.',
      });
    }

    if (def.canBeCraftingIngredient && !def.usageTags.some((tag) => CRAFTING_RELATED_TAGS.has(tag))) {
      pushIssue(issues, {
        severity: 'warn',
        resourceId,
        message: 'Resource marked craftable but has no crafting-related usage tag.',
      });
    }

    if (def.usageTags.includes('FENCE_VALUE') && !def.canBeSoldToFence) {
      pushIssue(issues, {
        severity: 'warn',
        resourceId,
        message: 'Resource tagged FENCE_VALUE but cannot be sold to fence.',
      });
    }

    if (def.canBeSoldToFence && def.sellValue <= 0) {
      pushIssue(issues, {
        severity: 'warn',
        resourceId,
        message: 'Fence-eligible resource has zero sell value.',
      });
    }

    if (def.canStack && def.cargoStackCap <= 1) {
      pushIssue(issues, {
        severity: 'warn',
        resourceId,
        message: 'Stackable resource has cargoStackCap <= 1.',
      });
    }

    if (!def.canStack && def.cargoStackCap > 1) {
      pushIssue(issues, {
        severity: 'warn',
        resourceId,
        message: 'Non-stackable resource has cargoStackCap > 1.',
      });
    }

    if (def.maxStack !== def.cargoStackCap) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'maxStack must equal cargoStackCap.',
      });
    }

    if (def.stashStackCap < 1) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'stashStackCap must be >= 1.',
      });
    }

    if (
      (def.category === 'UNSTABLE' || def.category === 'CONTRABAND')
      && def.cargoStackCap !== 1
    ) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'UNSTABLE / CONTRABAND resources must have cargoStackCap 1.',
      });
    }

    if (def.primaryRole === 'ROUTE_INTEL' && def.cargoStackCap !== 1) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'ROUTE_INTEL resources must have cargoStackCap 1.',
      });
    }

    if (def.primaryRole === 'ROUTE_INTEL' && def.canBeSoldToFence) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'ROUTE_INTEL must not be fence-sellable.',
      });
    }

    if (def.gridWidth < 1 || def.gridHeight < 1) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Resource has invalid grid dimensions.',
      });
    }

    if (def.canBeContractTarget && def.validSectorIds.length === 0) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Contract target resource has no valid sector spawn info.',
      });
    }

    if (!def.sourceHint?.trim()) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Resource missing sourceHint.',
      });
    }

    if (!def.description?.trim()) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Resource missing description.',
      });
    }

    if (!def.rarity) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Resource missing rarity.',
      });
    }

    if (!def.intendedUses || def.intendedUses.length < 2) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Resource must declare at least 2 intendedUses.',
      });
    }

    if (!(resourceId in RESOURCE_SOURCE_IDENTITY)) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Resource missing RESOURCE_SOURCE_IDENTITY entry (Phase 2B).',
      });
    }

    if (!def.primarySectors || def.primarySectors.length === 0) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Resource missing primarySectors.',
      });
    } else {
      def.primarySectors.forEach((sectorId) => {
        if (!def.validSectorIds.includes(sectorId)) {
          pushIssue(issues, {
            severity: 'error',
            resourceId,
            message: `primarySector ${sectorId} not in validSectorIds.`,
          });
        }
      });
    }

    if (!def.secondarySources || def.secondarySources.length === 0) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Resource missing secondarySources.',
      });
    }

    if (!def.depthRules) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Resource missing depthRules.',
      });
    } else if (def.depthRules.minDepth > def.depthRules.maxDepth) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'depthRules.minDepth > maxDepth.',
      });
    } else {
      def.depthRules.preferredDepths.forEach((depth) => {
        if (depth < def.depthRules.minDepth || depth > def.depthRules.maxDepth) {
          pushIssue(issues, {
            severity: 'error',
            resourceId,
            message: `preferredDepth ${depth} outside depthRules range.`,
          });
        }
      });
    }

    if (def.hasCarriedEffect) {
      if (!def.carriedEffectId) {
        pushIssue(issues, {
          severity: 'error',
          resourceId,
          message: 'hasCarriedEffect true but carriedEffectId is null.',
        });
      } else if (!(UNSTABLE_CARRIED_EFFECT_IDS as readonly string[]).includes(def.carriedEffectId)) {
        pushIssue(issues, {
          severity: 'error',
          resourceId,
          message: `carriedEffectId ${def.carriedEffectId} not in UNSTABLE_CARRIED_EFFECT_IDS.`,
        });
      }
    } else if (def.carriedEffectId) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'carriedEffectId set but hasCarriedEffect is false.',
      });
    }

    if (
      (def.primaryRole === 'APEX_CARGO' || resourceId === 'sealed-containment-casket')
      && def.canBeBankedAtSafehouse
    ) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Apex cargo must not be mid-run bankable (Phase 2B.1).',
      });
    }

    if (
      def.category === 'CONTRABAND'
      && def.usageTags.includes('UNIDENTIFIED_CONTAINER')
      && def.canOpenInRun
    ) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Sealed contraband container must not be openable in-run.',
      });
    }

    if (
      def.category === 'CONTRABAND'
      && def.usageTags.includes('APPRAISABLE')
      && !def.canOpenAtHub
      && !def.canBeSoldToFence
    ) {
      pushIssue(issues, {
        severity: 'warn',
        resourceId,
        message: 'Appraisable contraband has neither hub open nor fence sell path.',
      });
    }

    const hasEconomyUse = def.canBeCraftingIngredient
      || def.canBeSoldToFence
      || def.canBeContractTarget
      || def.canBeOperationTarget
      || def.canOpenAtHub
      || def.primaryRole === 'ROUTE_INTEL';
    if (!hasEconomyUse) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Resource has no craft/fence/contract/operation/open/route-intel use (orphan).',
      });
    }
  });

  CRAFTING_REGISTRY.forEach((recipe) => {
    recipe.requirements.forEach((req) => {
      const def = RESOURCE_REGISTRY[req.resourceId];
      if (!def.canBeCraftingIngredient) {
        pushIssue(issues, {
          severity: 'error',
          resourceId: req.resourceId,
          recipeId: recipe.id,
          message: `Recipe "${recipe.label}" uses non-crafting resource as ingredient.`,
        });
      }
    });
  });

  CONTRACT_TARGET_RESOURCE_IDS.forEach((resourceId) => {
    if (RESOURCE_REGISTRY[resourceId].validSectorIds.length === 0) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Contract target cannot spawn in any sector.',
      });
    }
  });

  validateUnstableCarriedEffects(issues);
  validateEconomyRosterV1Freeze(issues);
  validateSectorResourceTables(issues);
  validateDepthResourceRules(issues);
  validateRewardPackets(issues);
  validateResourceSourceHints(issues);

  return issues;
}

/** Phase 2E — depth policies + registry depthRules keep Threshold readable. */
function validateDepthResourceRules(issues: ResourceValidationIssue[]): void {
  ([1, 2, 3] as const).forEach((depth) => {
    if (!DEPTH_ECONOMY_POLICIES[depth]) {
      pushIssue(issues, {
        severity: 'error',
        message: `Missing DEPTH_ECONOMY_POLICIES for depth ${depth} (Phase 2E).`,
      });
    }
  });

  ECONOMY_V1_RESOURCE_IDS.forEach((resourceId) => {
    const def = RESOURCE_REGISTRY[resourceId];
    const { minDepth, maxDepth } = def.depthRules;
    let eligibleSomewhere = false;
    ([1, 2, 3] as ResourceDepthIndex[]).forEach((depth) => {
      if (
        isResourceEligibleAtDepth(resourceId, depth)
        || isResourceEligibleAtDepth(resourceId, depth, { highRisk: true })
      ) {
        eligibleSomewhere = true;
      }
    });
    if (!eligibleSomewhere) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Resource never eligible under Phase 2E depth policy.',
      });
    }

    if (isApexEconomyResource(resourceId) && minDepth < 3) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Apex economy resource must have depthRules.minDepth === 3 (Phase 2E).',
      });
    }

    if (def.category === 'UNSTABLE' && minDepth < 2 && resourceId !== 'anomalous-core') {
      // Apex already checked; other unstable must not teach at Threshold.
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Unstable resource must have minDepth >= 2 (Phase 2E Threshold ban).',
      });
    }

    if (def.category === 'CONTRABAND' && minDepth < 2) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Contraband must have minDepth >= 2 (Phase 2E).',
      });
    }

    if (maxDepth < minDepth) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'depthRules.maxDepth < minDepth (Phase 2E).',
      });
    }
  });

  // Threshold must stay readable: no unstable / contraband / apex in default D1 pool.
  const d1 = economyPoolAtDepth(1);
  d1.forEach((resourceId) => {
    const def = RESOURCE_REGISTRY[resourceId];
    if (def.category === 'UNSTABLE' || def.category === 'CONTRABAND' || isApexEconomyResource(resourceId)) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Threshold (D1) default pool must not include unstable/contraband/apex (Phase 2E).',
      });
    }
  });

  NULL_ZONE_THRESHOLD_EXAMPLE_IDS.forEach((resourceId) => {
    if (!isResourceEligibleAtDepth(resourceId, 1) && !isResourceEligibleAtDepth(resourceId, 1, { isElite: true })) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Null Zone Threshold example resource not eligible at D1 (Phase 2E).',
      });
    }
  });
}

/** Phase 2F — packet recipes + grade quality + extracted yield targets. */
function validateRewardPackets(issues: ResourceValidationIssue[]): void {
  const kinds: RewardNodeKind[] = [
    'NORMAL_COMBAT',
    'ELITE_COMBAT',
    'RESOURCE_ANOMALY',
    'ANCHOR_SIGNAL',
    'ECHO_SIGNAL',
    'BOSS',
  ];

  kinds.forEach((kind) => {
    ([1, 2, 3] as ResourceDepthIndex[]).forEach((depth) => {
      const packets = buildBaseNodeRewardPackets(kind, depth, 'THE_NULL_ZONE');
      if (packets.length === 0) {
        pushIssue(issues, {
          severity: 'error',
          message: `Missing Phase 2F base packets for ${kind} @ D${depth}.`,
        });
      }
      packets.forEach((pkt) => {
        if (pkt.rolls < 1) {
          pushIssue(issues, {
            severity: 'error',
            message: `Phase 2F packet ${pkt.packetType} on ${kind}/D${depth} has rolls < 1.`,
          });
        }
        if (pkt.minDepth > depth) {
          // Allowed as dormant until deeper — warn only if ALL packets dormant.
        }
        if (pkt.allowUnstable && pkt.minDepth < 2 && pkt.packetType !== 'ANCHOR') {
          pushIssue(issues, {
            severity: 'warn',
            message: `Phase 2F ${kind}/D${depth} ${pkt.packetType} allows unstable below D2.`,
          });
        }
      });
    });
  });

  if (EXTRACTED_YIELD_TARGETS.length !== 5) {
    pushIssue(issues, {
      severity: 'error',
      message: `Phase 2F extracted yield targets must have 5 bands (got ${EXTRACTED_YIELD_TARGETS.length}).`,
    });
  }

  EXTRACTED_YIELD_TARGETS.forEach((band) => {
    (['stable', 'intelRare', 'unstable', 'contrabandApex'] as const).forEach((key) => {
      const range = band[key];
      if (range[0] > range[1]) {
        pushIssue(issues, {
          severity: 'error',
          message: `Phase 2F yield band ${band.id}.${key} has min > max.`,
        });
      }
    });
  });

  (['I', 'II', 'III', 'IV', 'V'] as BreachGradeId[]).forEach((grade) => {
    if (!BREACH_GRADE_PACKET_QUALITY[grade]) {
      pushIssue(issues, {
        severity: 'error',
        message: `Missing BREACH_GRADE_PACKET_QUALITY for Grade ${grade} (Phase 2F).`,
      });
    }
  });

  const gradeI = assembleNodeRewardPackets({
    nodeKind: 'NORMAL_COMBAT',
    depth: 20,
    districtDepth: 2,
    breachGrade: 'I',
    rng: () => 0.5,
  });
  const gradeIII = assembleNodeRewardPackets({
    nodeKind: 'NORMAL_COMBAT',
    depth: 20,
    districtDepth: 2,
    breachGrade: 'III',
    rng: () => 0.5,
  });
  if (gradeIII.length <= gradeI.length) {
    pushIssue(issues, {
      severity: 'error',
      message: 'Phase 2F Grade III must add quality bonus packets vs Grade I (not pile multipliers).',
    });
  }

  // Grade must not inflate base STABLE roll counts on NORMAL_COMBAT D1.
  const d1I = buildBaseNodeRewardPackets('NORMAL_COMBAT', 1).reduce((n, p) => n + p.rolls, 0);
  const d1Assembled = assembleNodeRewardPackets({
    nodeKind: 'NORMAL_COMBAT',
    depth: 5,
    districtDepth: 1,
    breachGrade: 'V',
    rng: () => 0.5,
  });
  const d1StableRolls = d1Assembled
    .filter((p) => p.packetType === 'STABLE' || p.packetType === 'SECTOR_STABLE')
    .reduce((n, p) => n + p.rolls, 0);
  if (d1StableRolls > d1I + 2) {
    pushIssue(issues, {
      severity: 'warn',
      message: 'Phase 2F Grade V heavily inflated Threshold stable rolls — prefer quality packets.',
    });
  }
}

/** Phase 2G — every economy resource must resolve a usable source hint. */
function validateResourceSourceHints(issues: ResourceValidationIssue[]): void {
  const profile = createDefaultProgressionProfile();
  ECONOMY_V1_RESOURCE_IDS.forEach((resourceId) => {
    const def = RESOURCE_REGISTRY[resourceId];
    if (!def.sourceHint.trim()) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Missing registry sourceHint (Phase 2G).',
      });
    }
    if (def.primarySectors.length === 0) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Resource has no primarySectors for source hints (Phase 2G).',
      });
    }
    const hint = resolveResourceSourceHint(resourceId, {
      profile,
      preferContractDirected: false,
    });
    if (hint.lines.length === 0 || !hint.compact.trim()) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Source hint resolved empty (Phase 2G).',
      });
    }
  });

  // Rail Capacitor must point at Slag when unlocked.
  profile.sectors.THE_SLAG_WORKS = {
    ...profile.sectors.THE_SLAG_WORKS!,
    unlocked: true,
    highestGradeCleared: 'I',
    accessMandateState: 'COMPLETED',
  };
  const rail = resolveResourceSourceHint('rail-capacitor', {
    profile,
    preferContractDirected: false,
  });
  if (rail.tier !== 'EXACT' || rail.recommendedSectorId !== 'THE_SLAG_WORKS') {
    pushIssue(issues, {
      severity: 'error',
      resourceId: 'rail-capacitor',
      message: 'Rail Capacitor Exact hint must recommend Slag Works when unlocked (Phase 2G).',
    });
  }
}

/** Phase 2D — every sector has a farming table; PRIMARY rows match registry primarySectors. */
function validateSectorResourceTables(issues: ResourceValidationIssue[]): void {
  ALL_SECTOR_IDS.forEach((sectorId) => {
    const table = SECTOR_RESOURCE_TABLES[sectorId];
    if (!table) {
      pushIssue(issues, {
        severity: 'error',
        message: `Missing SECTOR_RESOURCE_TABLES entry for ${sectorId}.`,
      });
      return;
    }
    if (!table.role.trim()) {
      pushIssue(issues, {
        severity: 'error',
        message: `Sector ${sectorId} table missing role.`,
      });
    }
    if (!table.whyRun.length) {
      pushIssue(issues, {
        severity: 'error',
        message: `Sector ${sectorId} table missing whyRun.`,
      });
    }
    const primaries = table.resources.filter((entry) => entry.band === 'PRIMARY');
    if (primaries.length < 3) {
      pushIssue(issues, {
        severity: 'error',
        message: `Sector ${sectorId} needs at least 3 PRIMARY resources (got ${primaries.length}).`,
      });
    }

    table.resources.forEach((entry) => {
      if (!isEconomyV1ResourceId(entry.resourceId)) {
        pushIssue(issues, {
          severity: 'error',
          resourceId: entry.resourceId,
          message: `Sector ${sectorId} table lists non-economy resource.`,
        });
        return;
      }
      const def = RESOURCE_REGISTRY[entry.resourceId];
      if (!def.validSectorIds.includes(sectorId) && entry.band !== 'CROSSOVER') {
        // Crossover may appear off validSectorIds rarely; PRIMARY/RARE/SUPPORT/APEX must be valid.
        if (entry.band === 'PRIMARY' || entry.band === 'RARE' || entry.band === 'APEX' || entry.band === 'SUPPORT') {
          pushIssue(issues, {
            severity: 'error',
            resourceId: entry.resourceId,
            message: `Sector table ${sectorId} lists ${entry.band} resource outside validSectorIds.`,
          });
        }
      }
      if (entry.band === 'PRIMARY' && !def.primarySectors.includes(sectorId)) {
        pushIssue(issues, {
          severity: 'error',
          resourceId: entry.resourceId,
          message: `PRIMARY on ${sectorId} but missing from resource.primarySectors.`,
        });
      }
    });
  });

  const missing = listEconomyResourcesMissingFromSectorTables();
  missing.forEach((resourceId) => {
    pushIssue(issues, {
      severity: 'error',
      resourceId,
      message: 'Economy resource missing from all sector resource tables (Phase 2D).',
    });
  });
}

/** Phase 2C — registry must exactly match the frozen 21 + 4 route-intel set. */
function validateEconomyRosterV1Freeze(issues: ResourceValidationIssue[]): void {
  if (!ECONOMY_V1_ROSTER_FROZEN) {
    pushIssue(issues, {
      severity: 'error',
      message: 'ECONOMY_V1_ROSTER_FROZEN must be true for Phase 2C.',
    });
  }

  if (ECONOMY_V1_COUNTS.ECONOMY_TOTAL !== 21) {
    pushIssue(issues, {
      severity: 'error',
      message: `Economy v1 roster must be exactly 21 resources (got ${ECONOMY_V1_COUNTS.ECONOMY_TOTAL}).`,
    });
  }

  if (ECONOMY_V1_COUNTS.ROUTE_INTEL !== 4) {
    pushIssue(issues, {
      severity: 'error',
      message: `Route intel v1 must be exactly 4 resources (got ${ECONOMY_V1_COUNTS.ROUTE_INTEL}).`,
    });
  }

  if (ECONOMY_V1_COUNTS.FULL_ROSTER !== 25) {
    pushIssue(issues, {
      severity: 'error',
      message: `Phase 2C full roster must be exactly 25 ids (got ${ECONOMY_V1_COUNTS.FULL_ROSTER}).`,
    });
  }

  const registrySet = new Set(ALL_RESOURCE_ITEM_IDS);
  const freezeSet = new Set<string>(PHASE_2C_FULL_ROSTER_IDS);

  ALL_RESOURCE_ITEM_IDS.forEach((resourceId) => {
    if (!freezeSet.has(resourceId)) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Resource is outside Phase 2C frozen roster — remove or expand roster explicitly.',
      });
    }
  });

  PHASE_2C_FULL_ROSTER_IDS.forEach((resourceId) => {
    if (!registrySet.has(resourceId)) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Frozen Phase 2C roster id missing from RESOURCE_REGISTRY.',
      });
    }
  });

  if (ALL_RESOURCE_ITEM_IDS.length !== PHASE_2C_FULL_ROSTER_IDS.length) {
    pushIssue(issues, {
      severity: 'error',
      message: `Registry size ${ALL_RESOURCE_ITEM_IDS.length} != frozen roster ${PHASE_2C_FULL_ROSTER_IDS.length}.`,
    });
  }

  const assertBucket = (
    label: string,
    expected: readonly ResourceItemId[],
    actual: readonly ResourceItemId[],
  ) => {
    const expectedSet = new Set(expected);
    const actualSet = new Set(actual);
    expected.forEach((id) => {
      if (!actualSet.has(id)) {
        pushIssue(issues, {
          severity: 'error',
          resourceId: id,
          message: `Missing from ${label} bucket (Phase 2C).`,
        });
      }
    });
    actual.forEach((id) => {
      if (!expectedSet.has(id)) {
        pushIssue(issues, {
          severity: 'error',
          resourceId: id,
          message: `Unexpected id in ${label} bucket (Phase 2C).`,
        });
      }
    });
  };

  assertBucket('STABLE', ECONOMY_V1_STABLE_IDS, RESOURCES_BY_CATEGORY.STABLE);
  assertBucket('UNSTABLE', ECONOMY_V1_UNSTABLE_IDS, RESOURCES_BY_CATEGORY.UNSTABLE);
  assertBucket('CONTRABAND', ECONOMY_V1_CONTRABAND_IDS, RESOURCES_BY_CATEGORY.CONTRABAND);

  // INTEL category = economy intel + route intel.
  const expectedIntel = [...ECONOMY_V1_INTEL_IDS, ...ROUTE_INTEL_V1_IDS];
  assertBucket('INTEL', expectedIntel, RESOURCES_BY_CATEGORY.INTEL);

  ECONOMY_V1_RESOURCE_IDS.forEach((resourceId) => {
    const def = RESOURCE_REGISTRY[resourceId];
    if (def.primaryRole === 'ROUTE_INTEL' || isRouteIntelV1ResourceId(resourceId)) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Economy v1 resource must not be route intel.',
      });
    }
  });

  ROUTE_INTEL_V1_IDS.forEach((resourceId) => {
    const def = RESOURCE_REGISTRY[resourceId];
    if (def.category !== 'INTEL' || def.primaryRole !== 'ROUTE_INTEL') {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Route intel v1 must be INTEL / ROUTE_INTEL.',
      });
    }
    if (isEconomyV1ResourceId(resourceId)) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Route intel must not appear in ECONOMY_V1_RESOURCE_IDS.',
      });
    }
  });
}

function validateUnstableCarriedEffects(issues: ResourceValidationIssue[]): void {
  UNSTABLE_CARRIED_EFFECT_IDS.forEach((resourceId: UnstableCargoEffectId) => {
    const def = RESOURCE_REGISTRY[resourceId];
    const carried = UNSTABLE_CARRIED_EFFECTS[resourceId];

    if (def.category !== 'UNSTABLE') {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Carried effect resource must be UNSTABLE category.',
      });
    }

    if (!def.hasCarriedEffect || def.carriedEffectId !== resourceId) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Registry carried-effect flags must match UNSTABLE_CARRIED_EFFECT_IDS.',
      });
    }

    if (!carried.warningText.trim()) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Unstable carried effect missing warning text.',
      });
    }

    const hasUpside = carried.displayLines.some((line) => line.kind === 'upside');
    const hasDownside = carried.displayLines.some((line) => line.kind === 'downside');
    if (!hasUpside && !hasDownside) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Unstable carried effect must have at least one upside or downside display line.',
      });
    }
  });

  RESOURCES_BY_CATEGORY.UNSTABLE.forEach((resourceId) => {
    if (!(UNSTABLE_CARRIED_EFFECT_IDS as readonly string[]).includes(resourceId)) {
      pushIssue(issues, {
        severity: 'error',
        resourceId,
        message: 'Unstable resource has no carried effect definition (Phase 2B requires linkage).',
      });
    }
  });
}

/** Logs validation issues in dev builds. */
export function logResourceValidationWarnings(): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  const issues = validateResourceRegistry();
  issues.forEach((issue) => {
    const prefix = issue.severity === 'error' ? '[RESOURCE ERROR]' : '[RESOURCE WARN]';
    const scope = issue.resourceId ?? issue.recipeId ?? 'unknown';
    console.warn(`${prefix} ${scope}: ${issue.message}`);
  });
}

export function validateContractResourceTarget(
  resourceId: ResourceItemId,
  sectorId: SectorId,
): { valid: boolean; reason?: string } {
  const def = RESOURCE_REGISTRY[resourceId];
  if (!def.canBeContractTarget) {
    return { valid: false, reason: 'Resource is not a contract target.' };
  }
  if (!canResourceSpawnInSector(resourceId, sectorId)) {
    return { valid: false, reason: 'Resource cannot appear in selected sector.' };
  }
  return { valid: true };
}

export function getEconomyIntelResourceIds(): ResourceItemId[] {
  return ALL_RESOURCE_ITEM_IDS.filter((id) =>
    RESOURCE_REGISTRY[id].usageTags.includes('ECONOMY_INTEL'),
  );
}

export function getScannerIntelResourceIds(): ResourceItemId[] {
  return ALL_RESOURCE_ITEM_IDS.filter((id) =>
    RESOURCE_REGISTRY[id].usageTags.includes('SCANNER_INTEL'),
  );
}

export function getCraftingIntelResourceIds(): ResourceItemId[] {
  return ALL_RESOURCE_ITEM_IDS.filter(
    (id) =>
      RESOURCE_REGISTRY[id].category === 'INTEL'
      && RESOURCE_REGISTRY[id].canBeCraftingIngredient,
  );
}
