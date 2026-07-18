import type { PlayerAccount } from '../types/game';
import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';
import type { SectorId } from '../types/worldState';
import type {
  ResourceDiscoveryCard,
  ResourceDiscoveryEntry,
  ResourceDiscoveryState,
} from '../types/resourceDiscovery';
import { RESOURCE_REGISTRY, getResourceDisplayName } from './resourceRegistry';
import { ECONOMY_V1_RESOURCE_IDS } from './economyRosterV1';
import { getStashCount } from './resourceStashEngine';
import { SECTOR_WORLD_TEMPLATES } from './sectorWorldCatalog';
import {
  getSectorResourceTable,
  sectorsListingResource,
} from './sectorResourceTableEngine';

/**
 * Phase 2I — resource discovery state (light codex).
 * Before discovery: fogged identity. After: true name + best source + uses.
 */

export function createEmptyResourceDiscoveryState(): ResourceDiscoveryState {
  return {};
}

function sectorDisplayName(sectorId: SectorId): string {
  return SECTOR_WORLD_TEMPLATES.find((t) => t.id === sectorId)?.displayName ?? sectorId;
}

/** Fogged title before the player has extracted this material. */
export function foggedResourceTitle(resourceId: ResourceItemId): string {
  const def = RESOURCE_REGISTRY[resourceId];
  if (def.category === 'CONTRABAND') return 'UNKNOWN BLACKSITE PACKAGE';
  if (def.category === 'UNSTABLE') return 'UNKNOWN VOLATILE SAMPLE';
  if (def.category === 'INTEL') {
    if (def.primaryRole === 'ROUTE_INTEL') return 'UNKNOWN ROUTE INTEL';
    return 'UNKNOWN INTEL COMPONENT';
  }
  if (def.usageTags.includes('INDUSTRIAL_MATERIAL') || def.usageTags.includes('SECTOR_MATERIAL')) {
    return 'UNKNOWN INDUSTRIAL COMPONENT';
  }
  if (def.usageTags.includes('BIOLOGICAL_MATERIAL') || def.usageTags.includes('OCCULT_MATERIAL')) {
    return 'UNKNOWN ORGANIC SAMPLE';
  }
  if (def.usageTags.includes('ECHO_MATERIAL')) return 'UNKNOWN RESONANT FRAGMENT';
  return 'UNKNOWN MATERIAL';
}

export function resolveBestKnownSource(
  resourceId: ResourceItemId,
  sectorId?: SectorId | null,
): string {
  const def = RESOURCE_REGISTRY[resourceId];
  if (def.secondarySources[0]) return def.secondarySources[0];
  const focus = sectorId
    ?? def.primarySectors[0]
    ?? sectorsListingResource(resourceId, 'PRIMARY')[0]
    ?? null;
  if (!focus) return def.sourceHint;
  const table = getSectorResourceTable(focus);
  const entry = table.resources.find((r) => r.resourceId === resourceId);
  if (entry?.note) return `${sectorDisplayName(focus)} — ${entry.note}`;
  if (table.whyRun[0]) return `${sectorDisplayName(focus)} — ${table.whyRun[0]}`;
  return `${sectorDisplayName(focus)} — ${def.sourceHint}`;
}

export function resolveKnownUses(resourceId: ResourceItemId, limit = 3): string[] {
  const def = RESOURCE_REGISTRY[resourceId];
  const uses = [...def.intendedUses];
  if (uses.length === 0 && def.primaryRole) {
    uses.push(def.primaryRole.replace(/_/g, ' ').toLowerCase());
  }
  return uses.slice(0, limit);
}

export function getDiscoveryEntry(
  state: ResourceDiscoveryState | undefined,
  resourceId: ResourceItemId,
): ResourceDiscoveryEntry {
  const existing = state?.[resourceId];
  if (existing) return existing;
  return {
    discovered: false,
    firstExtractedAtSector: null,
    bestKnownSource: null,
    knownUses: [],
  };
}

export function isResourceDiscovered(
  state: ResourceDiscoveryState | undefined,
  resourceId: ResourceItemId,
): boolean {
  return getDiscoveryEntry(state, resourceId).discovered;
}

export function createDiscoveryEntry(
  resourceId: ResourceItemId,
  opts?: { sectorId?: SectorId | null; runCount?: number },
): ResourceDiscoveryEntry {
  const sectorId = opts?.sectorId ?? RESOURCE_REGISTRY[resourceId].primarySectors[0] ?? null;
  return {
    discovered: true,
    firstExtractedAtSector: sectorId,
    bestKnownSource: resolveBestKnownSource(resourceId, sectorId),
    knownUses: resolveKnownUses(resourceId),
    discoveredAtRunCount: opts?.runCount,
  };
}

/** Seed discovery from current stash ownership (save migration / defaults). */
export function seedDiscoveryFromStash(
  stash: ResourceQuantity,
  existing?: ResourceDiscoveryState,
): ResourceDiscoveryState {
  const next: ResourceDiscoveryState = { ...(existing ?? {}) };
  ECONOMY_V1_RESOURCE_IDS.forEach((id) => {
    if (getStashCount(stash, id) <= 0) return;
    if (next[id]?.discovered) return;
    next[id] = createDiscoveryEntry(id);
  });
  return next;
}

export function markResourcesDiscovered(
  state: ResourceDiscoveryState | undefined,
  resourceIds: readonly ResourceItemId[],
  opts?: { sectorId?: SectorId | null; runCount?: number },
): { state: ResourceDiscoveryState; newlyDiscovered: ResourceItemId[] } {
  const next: ResourceDiscoveryState = { ...(state ?? {}) };
  const newlyDiscovered: ResourceItemId[] = [];
  resourceIds.forEach((resourceId) => {
    if (!RESOURCE_REGISTRY[resourceId]) return;
    if (next[resourceId]?.discovered) return;
    next[resourceId] = createDiscoveryEntry(resourceId, opts);
    newlyDiscovered.push(resourceId);
  });
  return { state: next, newlyDiscovered };
}

/** Diff stash gain → mark first-time discoveries. */
export function markDiscoveriesFromStashDelta(
  state: ResourceDiscoveryState | undefined,
  previousStash: ResourceQuantity,
  nextStash: ResourceQuantity,
  opts?: { sectorId?: SectorId | null; runCount?: number },
): { state: ResourceDiscoveryState; newlyDiscovered: ResourceItemId[] } {
  const gained: ResourceItemId[] = [];
  ECONOMY_V1_RESOURCE_IDS.forEach((id) => {
    const before = getStashCount(previousStash, id);
    const after = getStashCount(nextStash, id);
    if (after > before) gained.push(id);
  });
  return markResourcesDiscovered(state, gained, opts);
}

export function applyDiscoveryToAccount(
  account: PlayerAccount,
  resourceIds: readonly ResourceItemId[],
  opts?: { sectorId?: SectorId | null },
): { account: PlayerAccount; newlyDiscovered: ResourceItemId[] } {
  const result = markResourcesDiscovered(account.resourceDiscovery, resourceIds, {
    sectorId: opts?.sectorId ?? null,
  });
  if (result.newlyDiscovered.length === 0) {
    return { account, newlyDiscovered: [] };
  }
  return {
    account: { ...account, resourceDiscovery: result.state },
    newlyDiscovered: result.newlyDiscovered,
  };
}

export function buildResourceDiscoveryCard(
  resourceId: ResourceItemId,
  state: ResourceDiscoveryState | undefined,
  opts?: { sectorKnown?: boolean },
): ResourceDiscoveryCard {
  const entry = getDiscoveryEntry(state, resourceId);
  if (entry.discovered) {
    const name = getResourceDisplayName(resourceId, true);
    const source = entry.bestKnownSource ?? resolveBestKnownSource(resourceId, entry.firstExtractedAtSector);
    const uses = entry.knownUses.length > 0 ? entry.knownUses : resolveKnownUses(resourceId);
    const lines = [
      `Best source: ${source}`,
      `Used in: ${uses.join(', ')}`,
    ];
    if (entry.firstExtractedAtSector) {
      lines.push(`First extracted: ${sectorDisplayName(entry.firstExtractedAtSector)}`);
    }
    return {
      resourceId,
      tier: 'DISCOVERED',
      title: name,
      lines,
      compact: source,
      discovered: true,
    };
  }

  if (opts?.sectorKnown) {
    const fog = foggedResourceTitle(resourceId);
    const focus = RESOURCE_REGISTRY[resourceId].primarySectors[0];
    const lines = [
      identityRoleBlurb(resourceId),
      focus
        ? `Likely source: locked sector (${sectorDisplayName(focus)}).`
        : 'Likely source: locked sector.',
      `Used in: ${usageBandBlurb(resourceId)}`,
    ];
    return {
      resourceId,
      tier: 'SIGNAL',
      title: fog,
      lines,
      compact: lines[1]!,
      discovered: false,
    };
  }

  const fog = foggedResourceTitle(resourceId);
  const lines = [
    'Unknown source.',
    'Recover more sector intel / extract a sample to identify this material.',
    `Used in: ${usageBandBlurb(resourceId)}`,
  ];
  return {
    resourceId,
    tier: 'UNKNOWN',
    title: fog,
    lines,
    compact: 'Unknown source — recover sector intel.',
    discovered: false,
  };
}

function identityRoleBlurb(resourceId: ResourceItemId): string {
  const def = RESOURCE_REGISTRY[resourceId];
  if (def.intendedUses[0]) return def.intendedUses[0];
  return foggedResourceTitle(resourceId).replace('UNKNOWN ', '').toLowerCase();
}

function usageBandBlurb(resourceId: ResourceItemId): string {
  const def = RESOURCE_REGISTRY[resourceId];
  if (def.usageTags.includes('WEAPON_BLUEPRINT_MATERIAL')) {
    return 'weapon-tech recipes';
  }
  if (def.category === 'CONTRABAND') return 'appraisal / fence / sponsor delivery';
  if (def.category === 'INTEL') return 'scanner / contract intel sinks';
  if (def.category === 'UNSTABLE') return 'volatile craft / high-risk contracts';
  return 'craft / requisition sinks';
}

/** Debrief lines for materials newly identified this extract. */
export function buildDebriefDiscoveryLines(
  newlyDiscovered: readonly ResourceItemId[],
  state: ResourceDiscoveryState | undefined,
): string[] {
  return newlyDiscovered.slice(0, 6).map((resourceId) => {
    const card = buildResourceDiscoveryCard(resourceId, state);
    return `DISCOVERED: ${card.title} — ${card.compact}`;
  });
}

export function countDiscoveredResources(state: ResourceDiscoveryState | undefined): number {
  return ECONOMY_V1_RESOURCE_IDS.filter((id) => isResourceDiscovered(state, id)).length;
}

/** Ensure account has discovery seeded from stash (migration). */
export function ensureResourceDiscovery(account: PlayerAccount): PlayerAccount {
  const seeded = seedDiscoveryFromStash(account.resourceStash, account.resourceDiscovery);
  if (seeded === account.resourceDiscovery) return account;
  // Only rewrite when empty or missing discoveries that stash implies.
  const before = countDiscoveredResources(account.resourceDiscovery);
  const after = countDiscoveredResources(seeded);
  if (after === before && account.resourceDiscovery) return account;
  return { ...account, resourceDiscovery: seeded };
}

// Re-export helper used by debug without circular recipe import in hot paths.
export function listDiscoveredResourceIds(state: ResourceDiscoveryState | undefined): ResourceItemId[] {
  return ECONOMY_V1_RESOURCE_IDS.filter((id) => isResourceDiscovered(state, id));
}
