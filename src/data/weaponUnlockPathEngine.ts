import type { WeaponFamilyId } from '../types/weapon';
import { getWeaponFamily, STARTER_WEAPON_BY_CLASS } from './weaponRegistry';
import { isResourceItemId } from './resourceRegistry';
import { getResourceSourceIdentity } from './resourceSourceIdentity';

export type WeaponSlotPosition = 1 | 2 | 3;

export interface WeaponUnlockPathRow {
  id: WeaponFamilyId;
  slot: WeaponSlotPosition;
  liveDisplayName: string;
  classRankRequirement: string;
  resourceRequirements: readonly { resourceId: string; quantity: number; sectorHint: string; earliestDepth: string }[];
  earliestRealisticAvailability: string;
  expectedSuccessfulRunTiming: string;
  existingSaveOwnership: string;
  satisfiesPacingTarget: boolean;
  notes: string;
}

const SLOT_BY_ID: Record<WeaponFamilyId, WeaponSlotPosition> = {
  'aegis-runed-longsword': 1,
  'aegis-rift-edge': 2,
  'aegis-claymore-blade': 3,
  'hex-silver-core-sidearm': 1,
  'hex-void-cannon': 2,
  'hex-pulse-rifle': 3,
  'envoy-null-conduit': 1,
  'envoy-echo-lantern': 2,
  'envoy-sanguine-prism': 3,
};

function resourceMeta(resourceId: string): { sectorHint: string; earliestDepth: string } {
  if (!isResourceItemId(resourceId)) {
    return { sectorHint: 'INVALID', earliestDepth: '—' };
  }
  const identity = getResourceSourceIdentity(resourceId);
  const sectors = identity.primarySectors.length
    ? identity.primarySectors.join(', ')
    : 'see resourceRegistry';
  const depth = `D${identity.depthRules.minDepth}+ (pref ${identity.depthRules.preferredDepths.join(',') || 'any'})`;
  return { sectorHint: String(sectors), earliestDepth: depth };
}

/**
 * Phase 3C unlock/crafting closeout rows.
 * Live unlocks are **stash-cost gated only** (no classRank gate in code).
 * Pacing targets are met via resource drop timing from Phase 2 economy.
 */
export function buildWeaponUnlockPathTable(): WeaponUnlockPathRow[] {
  return (Object.keys(SLOT_BY_ID) as WeaponFamilyId[]).map((id) => {
    const def = getWeaponFamily(id);
    const slot = SLOT_BY_ID[id];
    const starter = STARTER_WEAPON_BY_CLASS[def.classId] === id;
    const resources = def.unlockRequirement.map((c) => {
      const meta = resourceMeta(c.resourceId);
      return {
        resourceId: c.resourceId,
        quantity: c.quantity,
        sectorHint: meta.sectorHint,
        earliestDepth: meta.earliestDepth,
      };
    });

    let earliest = 'Run 1 / immediate';
    let timing = 'Run 1';
    let satisfies = true;
    let notes = '';

    if (starter) {
      notes = 'startingUnlocked; no resource gate.';
    } else if (slot === 2) {
      earliest = 'After D1–D2 staples accumulate (sector 2 pacing)';
      timing = '~5–10 successful runs / class rank ~5 equivalent via stash';
      notes = 'No classRank gate — resource affordability is the unlock. Costs use live Phase 2 IDs.';
      // Mid mats include D2 items for most slot-2 weapons — still reachable mid campaign.
      satisfies = resources.every((r) => isResourceItemId(r.resourceId));
    } else {
      earliest = 'After mid D2+ mats (sector 3 / Breach II–III pacing)';
      timing = '~10–15 successful runs / class rank ~10 equivalent via stash';
      notes = 'Specialized pressure weapon — not a strict DPS upgrade over starter.';
      satisfies = resources.every((r) => isResourceItemId(r.resourceId));
    }

    return {
      id,
      slot,
      liveDisplayName: def.name,
      classRankRequirement: 'None (stash unlock only)',
      resourceRequirements: resources,
      earliestRealisticAvailability: earliest,
      expectedSuccessfulRunTiming: timing,
      existingSaveOwnership:
        'weaponUnlocks[] ownership preserved on normalizeWeaponProgression; starters re-seeded if missing.',
      satisfiesPacingTarget: satisfies,
      notes,
    };
  });
}

export function validateWeaponUnlockPaths(): string[] {
  const issues: string[] = [];
  const rows = buildWeaponUnlockPathTable();
  rows.forEach((row) => {
    if (row.slot === 1 && row.resourceRequirements.length > 0) {
      issues.push(`${row.id} starter should have empty unlockRequirement`);
    }
    row.resourceRequirements.forEach((r) => {
      if (!isResourceItemId(r.resourceId)) {
        issues.push(`${row.id} references missing resource ${r.resourceId}`);
      }
    });
    if (!row.satisfiesPacingTarget) {
      issues.push(`${row.id} fails pacing/resource validity`);
    }
  });
  // One starter per class
  (['AEGIS', 'HEX_SHOT', 'ENVOY'] as const).forEach((classId) => {
    const starters = rows.filter((r) => {
      const def = getWeaponFamily(r.id);
      return def.classId === classId && r.slot === 1;
    });
    if (starters.length !== 1) issues.push(`${classId} must have exactly one slot-1 weapon`);
  });
  return issues;
}

export function formatWeaponUnlockPathMarkdown(): string {
  const rows = buildWeaponUnlockPathTable();
  const lines = [
    '| ID | Slot | Rank gate | Resources | Earliest | Run timing | Save ownership |',
    '|---|---:|---|---|---|---|---|',
  ];
  rows.forEach((r) => {
    const res = r.resourceRequirements.length === 0
      ? '—'
      : r.resourceRequirements.map((x) => `${x.quantity}× ${x.resourceId} (${x.earliestDepth} / ${x.sectorHint})`).join('; ');
    lines.push(
      `| \`${r.id}\` | ${r.slot} | ${r.classRankRequirement} | ${res} | ${r.earliestRealisticAvailability} | ${r.expectedSuccessfulRunTiming} | ${r.existingSaveOwnership} |`,
    );
  });
  return lines.join('\n');
}
