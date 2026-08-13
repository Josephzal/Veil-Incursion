/**
 * Phase 3J — run-scoped Sanctuary graft helpers.
 * Stage II-B — capacity from run depth; no Residue charge; no Class Rank gates.
 * Safehouse is not a graft equipment surface.
 * Phase D — Aegis assignments store encoded WA:/TECH: keys.
 */
import type { ClassType } from '../../types/game';
import type { AegisTechniqueLoadout } from '../../types/aegisCombat';
import type { WeaponFamilyId } from '../../types/weapon';
import { getClassGraftDefinition } from '../classGraftEngine';
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
  /**
   * @deprecated Stage II-B — ignored; grafts no longer cost Residue.
   */
  residueBalance?: number;
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
  /** Catalog cost retained for display/debug only — not charged. */
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
  const catalogCost = def.cost;

  const compat = evaluateGraftCompatibility({
    classId: args.classId,
    abilityId: assignmentKey,
    graftId: args.graftId,
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
    cost: catalogCost,
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
