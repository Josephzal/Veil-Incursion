import type { CargoRunState } from '../types/cargoGrid';
import type {
  ProgressionProfile,
  ProgressionUnlockId,
  SectorAccessMandateState,
} from '../types/progression';
import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';
import type { SectorId } from '../types/worldState';
import { hasProgressionFlag, normalizeProgressionProfile } from './progressionProfileEngine';
import { grantProgressionUnlock, applyProgressionRewards } from './rewardGrantService';
import { appendProgressionEvent } from './progressionEventLog';
import { getResourceDisplayName, hasResourceUsageTag } from './resourceRegistry';
import { veilBiomeDisplayName, sectorIdToVeilBiome } from './sectorBiomeBridge';
import {
  resolveRouteIntelPityTier,
  resolveRouteIntelSpawnChance,
  FAILURE_RECOVERY_TUNING,
} from './failureRecoveryEngine';

function createSeededRng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SectorAccessMandateDefinition {
  targetSectorId: SectorId;
  unlockId: ProgressionUnlockId;
  routeIntelId: ResourceItemId;
  label: string;
  /** Short briefing copy. */
  summary: string;
  /** Sectors where the route intel can spawn. */
  sourceSectorIds: readonly SectorId[];
  /** Clearance gate for AVAILABLE (also used by sync). */
  minClearance: number;
  /** Requires flag.sector_access_mandates when true. */
  requiresMandateFlag: boolean;
  spawn: {
    minDepth: number;
    eliteChance: number;
    bossChance: number;
    /** Phase 1I — fail count that raises elite/boss spawn chance. */
    boostFailCount: number;
    /** Phase 1I — fail count that guarantees next eligible drop. */
    guaranteeFailCount: number;
  };
}

export const SECTOR_ACCESS_MANDATES: readonly SectorAccessMandateDefinition[] = [
  {
    targetSectorId: 'THE_ABYSSAL_SINK',
    unlockId: 'sector.abyssal_sink',
    routeIntelId: 'overgrowth-coordinate',
    label: 'Abyssal Sink Access',
    summary: 'Recover Overgrowth Coordinate from Null Zone.',
    sourceSectorIds: ['THE_NULL_ZONE'],
    minClearance: 2,
    requiresMandateFlag: true,
    spawn: { minDepth: 1, eliteChance: 0.55, bossChance: 0.9, boostFailCount: 2, guaranteeFailCount: 3 },
  },
  {
    targetSectorId: 'THE_ASHEN_WASTES',
    unlockId: 'sector.ashen_waste',
    routeIntelId: 'false-road-signal',
    label: 'Ashen Wastes Access',
    summary: 'Recover False-Road Signal from Null Zone or Abyssal Sink (Depth 2+).',
    sourceSectorIds: ['THE_NULL_ZONE', 'THE_ABYSSAL_SINK'],
    minClearance: 2,
    requiresMandateFlag: false,
    spawn: { minDepth: 2, eliteChance: 0.45, bossChance: 0.75, boostFailCount: 2, guaranteeFailCount: 3 },
  },
  {
    targetSectorId: 'THE_SLAG_WORKS',
    unlockId: 'sector.slag_works',
    routeIntelId: 'transit-cipher',
    label: 'Slag Works Access',
    summary: 'Recover Transit Cipher from Ashen Wastes or Null Zone (Depth 2+).',
    sourceSectorIds: ['THE_ASHEN_WASTES', 'THE_NULL_ZONE'],
    minClearance: 6,
    requiresMandateFlag: false,
    spawn: { minDepth: 2, eliteChance: 0.4, bossChance: 0.7, boostFailCount: 2, guaranteeFailCount: 3 },
  },
  {
    targetSectorId: 'THE_BLACKLINE_TERMINUS',
    unlockId: 'sector.blackline_terminus',
    routeIntelId: 'blackline-credentials',
    label: 'Blackline Terminus Access',
    summary: 'Recover Blackline Credentials from Slag Works or Ashen Wastes (Depth 3).',
    sourceSectorIds: ['THE_SLAG_WORKS', 'THE_ASHEN_WASTES'],
    minClearance: 6,
    requiresMandateFlag: false,
    spawn: { minDepth: 3, eliteChance: 0.35, bossChance: 0.65, boostFailCount: 2, guaranteeFailCount: 3 },
  },
] as const;

const MANDATE_BY_TARGET = new Map(
  SECTOR_ACCESS_MANDATES.map((m) => [m.targetSectorId, m] as const),
);
const MANDATE_BY_INTEL = new Map(
  SECTOR_ACCESS_MANDATES.map((m) => [m.routeIntelId, m] as const),
);

export function getSectorAccessMandate(
  sectorId: SectorId,
): SectorAccessMandateDefinition | null {
  return MANDATE_BY_TARGET.get(sectorId) ?? null;
}

export function getMandateForRouteIntel(
  resourceId: ResourceItemId,
): SectorAccessMandateDefinition | null {
  return MANDATE_BY_INTEL.get(resourceId) ?? null;
}

export function isRouteIntelResourceId(id: string): id is ResourceItemId {
  return MANDATE_BY_INTEL.has(id as ResourceItemId);
}

export function isRouteIntelResource(resourceId: ResourceItemId): boolean {
  return hasResourceUsageTag(resourceId, 'ROUTE_INTEL')
    || isRouteIntelResourceId(resourceId);
}

export function canSectorBeBreached(
  profile: ProgressionProfile,
  sectorId: SectorId,
): boolean {
  return profile.sectors[sectorId]?.unlocked === true;
}

export function getSectorAccessMandateState(
  profile: ProgressionProfile,
  sectorId: SectorId,
): SectorAccessMandateState {
  return profile.sectors[sectorId]?.accessMandateState ?? 'LOCKED';
}

function mandateEligibilityMet(
  profile: ProgressionProfile,
  mandate: SectorAccessMandateDefinition,
): boolean {
  if (profile.runner.clearanceRank < mandate.minClearance) return false;
  if (mandate.requiresMandateFlag && !hasProgressionFlag(profile, 'flag.sector_access_mandates')) {
    return false;
  }
  return true;
}

export interface SectorMandateBriefing {
  sectorId: SectorId;
  unlocked: boolean;
  mandateState: SectorAccessMandateState;
  mandate: SectorAccessMandateDefinition | null;
  headline: string;
  detailLines: string[];
  canAcceptMandate: boolean;
  canBreach: boolean;
}

export function buildSectorMandateBriefing(
  profile: ProgressionProfile,
  sectorId: SectorId,
): SectorMandateBriefing {
  const sector = profile.sectors[sectorId];
  const unlocked = sector?.unlocked === true;
  const mandate = getSectorAccessMandate(sectorId);
  const mandateState = sector?.accessMandateState ?? (unlocked ? 'COMPLETED' : 'LOCKED');
  const name = veilBiomeDisplayName(sectorIdToVeilBiome(sectorId));

  if (unlocked || sectorId === 'THE_NULL_ZONE') {
    return {
      sectorId,
      unlocked: true,
      mandateState: 'COMPLETED',
      mandate,
      headline: `${name} // BREACH OPEN`,
      detailLines: ['Sector access stabilized. Breach vectors available.'],
      canAcceptMandate: false,
      canBreach: true,
    };
  }

  if (!mandate) {
    return {
      sectorId,
      unlocked: false,
      mandateState,
      mandate: null,
      headline: `${name} // LOCKED // ROUTE UNKNOWN`,
      detailLines: ['No access mandate defined.'],
      canAcceptMandate: false,
      canBreach: false,
    };
  }

  const intelName = getResourceDisplayName(mandate.routeIntelId);
  const failCount = sector?.routeIntelFailCount ?? 0;

  if (mandateState === 'LOCKED' || !mandateEligibilityMet(profile, mandate)) {
    return {
      sectorId,
      unlocked: false,
      mandateState: 'LOCKED',
      mandate,
      headline: `${name} // LOCKED // ROUTE UNKNOWN`,
      detailLines: [
        `Access Mandate: ${mandate.label}`,
        mandate.summary,
        `Requires Runner Clearance ${mandate.minClearance}`
          + (mandate.requiresMandateFlag ? ' + Sector Access Mandates' : ''),
      ],
      canAcceptMandate: false,
      canBreach: false,
    };
  }

  if (mandateState === 'AVAILABLE') {
    return {
      sectorId,
      unlocked: false,
      mandateState: 'AVAILABLE',
      mandate,
      headline: `${name} // LOCKED // MANDATE AVAILABLE`,
      detailLines: [
        `Access Mandate: ${mandate.label}`,
        mandate.summary,
        `Target cargo: ${intelName}`,
        'Accept the mandate to begin hunting route intel.',
      ],
      canAcceptMandate: true,
      canBreach: false,
    };
  }

  if (mandateState === 'ACTIVE') {
    const boostAt = mandate.spawn.boostFailCount ?? 2;
    const guaranteeAt = mandate.spawn.guaranteeFailCount ?? 3;
    const pityTier = resolveRouteIntelPityTier(failCount, boostAt, guaranteeAt);
    const pityLine =
      pityTier === 'GUARANTEED'
        ? 'Pity GUARANTEED — next combat at eligible depth drops route intel.'
        : pityTier === 'BOOSTED'
          ? `Pity BOOSTED — elite/boss spawn chance raised (${failCount}/${guaranteeAt}).`
          : failCount > 0
            ? `Route intel lost ${failCount}× — boost at ${boostAt}, guarantee at ${guaranteeAt}.`
            : 'Survive extraction with the intel in cargo.';
    return {
      sectorId,
      unlocked: false,
      mandateState: 'ACTIVE',
      mandate,
      headline: `${name} // LOCKED // MANDATE ACTIVE`,
      detailLines: [
        `Access Mandate: ${mandate.label}`,
        `Extract ${intelName} from: ${mandate.sourceSectorIds
          .map((id) => veilBiomeDisplayName(sectorIdToVeilBiome(id)))
          .join(' / ')}`,
        `Route intel lost on death: ${failCount} prior failure(s)`,
        pityLine,
      ],
      canAcceptMandate: false,
      canBreach: false,
    };
  }

  return {
    sectorId,
    unlocked: false,
    mandateState,
    mandate,
    headline: `${name} // LOCKED`,
    detailLines: [mandate.summary],
    canAcceptMandate: false,
    canBreach: false,
  };
}

/** Promote LOCKED → AVAILABLE when clearance/flags allow (does not activate). */
export function refreshSectorMandateAvailability(
  profile: ProgressionProfile,
): ProgressionProfile {
  let next = profile;
  let changed = false;
  const sectors = { ...next.sectors };

  SECTOR_ACCESS_MANDATES.forEach((mandate) => {
    const sector = sectors[mandate.targetSectorId];
    if (!sector || sector.unlocked) return;
    if (sector.accessMandateState !== 'LOCKED') return;
    if (!mandateEligibilityMet(next, mandate)) return;
    sectors[mandate.targetSectorId] = { ...sector, accessMandateState: 'AVAILABLE' };
    changed = true;
  });

  if (!changed) return profile;
  return { ...next, sectors };
}

/** Accept a mandate: AVAILABLE → ACTIVE. */
export function activateSectorAccessMandate(
  profile: ProgressionProfile,
  sectorId: SectorId,
): { profile: ProgressionProfile; ok: boolean; logLine: string } {
  const mandate = getSectorAccessMandate(sectorId);
  if (!mandate) {
    return { profile, ok: false, logLine: '>> ACCESS MANDATE — unknown sector.' };
  }
  const sector = profile.sectors[sectorId];
  if (!sector || sector.unlocked) {
    return { profile, ok: false, logLine: '>> ACCESS MANDATE — sector already unlocked.' };
  }
  let next = refreshSectorMandateAvailability(profile);
  const refreshed = next.sectors[sectorId];
  if (!refreshed || refreshed.accessMandateState === 'LOCKED') {
    return {
      profile: next,
      ok: false,
      logLine: `>> ACCESS MANDATE — ${mandate.label} still locked (clearance / flags).`,
    };
  }
  if (refreshed.accessMandateState === 'ACTIVE') {
    return { profile: next, ok: true, logLine: `>> ACCESS MANDATE — ${mandate.label} already active.` };
  }
  if (refreshed.accessMandateState === 'COMPLETED') {
    return { profile: next, ok: false, logLine: '>> ACCESS MANDATE — already completed.' };
  }

  const result = applyProgressionRewards(next, [
    { kind: 'SET_ACCESS_MANDATE', targetId: sectorId, mandateState: 'ACTIVE' },
  ], {
    logMessage: `Activated access mandate: ${mandate.label}`,
    eventKind: 'REWARD_APPLIED',
  });

  return {
    profile: result.profile,
    ok: true,
    logLine: `>> ACCESS MANDATE ACTIVE — ${mandate.label.toUpperCase()} // EXTRACT ${getResourceDisplayName(mandate.routeIntelId).toUpperCase()}`,
  };
}

export function cargoContainsResource(
  cargo: CargoRunState,
  resourceId: ResourceItemId,
): boolean {
  return cargo.containment.some((item) => item.itemId === resourceId)
    || cargo.grid.placed.some((item) => item.itemId === resourceId);
}

export interface RouteIntelSpawnContext {
  profile: ProgressionProfile;
  runSectorId: SectorId;
  depth: number;
  isElite: boolean;
  /** Gatekeeper / depth-boss / high-threat node. */
  isBoss: boolean;
  cargo: CargoRunState;
  seed?: string;
}

/**
 * Returns route intel IDs to inject for this combat (0–1 typically).
 * Only for ACTIVE mandates whose source sectors include the run sector.
 */
export function rollRouteIntelCombatDrops(ctx: RouteIntelSpawnContext): ResourceItemId[] {
  const rng = createSeededRng(ctx.seed ?? `route-intel:${ctx.runSectorId}:${ctx.depth}`);
  const drops: ResourceItemId[] = [];

  SECTOR_ACCESS_MANDATES.forEach((mandate) => {
    const sector = ctx.profile.sectors[mandate.targetSectorId];
    if (!sector || sector.unlocked) return;
    if (sector.accessMandateState !== 'ACTIVE') return;
    if (!mandate.sourceSectorIds.includes(ctx.runSectorId)) return;
    if (ctx.depth < mandate.spawn.minDepth) return;
    if (cargoContainsResource(ctx.cargo, mandate.routeIntelId)) return;

    const roll = resolveRouteIntelSpawnChance({
      failCount: sector.routeIntelFailCount ?? 0,
      isElite: ctx.isElite,
      isBoss: ctx.isBoss,
      eliteChance: mandate.spawn.eliteChance,
      bossChance: mandate.spawn.bossChance,
      boostFailCount: mandate.spawn.boostFailCount,
      guaranteeFailCount: mandate.spawn.guaranteeFailCount,
    });
    if (!roll.eligible) return;
    if (rng() <= roll.chance) {
      drops.push(mandate.routeIntelId);
    }
  });

  return drops;
}

export interface SectorAccessResolveInput {
  extractedSuccessfully: boolean;
  /** Resources counted as extracted this run. */
  extracted: ResourceQuantity;
  /** Resources lost on death this run. */
  lostOnDeath: ResourceQuantity;
  runSectorId?: SectorId | null;
}

export interface SectorAccessResolveResult {
  profile: ProgressionProfile;
  unlockedSectorIds: SectorId[];
  unlockLines: string[];
  logLines: string[];
}

function quantityHas(
  bag: ResourceQuantity,
  resourceId: ResourceItemId,
): boolean {
  return (bag[resourceId] ?? 0) > 0;
}

/** Apply sector unlocks / fail tracking after a run. */
export function resolveSectorAccessFromRun(
  profile: ProgressionProfile,
  input: SectorAccessResolveInput,
): SectorAccessResolveResult {
  let next = refreshSectorMandateAvailability(profile);
  const unlockedSectorIds: SectorId[] = [];
  const unlockLines: string[] = [];
  const logLines: string[] = [];

  SECTOR_ACCESS_MANDATES.forEach((mandate) => {
    const sector = next.sectors[mandate.targetSectorId];
    if (!sector || sector.unlocked) return;

    const hadExtracted = quantityHas(input.extracted, mandate.routeIntelId);
    const hadLost = quantityHas(input.lostOnDeath, mandate.routeIntelId);

    if (input.extractedSuccessfully && hadExtracted) {
      const grant = grantProgressionUnlock(next, mandate.unlockId, { force: true });
      next = grant.profile;
      // Ensure COMPLETED + unlocked even if catalog rewards partially skipped.
      next = applyProgressionRewards(next, [
        { kind: 'SET_SECTOR_UNLOCKED', targetId: mandate.targetSectorId, value: 1 },
        { kind: 'SET_ACCESS_MANDATE', targetId: mandate.targetSectorId, mandateState: 'COMPLETED' },
      ], {
        logMessage: `Sector unlocked via route intel: ${mandate.label}`,
        eventKind: 'UNLOCK_GRANTED',
      }).profile;

      // Clear fail count on success.
      next = {
        ...next,
        sectors: {
          ...next.sectors,
          [mandate.targetSectorId]: {
            ...next.sectors[mandate.targetSectorId],
            routeIntelFailCount: 0,
          },
        },
      };

      unlockedSectorIds.push(mandate.targetSectorId);
      const name = veilBiomeDisplayName(sectorIdToVeilBiome(mandate.targetSectorId));
      unlockLines.push(`${name} unlocked — ${getResourceDisplayName(mandate.routeIntelId)} extracted.`);
      logLines.push(
        `>> SECTOR ACCESS — ${name.toUpperCase()} UNLOCKED // ${getResourceDisplayName(mandate.routeIntelId).toUpperCase()} EXTRACTED`,
      );
      return;
    }

    if (!input.extractedSuccessfully && hadLost && sector.accessMandateState === 'ACTIVE') {
      const failCount = sector.routeIntelFailCount + 1;
      next = {
        ...next,
        sectors: {
          ...next.sectors,
          [mandate.targetSectorId]: {
            ...sector,
            routeIntelFailCount: failCount,
            accessMandateState: 'ACTIVE',
          },
        },
      };
      next = appendProgressionEvent(next, {
        kind: 'REWARD_APPLIED',
        message: `Route intel lost: ${mandate.routeIntelId} (fail ${failCount})`,
        unlockId: mandate.unlockId,
        meta: { routeIntelFailCount: failCount },
      });
      logLines.push(
        `>> SECTOR ACCESS — ${getResourceDisplayName(mandate.routeIntelId).toUpperCase()} LOST // MANDATE REMAINS ACTIVE (${failCount} FAIL)`,
      );
      const boostAt = mandate.spawn.boostFailCount ?? 2;
      const guaranteeAt = mandate.spawn.guaranteeFailCount ?? 3;
      const pityTier = resolveRouteIntelPityTier(failCount, boostAt, guaranteeAt);
      if (pityTier === 'GUARANTEED') {
        logLines.push(
          `>> FAILURE RECOVERY — ${getResourceDisplayName(mandate.routeIntelId).toUpperCase()} GUARANTEED ON NEXT COMBAT AT ELIGIBLE DEPTH`,
        );
      } else if (pityTier === 'BOOSTED') {
        logLines.push(
          `>> FAILURE RECOVERY — ${getResourceDisplayName(mandate.routeIntelId).toUpperCase()} SPAWN CHANCE BOOSTED`,
        );
      }
    }
  });

  next = refreshSectorMandateAvailability(next);

  return { profile: next, unlockedSectorIds, unlockLines, logLines };
}

export interface RouteIntelPityStatus {
  targetSectorId: SectorId;
  routeIntelId: ResourceItemId;
  mandateLabel: string;
  failCount: number;
  tier: ReturnType<typeof resolveRouteIntelPityTier>;
  boostAt: number;
  guaranteeAt: number;
  summaryLine: string;
}

export function getActiveRouteIntelPityStatuses(
  profile: ProgressionProfile,
): RouteIntelPityStatus[] {
  const statuses: RouteIntelPityStatus[] = [];
  SECTOR_ACCESS_MANDATES.forEach((mandate) => {
    const sector = profile.sectors[mandate.targetSectorId];
    if (!sector || sector.unlocked) return;
    if (sector.accessMandateState !== 'ACTIVE') return;
    const failCount = sector.routeIntelFailCount ?? 0;
    const boostAt = mandate.spawn.boostFailCount ?? 2;
    const guaranteeAt = mandate.spawn.guaranteeFailCount ?? 3;
    const tier = resolveRouteIntelPityTier(failCount, boostAt, guaranteeAt);
    const intelName = getResourceDisplayName(mandate.routeIntelId);
    let summaryLine: string;
    if (tier === 'GUARANTEED') {
      summaryLine = `Pity GUARANTEED — next combat at eligible depth drops ${intelName}.`;
    } else if (tier === 'BOOSTED') {
      summaryLine = `Pity BOOSTED — elite/boss spawn chance raised (${failCount}/${guaranteeAt} toward guarantee).`;
    } else if (failCount > 0) {
      summaryLine = `Route intel lost ${failCount}× — boost at ${boostAt}, guarantee at ${guaranteeAt}.`;
    } else {
      summaryLine = `No losses yet — extract ${intelName} to unlock.`;
    }
    statuses.push({
      targetSectorId: mandate.targetSectorId,
      routeIntelId: mandate.routeIntelId,
      mandateLabel: mandate.label,
      failCount,
      tier,
      boostAt,
      guaranteeAt,
      summaryLine,
    });
  });
  return statuses;
}

/** Debrief / theater lines for active failure-recovery state. */
export function buildFailureRecoveryDebriefLines(
  profile: ProgressionProfile,
  options?: { lostRouteIntelIds?: ResourceItemId[] },
): string[] {
  const lines: string[] = [];
  const lost = new Set(options?.lostRouteIntelIds ?? []);
  getActiveRouteIntelPityStatuses(profile).forEach((status) => {
    const name = veilBiomeDisplayName(sectorIdToVeilBiome(status.targetSectorId));
    const intelName = getResourceDisplayName(status.routeIntelId);
    const projectedFails = lost.has(status.routeIntelId)
      ? status.failCount + 1
      : status.failCount;
    const projectedTier = resolveRouteIntelPityTier(
      projectedFails,
      status.boostAt,
      status.guaranteeAt,
    );
    if (lost.has(status.routeIntelId)) {
      lines.push(
        `${intelName} lost — ${name} mandate remains active (${projectedFails} fail${projectedFails === 1 ? '' : 's'}).`,
      );
    }
    if (projectedTier === 'GUARANTEED') {
      lines.push(`FAILURE RECOVERY — ${intelName} guaranteed on next combat at eligible depth.`);
    } else if (projectedTier === 'BOOSTED') {
      lines.push(`FAILURE RECOVERY — ${intelName} spawn chance boosted (elite/boss).`);
    } else if (lost.has(status.routeIntelId) || status.failCount > 0) {
      lines.push(
        `Route intel lost ${projectedFails}× — boost at ${status.boostAt}, guarantee at ${status.guaranteeAt}.`,
      );
    }
  });
  return lines;
}

export function formatFailureRecoveryReport(profile: ProgressionProfile): string {
  const statuses = getActiveRouteIntelPityStatuses(profile);
  const lines = [
    '=== FAILURE RECOVERY (PHASE 1I) ===',
    `Tuning: boost@${FAILURE_RECOVERY_TUNING.boostFailCount} // guarantee@${FAILURE_RECOVERY_TUNING.guaranteeFailCount}`,
    `Boost mult: x${FAILURE_RECOVERY_TUNING.boostChanceMultiplier} +${FAILURE_RECOVERY_TUNING.boostChanceFlatBonus}`,
    `Active mandates: ${statuses.length}`,
    '',
  ];
  if (statuses.length === 0) {
    lines.push('(no active sector access mandates)');
  } else {
    statuses.forEach((s) => {
      const name = veilBiomeDisplayName(sectorIdToVeilBiome(s.targetSectorId));
      lines.push(`--- ${name.toUpperCase()} // ${s.mandateLabel} ---`);
      lines.push(`Intel: ${getResourceDisplayName(s.routeIntelId)}`);
      lines.push(`Fails: ${s.failCount} // Tier: ${s.tier}`);
      lines.push(`Boost@${s.boostAt} // Guarantee@${s.guaranteeAt}`);
      lines.push(s.summaryLine);
      lines.push('');
    });
  }
  return lines.join('\n');
}

/** Debug: set route-intel fail count for a locked/active mandate sector. */
export function debugSetRouteIntelFailCount(
  profile: ProgressionProfile,
  targetSectorId: SectorId,
  failCount: number,
): ProgressionProfile {
  const sector = profile.sectors[targetSectorId];
  if (!sector) return profile;
  return {
    ...profile,
    sectors: {
      ...profile.sectors,
      [targetSectorId]: {
        ...sector,
        routeIntelFailCount: Math.max(0, Math.floor(failCount)),
        accessMandateState:
          sector.accessMandateState === 'LOCKED' || sector.accessMandateState === 'AVAILABLE'
            ? 'ACTIVE'
            : sector.accessMandateState,
      },
    },
  };
}

/** Normalize helper for callers that persist account.progressionProfile. */
export function normalizeProfileForMandateWrite(
  profile: ProgressionProfile,
): ProgressionProfile {
  return normalizeProgressionProfile(profile);
}
