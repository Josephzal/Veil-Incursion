export const DEFAULT_MAGAZINE_SIZE = 6;
export const VEIL_FLUX_CAP = 100;
export const ENVOY_OVERLOAD_THRESHOLD = 100;
export const ENVOY_OVERLOAD_SELF_DAMAGE = 10;

export type ActiveReloadResult = 'PERFECT' | 'STANDARD' | 'JAM';

export type HexShotCombatBuffs = {
  overchargedActive: boolean;
};

export type EnvoyCombatState = {
  veilFlux: number;
  overloaded: boolean;
  silenced: boolean;
};
