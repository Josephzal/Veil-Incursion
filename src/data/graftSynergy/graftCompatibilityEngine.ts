/**
 * Phase 3J — hard graft compatibility (equip gates) vs advisory anti-synergy (separate).
 * Phase D — Aegis mechanic-aware eligibility via aegisGraftCompatibility.
 * Stage II-B — capacity/category access from run depth band, not Class Rank.
 */
import type { ClassType } from '../../types/game';
import {
  classifyAbilitySocket,
  getGraftSocketAccessForRunDepth,
  inferGraftCostTier,
  type GraftSocketAccess,
  type GraftSocketCategory,
} from './graftCapacityEngine';
import { canGraftClassAbility } from '../classGraftEngine';
import { parseAegisGraftTargetKey } from '../aegisGraftTarget';
import {
  getUniversalGraftDefinition,
  getUniversalGraftForAction,
  universalGraftMatchesTarget,
} from '../universalGraftRegistry';

export type GraftCompatibilityRejection =
  | 'UNKNOWN_GRAFT'
  | 'UNKNOWN_ABILITY'
  | 'CLASS_MISMATCH'
  | 'SOCKET_INCOMPATIBLE'
  | 'CAPACITY_EXCEEDED'
  | 'DUPLICATE_GRAFT_ID'
  | 'ABILITY_ALREADY_GRAFTED'
  | 'FIXED_BASIC_LOCKED'
  | 'ULTIMATE_LOCKED'
  | 'APEX_LOCKED'
  | 'SAFETY_INVARIANT'
  | 'NOT_OWNED_OR_UNAVAILABLE'
  | 'EXECUTOR_UNSUPPORTED'
  | 'MECHANIC_INCOMPATIBLE';

export type GraftCompatibilityResult = {
  ok: boolean;
  rejections: readonly GraftCompatibilityRejection[];
  socket: GraftSocketCategory;
  costTier: ReturnType<typeof inferGraftCostTier> | null;
};

export function isLiveGraftId(classId: ClassType, graftId: string): boolean {
  return getUniversalGraftDefinition(graftId)?.classId === classId;
}

function resolveAccess(args: {
  runDepthBand?: number;
  access?: GraftSocketAccess;
}): GraftSocketAccess {
  if (args.access) return args.access;
  return getGraftSocketAccessForRunDepth(args.runDepthBand ?? 1);
}

export function evaluateGraftCompatibility(args: {
  classId: ClassType;
  abilityId: string;
  graftId: string;
  /** Core Loop Depth 1–3 (= currentDistrict). */
  runDepthBand?: number;
  /** Optional precomputed access — overrides runDepthBand. */
  access?: GraftSocketAccess;
  /**
   * @deprecated Stage II-B — ignored. Class Rank no longer gates grafts.
   * Kept optional so older call sites compile during migration.
   */
  classRank?: number;
  /** Current ability → graft map for this class. */
  equippedMap: Readonly<Record<string, string>>;
  /** True when the graft is permanently owned / available to equip. */
  graftAvailable: boolean;
}): GraftCompatibilityResult {
  const rejections: GraftCompatibilityRejection[] = [];
  const socket = classifyAbilitySocket(args.classId, args.abilityId);
  const graft = getUniversalGraftDefinition(args.graftId);
  if (!graft) {
    return { ok: false, rejections: ['UNKNOWN_GRAFT'], socket, costTier: null };
  }
  if (graft.classId !== args.classId) {
    rejections.push('CLASS_MISMATCH');
  }
  if (!args.graftAvailable) rejections.push('NOT_OWNED_OR_UNAVAILABLE');

  const access = resolveAccess(args);
  const equippedEntries = Object.entries(args.equippedMap).filter(([, g]) => Boolean(g));
  const alreadyOnAbility = args.equippedMap[args.abilityId];
  // Replacement on the same ability does not consume an extra socket.
  const countIfNew = equippedEntries.filter(([ability]) => ability !== args.abilityId).length
    + (alreadyOnAbility === args.graftId ? 0 : 1);

  if (countIfNew > access.capacity) rejections.push('CAPACITY_EXCEEDED');

  const canonicalActionId = args.abilityId.startsWith('WA:')
    ? args.abilityId.slice(3)
    : args.abilityId.startsWith('TECH:')
      ? args.abilityId.slice(5)
      : args.abilityId;
  if (!getUniversalGraftForAction(args.classId, canonicalActionId)) {
    rejections.push('UNKNOWN_ABILITY');
  } else if (!universalGraftMatchesTarget(args.classId, args.abilityId, args.graftId)) {
    rejections.push('SOCKET_INCOMPATIBLE');
  }
  if (args.classId === 'AEGIS') {
    const encoded = parseAegisGraftTargetKey(args.abilityId);
    if (!encoded) {
      if (!rejections.includes('UNKNOWN_ABILITY')) rejections.push('UNKNOWN_ABILITY');
    }
  }

  return { ok: rejections.length === 0, rejections, socket, costTier: null };
}
