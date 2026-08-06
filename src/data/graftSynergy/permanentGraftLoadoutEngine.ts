/**
 * Phase 3J — run-scoped Sanctuary graft helpers.
 * Class rank permanently unlocks capacity/sockets/tiers; applications are deployment-only.
 * Safehouse is not a graft equipment surface.
 * Phase D — Aegis assignments store encoded WA:/TECH: keys.
 */
import type { ClassType } from '../../types/game';
import type { AegisTechniqueLoadout } from '../../types/aegisCombat';
import type { WeaponFamilyId } from '../../types/weapon';
import { getClassGraftDefinition } from '../classGraftEngine';
import { getGraftSocketAccessForClassRank, inferGraftCostTier } from './graftCapacityEngine';
import { evaluateGraftCompatibility, isLiveGraftId } from './graftCompatibilityEngine';
import { normalizeAegisGraftAssignmentKey } from '../aegisGraftTarget';

export type RunScopedGraftMap = Readonly<Record<string, string>>;

/** Sum Max HP penalties from current run-scoped graft map (reversible via baseline recompute). */
export function computeRunScopedGraftMaxHpPenaltyPct(
  classId: ClassType,
  graftMap: RunScopedGraftMap,
): number {
  let total = 0;
  Object.values(graftMap).forEach((graftId) => {
    if (!graftId) return;
    const def = getClassGraftDefinition(classId, graftId);
    if (def.reduceMaxHp != null) total += def.reduceMaxHp;
  });
  return Math.min(0.5, total);
}

export function recomputeMaxSoulAnchorFromGraftBaseline(
  baselineMaxSoulAnchor: number,
  classId: ClassType,
  graftMap: RunScopedGraftMap,
): number {
  const penalty = computeRunScopedGraftMaxHpPenaltyPct(classId, graftMap);
  return Math.max(1, Math.floor(baselineMaxSoulAnchor * (1 - penalty)));
}

/**
 * Validate a Sanctuary apply/replace without mutating state.
 * `proposedMap` is the full post-commit ability→graft map for the class.
 */
export function validateSanctuaryGraftApplication(args: {
  classId: ClassType;
  abilityId: string;
  graftId: string;
  classRank: number;
  /** Current map before this application. */
  currentMap: RunScopedGraftMap;
  /** True only while Sanctuary graft terminal session is active. */
  sanctuarySessionActive: boolean;
  residueBalance: number;
  /** Offered graft IDs for this Sanctuary visit (null = no session). */
  sanctuaryOffers: readonly string[] | null;
  /** Aegis snapshotted surface — required to encode/validate targets. */
  aegisSurface?: {
    weaponFamilyId?: WeaponFamilyId | null;
    techniques?: AegisTechniqueLoadout | readonly string[] | null;
  };
}): {
  ok: boolean;
  message: string;
  proposedMap: Record<string, string>;
  cost: number;
  rejections: readonly string[];
} {
  if (!args.sanctuarySessionActive || args.sanctuaryOffers == null) {
    return {
      ok: false,
      message: 'Graft application requires an active Sanctuary session.',
      proposedMap: { ...args.currentMap },
      cost: 0,
      rejections: ['INVALID_CONTEXT'],
    };
  }
  if (!isLiveGraftId(args.classId, args.graftId)) {
    return {
      ok: false,
      message: 'Unknown graft.',
      proposedMap: { ...args.currentMap },
      cost: 0,
      rejections: ['UNKNOWN_GRAFT'],
    };
  }
  if (!args.sanctuaryOffers.includes(args.graftId)) {
    return {
      ok: false,
      message: 'That graft is not among the current Sanctuary offers.',
      proposedMap: { ...args.currentMap },
      cost: 0,
      rejections: ['NOT_IN_OFFERS'],
    };
  }

  let assignmentKey = args.abilityId;
  if (args.classId === 'AEGIS') {
    const encoded = normalizeAegisGraftAssignmentKey(args.abilityId, {
      weaponFamilyId: args.aegisSurface?.weaponFamilyId,
      techniques: args.aegisSurface?.techniques,
    });
    if (!encoded) {
      return {
        ok: false,
        message: 'Target is outside the snapshotted Aegis graft surface.',
        proposedMap: { ...args.currentMap },
        cost: 0,
        rejections: ['UNKNOWN_ABILITY'],
      };
    }
    assignmentKey = encoded;
  }

  const def = getClassGraftDefinition(args.classId, args.graftId);
  const cost = def.cost;

  const access = getGraftSocketAccessForClassRank(args.classRank);
  const tier = inferGraftCostTier(cost);
  if ((tier === 'APEX' || tier === 'MASTERWORK') && !access.allowApexMasterwork) {
    return {
      ok: false,
      message: 'Apex/Masterwork grafts require class rank 20.',
      proposedMap: { ...args.currentMap },
      cost: 0,
      rejections: ['APEX_LOCKED'],
    };
  }

  const compat = evaluateGraftCompatibility({
    classId: args.classId,
    abilityId: assignmentKey,
    graftId: args.graftId,
    classRank: args.classRank,
    equippedMap: args.currentMap,
    graftAvailable: true,
  });
  if (!compat.ok) {
    return {
      ok: false,
      message: `Incompatible: ${compat.rejections.join(',')}`,
      proposedMap: { ...args.currentMap },
      cost: 0,
      rejections: compat.rejections,
    };
  }

  if (args.residueBalance < cost) {
    return {
      ok: false,
      message: 'Insufficient Veil Residue.',
      proposedMap: { ...args.currentMap },
      cost: 0,
      rejections: ['INSUFFICIENT_RESIDUE'],
    };
  }

  // Replace any prior assignment on the same logical target (bare or encoded).
  const proposedMap = { ...args.currentMap };
  if (args.classId === 'AEGIS') {
    const bare = assignmentKey.includes(':')
      ? assignmentKey.slice(assignmentKey.indexOf(':') + 1)
      : assignmentKey;
    delete proposedMap[bare];
    delete proposedMap[`WA:${bare}`];
    delete proposedMap[`TECH:${bare}`];
  }
  proposedMap[assignmentKey] = args.graftId;

  return {
    ok: true,
    message: `${def.name} ready.`,
    proposedMap,
    cost,
    rejections: [],
  };
}

/** Filter rolled offers by class-rank socket/tier access (unlocked catalog options). */
export function filterGraftOffersForClassRank(
  classId: ClassType,
  offers: readonly string[],
  classRank: number,
): string[] {
  const access = getGraftSocketAccessForClassRank(classRank);
  return offers.filter((graftId) => {
    if (!isLiveGraftId(classId, graftId)) return false;
    const def = getClassGraftDefinition(classId, graftId);
    const tier = inferGraftCostTier(def.cost);
    if ((tier === 'APEX' || tier === 'MASTERWORK') && !access.allowApexMasterwork) return false;
    return true;
  });
}
