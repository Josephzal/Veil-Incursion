import type { ResourceItemId } from '../types/resourceItem';
import type { ProgressionProfile } from '../types/progression';
import type { SectorId } from '../types/worldState';
import type { ResourceQuantity } from '../types/resourceItem';
import type { BreachGradeId } from '../types/progression';
import { RESOURCE_REGISTRY, getResourceDisplayName } from './resourceRegistry';
import { isSectorUnlockedInProfile } from './progressionProfileEngine';
import { SECTOR_WORLD_TEMPLATES } from './sectorWorldCatalog';
import {
  getSectorResourceTable,
  sectorPrimaryResourcePool,
  sectorsListingResource,
} from './sectorResourceTableEngine';
import { formatBreachGradeLabel } from './breachGradeEngine';
import { evaluateAllPinnedGoals } from './pinnedGoalEngine';
import { getCraftingRecipe } from './craftingRegistry';
import { getStashCount } from './resourceStashEngine';
import { ECONOMY_V1_RESOURCE_IDS } from './economyRosterV1';
import { buildDebriefDiscoveryLines } from './resourceDiscoveryEngine';
import type { ResourceDiscoveryState } from '../types/resourceDiscovery';

/**
 * Phase 2G — resource source hints.
 * Exact / Partial / Unknown / Contract-directed — so “I need Rail Capacitor”
 * always has a next breach to run.
 */

export type ResourceSourceHintTier =
  | 'EXACT'
  | 'PARTIAL'
  | 'UNKNOWN'
  | 'CONTRACT_DIRECTED';

export interface ResourceSourceHint {
  resourceId: ResourceItemId;
  tier: ResourceSourceHintTier;
  /** Short name for UI headers. */
  resourceName: string;
  /** Primary player-facing lines (1–3). */
  lines: readonly string[];
  /** Single-line compact form for tooltips / ledger subtitles. */
  compact: string;
  /** Best unlocked (or recommended) sector when known. */
  recommendedSectorId: SectorId | null;
  recommendedGrade: BreachGradeId | null;
  pinnedGoalLabel?: string;
}

export interface ResourceSourceHintContext {
  profile: ProgressionProfile;
  /** Hub stash — owning a mat counts as discovery. */
  resourceStash?: ResourceQuantity;
  /** Prefer contract-directed when pinned goals need this mat. */
  preferContractDirected?: boolean;
}

function sectorDisplayName(sectorId: SectorId): string {
  return SECTOR_WORLD_TEMPLATES.find((t) => t.id === sectorId)?.displayName ?? sectorId;
}

function isSectorDiscovered(profile: ProgressionProfile, sectorId: SectorId): boolean {
  const state = profile.sectors[sectorId];
  if (!state) return sectorId === 'THE_NULL_ZONE';
  return state.unlocked || state.highestGradeCleared != null;
}

function isSectorKnown(profile: ProgressionProfile, sectorId: SectorId): boolean {
  if (sectorId === 'THE_NULL_ZONE') return true;
  if (isSectorDiscovered(profile, sectorId)) return true;
  const state = profile.sectors[sectorId];
  if (!state) return false;
  return state.accessMandateState === 'AVAILABLE'
    || state.accessMandateState === 'ACTIVE'
    || state.accessMandateState === 'COMPLETED';
}

function isResourceOwned(stash: ResourceQuantity | undefined, resourceId: ResourceItemId): boolean {
  return getStashCount(stash ?? {}, resourceId) > 0;
}

function bestSourceBlurb(resourceId: ResourceItemId, sectorId: SectorId): string {
  const def = RESOURCE_REGISTRY[resourceId];
  const secondary = def.secondarySources[0];
  if (secondary) return secondary;
  const table = getSectorResourceTable(sectorId);
  const rare = table.resources.find((entry) => (
    entry.resourceId === resourceId && (entry.band === 'RARE' || entry.band === 'APEX')
  ));
  if (rare?.note) return rare.note;
  if (table.whyRun[0]) return table.whyRun[0];
  return 'Resource Anomaly / sector caches';
}

function identityBlurb(resourceId: ResourceItemId): string {
  const def = RESOURCE_REGISTRY[resourceId];
  if (def.intendedUses[0]) return def.intendedUses[0];
  if (def.description) {
    const cut = def.description.split(/[.—]/)[0]?.trim();
    if (cut) return cut;
  }
  return `${def.shortName} component`;
}

/** Resolve which primary sector to speak about for this hint. */
export function resolveHintFocusSector(
  profile: ProgressionProfile,
  resourceId: ResourceItemId,
): { sectorId: SectorId | null; unlocked: boolean; known: boolean; discovered: boolean } {
  const primaries = RESOURCE_REGISTRY[resourceId].primarySectors;
  if (primaries.length === 0) {
    return { sectorId: null, unlocked: false, known: false, discovered: false };
  }

  const unlocked = primaries.find((id) => isSectorUnlockedInProfile(profile, id));
  if (unlocked) {
    return {
      sectorId: unlocked,
      unlocked: true,
      known: true,
      discovered: isSectorDiscovered(profile, unlocked),
    };
  }

  const discovered = primaries.find((id) => isSectorDiscovered(profile, id));
  if (discovered) {
    return {
      sectorId: discovered,
      unlocked: false,
      known: true,
      discovered: true,
    };
  }

  const known = primaries.find((id) => isSectorKnown(profile, id));
  if (known) {
    return {
      sectorId: known,
      unlocked: false,
      known: true,
      discovered: false,
    };
  }

  return {
    sectorId: primaries[0] ?? null,
    unlocked: false,
    known: false,
    discovered: false,
  };
}

export function buildContractDirectedHint(
  profile: ProgressionProfile,
  resourceId: ResourceItemId,
  stash?: ResourceQuantity,
): ResourceSourceHint | null {
  const statuses = evaluateAllPinnedGoals(profile).filter((s) => !s.completed);
  for (const status of statuses) {
    if (status.definition.kind !== 'RECIPE_UNLOCK') continue;
    const recipeId = status.definition.targetId;
    const recipe = getCraftingRecipe(`craft_${recipeId.replace(/-/g, '_')}`)
      ?? getCraftingRecipe(recipeId);
    if (!recipe) continue;
    const need = recipe.requirements.find((req) => req.resourceId === resourceId);
    if (!need) continue;
    const owned = getStashCount(stash ?? {}, resourceId);
    if (owned >= need.quantity) continue;

    const sectorId = status.recommendedSectorId
      ?? resolveHintFocusSector(profile, resourceId).sectorId;
    const grade = status.recommendedGrade ?? status.definition.recommendedGrade ?? 'II';
    const sectorLabel = sectorId ? sectorDisplayName(sectorId) : 'recommended sector';
    const lines = [
      `Pinned Goal: ${status.definition.label}`,
      `Missing: ${getResourceDisplayName(resourceId, true)}`,
      `Recommended breach: ${sectorLabel} // ${formatBreachGradeLabel(grade, true)}+`,
    ];
    return {
      resourceId,
      tier: 'CONTRACT_DIRECTED',
      resourceName: getResourceDisplayName(resourceId, true),
      lines,
      compact: lines.join(' · '),
      recommendedSectorId: sectorId,
      recommendedGrade: grade,
      pinnedGoalLabel: status.definition.label,
    };
  }
  return null;
}

export function resolveResourceSourceHint(
  resourceId: ResourceItemId,
  ctx: ResourceSourceHintContext,
): ResourceSourceHint {
  const preferContract = ctx.preferContractDirected !== false;
  if (preferContract) {
    const directed = buildContractDirectedHint(ctx.profile, resourceId, ctx.resourceStash);
    if (directed) return directed;
  }

  const name = getResourceDisplayName(resourceId, true);
  const focus = resolveHintFocusSector(ctx.profile, resourceId);
  const owned = isResourceOwned(ctx.resourceStash, resourceId);

  // Exact — primary sector unlocked (player can breach it).
  if (focus.sectorId && focus.unlocked) {
    const sectorName = sectorDisplayName(focus.sectorId);
    const table = getSectorResourceTable(focus.sectorId);
    const best = bestSourceBlurb(resourceId, focus.sectorId);
    const lines = [
      `Commonly found in ${sectorName} — ${table.role.replace(/\.$/, '')}.`,
      `Best source: ${best}.`,
    ];
    return {
      resourceId,
      tier: 'EXACT',
      resourceName: name,
      lines,
      compact: `${sectorName} — ${best}`,
      recommendedSectorId: focus.sectorId,
      recommendedGrade: null,
    };
  }

  // Partial — locked but known (mandate / intel), or owned without unlock.
  if (focus.sectorId && (focus.known || owned)) {
    const sectorName = sectorDisplayName(focus.sectorId);
    const lines = [
      identityBlurb(resourceId),
      focus.unlocked
        ? `Likely source: ${sectorName}.`
        : `Likely source: locked sector (${sectorName}).`,
    ];
    return {
      resourceId,
      tier: 'PARTIAL',
      resourceName: name,
      lines,
      compact: lines[1]!,
      recommendedSectorId: focus.sectorId,
      recommendedGrade: null,
    };
  }

  return {
    resourceId,
    tier: 'UNKNOWN',
    resourceName: name,
    lines: [
      'Unknown source.',
      'Recover more sector intel to identify this material.',
    ],
    compact: 'Unknown source — recover sector intel.',
    recommendedSectorId: focus.sectorId,
    recommendedGrade: null,
  };
}

/** Compact tooltip for a missing recipe ingredient. */
export function formatMissingResourceHint(
  resourceId: ResourceItemId,
  ctx: ResourceSourceHintContext,
): string {
  const hint = resolveResourceSourceHint(resourceId, ctx);
  if (hint.tier === 'CONTRACT_DIRECTED') {
    return hint.lines.join(' // ');
  }
  if (hint.tier === 'EXACT') {
    return hint.compact;
  }
  if (hint.tier === 'PARTIAL') {
    return hint.lines.join(' // ');
  }
  return hint.compact;
}

/** Veil Front sector farming preview lines (PRIMARY mats + why-run). */
export function formatSectorFarmingPreviewLines(
  sectorId: SectorId,
  profile: ProgressionProfile,
): string[] {
  const table = getSectorResourceTable(sectorId);
  const unlocked = isSectorUnlockedInProfile(profile, sectorId);
  const known = isSectorKnown(profile, sectorId);
  if (!known && !unlocked) {
    return [
      'Resource identity sealed.',
      'Recover sector intel / complete access mandate to reveal farming targets.',
    ];
  }
  const primaryNames = sectorPrimaryResourcePool(sectorId)
    .map((id) => getResourceDisplayName(id, true));
  if (!unlocked) {
    return [
      `Locked sector — likely yields: ${primaryNames.slice(0, 3).join(', ') || 'unknown'}.`,
      table.role,
    ];
  }
  return [
    `Farm: ${primaryNames.join(' · ')}`,
    `Why breach: ${table.whyRun.slice(0, 3).join(' · ')}`,
  ];
}

/** Pinned-goal missing mats with contract-directed hints. */
export function listPinnedGoalMissingResourceHints(
  profile: ProgressionProfile,
  stash?: ResourceQuantity,
): ResourceSourceHint[] {
  const seen = new Set<ResourceItemId>();
  const out: ResourceSourceHint[] = [];
  const statuses = evaluateAllPinnedGoals(profile).filter((s) => !s.completed);
  statuses.forEach((status) => {
    if (status.definition.kind !== 'RECIPE_UNLOCK') return;
    const recipeId = status.definition.targetId;
    const recipe = getCraftingRecipe(`craft_${recipeId.replace(/-/g, '_')}`)
      ?? getCraftingRecipe(recipeId);
    if (!recipe) return;
    recipe.requirements.forEach((req) => {
      if (seen.has(req.resourceId)) return;
      if (getStashCount(stash ?? {}, req.resourceId) >= req.quantity) return;
      seen.add(req.resourceId);
      out.push(resolveResourceSourceHint(req.resourceId, {
        profile,
        resourceStash: stash,
        preferContractDirected: true,
      }));
    });
  });
  return out;
}

/** Debrief lines: farm intel for extracted mats + pinned missing. */
export function buildDebriefSourceHintLines(args: {
  profile: ProgressionProfile;
  extracted?: ResourceQuantity;
  stash?: ResourceQuantity;
  discovery?: ResourceDiscoveryState;
  newlyDiscovered?: readonly ResourceItemId[];
}): string[] {
  const lines: string[] = [];

  const extractedIds = Object.entries(args.extracted ?? {})
    .filter(([, qty]) => (qty ?? 0) > 0)
    .map(([id]) => id as ResourceItemId)
    .slice(0, 6);

  const newly = args.newlyDiscovered
    ?? extractedIds.filter((id) => !args.discovery?.[id]?.discovered);
  if (newly.length > 0) {
    lines.push(...buildDebriefDiscoveryLines(newly, args.discovery));
  }

  extractedIds.forEach((resourceId) => {
    if (newly.includes(resourceId)) return;
    const hint = resolveResourceSourceHint(resourceId, {
      profile: args.profile,
      resourceStash: args.stash,
      preferContractDirected: false,
    });
    if (hint.tier === 'EXACT' || hint.tier === 'PARTIAL') {
      lines.push(`${hint.resourceName}: ${hint.compact}`);
    }
  });

  listPinnedGoalMissingResourceHints(args.profile, args.stash).forEach((hint) => {
    lines.push(...hint.lines);
  });

  return lines;
}

export function formatSourceHintTierLabel(tier: ResourceSourceHintTier): string {
  switch (tier) {
    case 'EXACT':
      return 'EXACT';
    case 'PARTIAL':
      return 'PARTIAL';
    case 'UNKNOWN':
      return 'UNKNOWN';
    case 'CONTRACT_DIRECTED':
      return 'GOAL';
    default:
      return tier;
  }
}

/** Smoke helper — every economy resource resolves a hint. */
export function assertAllEconomyResourcesHaveHints(profile: ProgressionProfile): ResourceItemId[] {
  return ECONOMY_V1_RESOURCE_IDS.filter((id) => {
    const hint = resolveResourceSourceHint(id, { profile, preferContractDirected: false });
    return hint.lines.length === 0;
  });
}

export function sectorsWhereResourceIsPrimary(resourceId: ResourceItemId): SectorId[] {
  return sectorsListingResource(resourceId, 'PRIMARY');
}
