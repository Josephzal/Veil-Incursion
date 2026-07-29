/**
 * Phase 3J — hard graft compatibility (equip gates) vs advisory anti-synergy (separate).
 */
import type { ClassType } from '../../types/game';
import {
  classifyAbilitySocket,
  getGraftSocketAccessForClassRank,
  inferGraftCostTier,
  type GraftSocketCategory,
} from './graftCapacityEngine';
import { canGraftClassAbility, getClassGraftDefinition } from '../classGraftEngine';
import { ALL_HEX_SHOT_GRAFT_IDS } from '../hexShotGrafts';
import { ALL_ENVOY_GRAFT_IDS } from '../envoyGrafts';
import { ALL_VEIL_GRAFT_IDS } from '../veilGraftDatabase';

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
  | 'EXECUTOR_UNSUPPORTED';

export type GraftCompatibilityResult = {
  ok: boolean;
  rejections: readonly GraftCompatibilityRejection[];
  socket: GraftSocketCategory;
  costTier: ReturnType<typeof inferGraftCostTier> | null;
};

/** Safety: Hex fixed basic must never receive zero-ammo grafts that erase reload. */
const HEX_BASIC_AMMO_BYPASS_GRAFTS = new Set(['BLOOD_MAG_GRAFT']);

export function isLiveGraftId(classId: ClassType, graftId: string): boolean {
  if (classId === 'HEX_SHOT') return (ALL_HEX_SHOT_GRAFT_IDS as readonly string[]).includes(graftId);
  if (classId === 'ENVOY') return (ALL_ENVOY_GRAFT_IDS as readonly string[]).includes(graftId);
  return (ALL_VEIL_GRAFT_IDS as readonly string[]).includes(graftId);
}

export function evaluateGraftCompatibility(args: {
  classId: ClassType;
  abilityId: string;
  graftId: string;
  classRank: number;
  /** Current ability → graft map for this class. */
  equippedMap: Readonly<Record<string, string>>;
  /** True when the graft is permanently owned / available to equip. */
  graftAvailable: boolean;
}): GraftCompatibilityResult {
  const rejections: GraftCompatibilityRejection[] = [];
  const socket = classifyAbilitySocket(args.classId, args.abilityId);
  if (!isLiveGraftId(args.classId, args.graftId)) {
    return { ok: false, rejections: ['UNKNOWN_GRAFT'], socket, costTier: null };
  }
  const def = getClassGraftDefinition(args.classId, args.graftId);
  const costTier = inferGraftCostTier(def.cost);
  if ('classId' in def && def.classId && def.classId !== args.classId) {
    rejections.push('CLASS_MISMATCH');
  }
  if (!args.graftAvailable) rejections.push('NOT_OWNED_OR_UNAVAILABLE');

  const access = getGraftSocketAccessForClassRank(args.classRank);
  const equippedEntries = Object.entries(args.equippedMap).filter(([, g]) => Boolean(g));
  const alreadyOnAbility = args.equippedMap[args.abilityId];
  const countIfNew = equippedEntries.filter(([ability]) => ability !== args.abilityId).length
    + (alreadyOnAbility === args.graftId ? 0 : 1);

  if (countIfNew > access.capacity) rejections.push('CAPACITY_EXCEEDED');

  const duplicateElsewhere = equippedEntries.some(
    ([ability, g]) => ability !== args.abilityId && g === args.graftId,
  );
  if (duplicateElsewhere) rejections.push('DUPLICATE_GRAFT_ID');

  if (alreadyOnAbility && alreadyOnAbility !== args.graftId) {
    // Overwrite is allowed in live sanctuary inject; still flag for Phase 5 one-graft rule clarity
    // as soft — hard ban only when capacity would exceed after keeping both (N/A).
  }

  if (!canGraftClassAbility(args.classId, args.abilityId, {
    allowFixedBasic: access.allowFixedBasic,
    allowUltimate: access.allowUltimate,
  })) {
    if (socket === 'FIXED_BASIC_SIGNATURE' && !access.allowFixedBasic) {
      rejections.push('FIXED_BASIC_LOCKED');
    } else if (socket === 'ULTIMATE' && !access.allowUltimate) {
      rejections.push('ULTIMATE_LOCKED');
    } else if (socket !== 'STANDARD_ABILITY') {
      rejections.push('SOCKET_INCOMPATIBLE');
    }
  }

  if (socket === 'FIXED_BASIC_SIGNATURE' && !access.allowFixedBasic) {
    if (!rejections.includes('FIXED_BASIC_LOCKED')) rejections.push('FIXED_BASIC_LOCKED');
  }
  if (socket === 'ULTIMATE' && !access.allowUltimate) {
    if (!rejections.includes('ULTIMATE_LOCKED')) rejections.push('ULTIMATE_LOCKED');
  }
  if ((costTier === 'APEX' || costTier === 'MASTERWORK') && !access.allowApexMasterwork) {
    rejections.push('APEX_LOCKED');
  }

  if (
    args.classId === 'HEX_SHOT'
    && args.abilityId === 'SILVER_CORE_SIDEARM'
    && HEX_BASIC_AMMO_BYPASS_GRAFTS.has(args.graftId)
  ) {
    rejections.push('SAFETY_INVARIANT');
  }

  // Sponsor-restricted: live catalogs have no sponsor field — none.

  return { ok: rejections.length === 0, rejections, socket, costTier };
}
