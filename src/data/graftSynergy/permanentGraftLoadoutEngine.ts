/**
 * Phase 3J — run-scoped Sanctuary graft helpers.
 * Stage II-B — capacity from run depth; no Residue charge; no Class Rank gates.
 * Safehouse is not a graft equipment surface.
 * Phase D — Aegis assignments store encoded WA:/TECH: keys.
 */
import type { ClassType } from '../../types/game';
import type { AegisTechniqueLoadout } from '../../types/aegisCombat';
import type { WeaponFamilyId } from '../../types/weapon';
import { evaluateGraftCompatibility, isLiveGraftId } from './graftCompatibilityEngine';
import { normalizeAegisGraftAssignmentKey } from '../aegisGraftTarget';
import {
  getUniversalGraftDefinition,
  normalizeUniversalGraftId,
  universalGraftMatchesTarget,
} from '../universalGraftRegistry';

export type RunScopedGraftMap = Readonly<Record<string, string>>;

/** Sum Max HP penalties from current run-scoped graft map (reversible via baseline recompute). */
export function computeRunScopedGraftMaxHpPenaltyPct(
  _classId: ClassType,
  _graftMap: RunScopedGraftMap,
): number {
  return 0;
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
 * Does not check or consume Veil Residue (Stage II-B).
 */
export function validateSanctuaryGraftApplication(args: {
  classId: ClassType;
  abilityId: string;
  graftId: string;
  /** Core Loop Depth 1–3 (= currentDistrict). */
  runDepthBand: number;
  /**
   * @deprecated Stage II-B — ignored.
   */
  classRank?: number;
  /** Current map before this application. */
  currentMap: RunScopedGraftMap;
  /** True only while Sanctuary graft terminal session is active. */
  sanctuarySessionActive: boolean;
  /** True after Attune or one graft application for this stable visit. */
  sanctuaryServiceConsumed?: boolean;
  /**
   * @deprecated Stage II-B — ignored; grafts no longer cost Residue.
   */
  residueBalance?: number;
  /** Offered graft IDs for this Sanctuary visit (null = no session). */
  sanctuaryOffers: readonly string[] | null;
  /** Canonical equipped 4+3 target keys for this visit. */
  eligibleAbilityIds?: readonly string[];
  /** Aegis snapshotted surface — required to encode/validate targets. */
  aegisSurface?: {
    weaponFamilyId?: WeaponFamilyId | null;
    techniques?: AegisTechniqueLoadout | readonly string[] | null;
  };
}): {
  ok: boolean;
  message: string;
  proposedMap: Record<string, string>;
  /** Catalog cost retained for display/debug only — not charged. */
  cost: number;
  rejections: readonly string[];
} {
  if (args.sanctuaryServiceConsumed) {
    return {
      ok: false,
      message: 'Sanctuary service already consumed for this visit.',
      proposedMap: { ...args.currentMap },
      cost: 0,
      rejections: ['INVALID_CONTEXT'],
    };
  }
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
  if (args.eligibleAbilityIds && !args.eligibleAbilityIds.includes(args.abilityId)) {
    return {
      ok: false,
      message: 'Target is not equipped on the current Sanctuary surface.',
      proposedMap: { ...args.currentMap },
      cost: 0,
      rejections: ['UNKNOWN_ABILITY'],
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

  const graftId = normalizeUniversalGraftId(args.graftId);
  if (!graftId || !universalGraftMatchesTarget(args.classId, assignmentKey, graftId)) {
    return {
      ok: false,
      message: 'Upgrade does not match this action.',
      proposedMap: { ...args.currentMap },
      cost: 0,
      rejections: ['SOCKET_INCOMPATIBLE'],
    };
  }
  const def = getUniversalGraftDefinition(graftId)!;

  const compat = evaluateGraftCompatibility({
    classId: args.classId,
    abilityId: assignmentKey,
    graftId,
    runDepthBand: args.runDepthBand,
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

  // Remove the old logical assignment before installing the one stable canonical ID.
  const proposedMap = { ...args.currentMap };
  if (args.classId === 'AEGIS') {
    const bare = assignmentKey.includes(':')
      ? assignmentKey.slice(assignmentKey.indexOf(':') + 1)
      : assignmentKey;
    delete proposedMap[bare];
    delete proposedMap[`WA:${bare}`];
    delete proposedMap[`TECH:${bare}`];
  } else {
    delete proposedMap[assignmentKey];
  }
  proposedMap[assignmentKey] = graftId;

  return {
    ok: true,
    message: `${def.name} ready.`,
    proposedMap,
    cost: 0,
    rejections: [],
  };
}

/** Filter rolled offers to live catalog IDs (no Class Rank / Apex lock). */
export function filterGraftOffersForRunDepth(
  classId: ClassType,
  offers: readonly string[],
  _runDepthBand?: number,
): string[] {
  return offers.filter((graftId) => isLiveGraftId(classId, graftId));
}

/**
 * @deprecated Stage II-B — alias of filterGraftOffersForRunDepth (rank ignored).
 */
export function filterGraftOffersForClassRank(
  classId: ClassType,
  offers: readonly string[],
  _classRank?: number,
): string[] {
  return filterGraftOffersForRunDepth(classId, offers);
}
