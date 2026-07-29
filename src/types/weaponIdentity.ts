import type { ClassType } from './game';
import type { ResourceItemId } from './resourceItem';
import type { WeaponFamilyId } from './weapon';

/** Soft offer-weighting tags (Phase 3F). Not the same as hard ability eligibility. */
export type WeaponAffinityTag =
  | 'FRACTURE'
  | 'RELOAD'
  | 'EXECUTION'
  | 'ARMOR_PIERCE'
  | 'AOE'
  | 'CONTROL'
  | 'CURSE'
  | 'FLUX'
  | 'SACRIFICE'
  | 'HIGH_RISK'
  | 'RESERVE'
  | 'PARRY'
  | 'EVADE'
  | 'BALLISTIC'
  | 'MELEE'
  | 'OCCULT'
  | 'TRAP'
  | 'INTERRUPT'
  /** Null Conduit distinguishing soft signal (Clean Cycle fantasy). Soft weight only. */
  | 'CLEAN_CYCLE';

/** Mechanical tags stamped onto the unique basic for hard eligibility (3F). */
export type WeaponMechanicalTag = string;

export type WeaponUnlockBand = 'STARTER' | 'MID' | 'LATE';

export interface WeaponUnlockPath {
  band: WeaponUnlockBand;
  /** Human pacing note for 3C — not enforced by rank gates yet. */
  pacingNote: string;
  resourceCosts: readonly { resourceId: ResourceItemId; quantity: number }[];
}

/**
 * Design + soft-runtime identity profile (3C unlock notes, 3F tags/affinity).
 * Display renames are recorded here but not applied to registry names in 3D.
 */
export interface WeaponIdentityProfile {
  id: WeaponFamilyId;
  classId: ClassType;
  /** Live registry display name (unchanged in 3D). */
  liveDisplayName: string;
  /** Planned future display name if different (UI/migration pass later). */
  plannedDisplayName: string | null;
  oneSentencePlaystyle: string;
  primaryRole: string;
  unlock: WeaponUnlockPath;
  /** Hard tags intended for the unique basic after grafts transform the loadout. */
  mechanicalTags: readonly WeaponMechanicalTag[];
  /** Soft weighting affinities for Phase 3I (data only in 3F). */
  affinityTags: readonly WeaponAffinityTag[];
  meterSummary: string;
  uniqueBasicSummary: string;
  drawbackSummary: string;
  debugNotes?: string;
}
