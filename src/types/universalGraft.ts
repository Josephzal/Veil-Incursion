import type { ClassType } from './game';

export type UniversalGraftSource =
  | 'AEGIS_WEAPON_ACTION'
  | 'HEX_WEAPON_ACTION'
  | 'ENVOY_WEAPON_ACTION'
  | 'AEGIS_TECHNIQUE'
  | 'HEX_FLEX'
  | 'ENVOY_FLEX';

export type UniversalUpgradeAxis =
  | 'DIRECT_DAMAGE'
  | 'RESOURCE_GAIN'
  | 'ACCURACY_PENALTY'
  | 'STAMINA_COST'
  | 'DURATION_TURNS'
  | 'HAZARD_TICK_DAMAGE'
  | 'HEAL_PERCENT'
  | 'FLUX_COST'
  | 'REFLECT_PERCENT'
  | 'MAX_HP_REDUCTION'
  | 'EXPOSED_DEFENSE_REDUCTION'
  | 'AP_DRAIN'
  | 'REFLECT_DAMAGE'
  | 'RESERVE_GAIN'
  | 'HP_COST_PERCENT';

export type UniversalGraftId =
  `graft_${Lowercase<ClassType>}_${Lowercase<string>}`;

export interface UniversalGraftDefinition {
  id: UniversalGraftId;
  classId: ClassType;
  canonicalActionId: string;
  source: UniversalGraftSource;
  upgradeAxis: UniversalUpgradeAxis;
  baseValue: number;
  upgradedValue: number;
  previewCopy: string;
  actionDisplayLabel: string;
  /** Applied display name is always the authored action name plus “+”. */
  name: string;
  /** Grave Bind is the sole specialized execution overlay. */
  specializedExecution?: boolean;
  /** Legacy display adapters retain these neutral presentation fields. */
  description: string;
  cost: number;
  accentColor: string;
}

export interface UniversalCastPlanOverlay {
  graftId: UniversalGraftId | null;
  upgradeAxis: UniversalUpgradeAxis | null;
  currentAxisValue: number | null;
  upgradedAxisValue: number | null;
}

export function emptyUniversalCastPlanOverlay(): UniversalCastPlanOverlay {
  return {
    graftId: null,
    upgradeAxis: null,
    currentAxisValue: null,
    upgradedAxisValue: null,
  };
}
