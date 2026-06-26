export const DEFAULT_MAGAZINE_SIZE = 6;

/** Envoy begins encounters at full Veil-Flux and burns it down casting. */
export const VEIL_FLUX_START = 100;
export const VEIL_FLUX_CAP = 100;
export const VEIL_FLUX_CAP_BOOSTED = 120;

/** True damage each player turn while flux is depleted (Void-Siphoned). */
export const VOID_SIPHONED_SELF_DAMAGE = 10;
export const VOID_SIPHONED_MASOCHISTIC_DAMAGE = 20;

/** @deprecated Use VEIL_FLUX_CAP — kept for transitional imports. */
export const ENVOY_OVERLOAD_THRESHOLD = VEIL_FLUX_CAP;

/** @deprecated Use VOID_SIPHONED_SELF_DAMAGE. */
export const ENVOY_OVERLOAD_SELF_DAMAGE = VOID_SIPHONED_SELF_DAMAGE;

export type ActiveReloadResult = 'PERFECT' | 'JAM';

export type HexShotCombatBuffs = {
  overchargedActive: boolean;
};

export type EnvoyCombatState = {
  veilFlux: number;
  fluxMaxCap: number;
  isVoidSiphoned: boolean;
  voidSiphonedTurnDamage: number;
};
