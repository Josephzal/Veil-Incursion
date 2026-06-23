import type { EnvoyAbilityId, HexShotAbilityId } from '../types/operativeClass';

export const PERFECT_RELOADS_FOR_ULTIMATE = 3;
export const PERFECT_PARRIES_FOR_ULTIMATE = 3;
export const ENVOY_FLUX_ULTIMATE_THRESHOLD = 100;

/** Proc-only mastery ultimates — never appear on the 4-slot command deck. */
export const HEX_SHOT_PROC_ULTIMATE: HexShotAbilityId = 'ZERO_PROTOCOL';
export const ENVOY_PROC_ULTIMATE: EnvoyAbilityId = 'CATACLYSM_SIGIL';

export const HEX_SHOT_PROC_ULTIMATES: readonly HexShotAbilityId[] = [HEX_SHOT_PROC_ULTIMATE];
export const ENVOY_PROC_ULTIMATES: readonly EnvoyAbilityId[] = [ENVOY_PROC_ULTIMATE];

export function isHexShotProcUltimate(abilityId: string): abilityId is HexShotAbilityId {
  return HEX_SHOT_PROC_ULTIMATES.includes(abilityId as HexShotAbilityId);
}

export function isEnvoyProcUltimate(abilityId: string): abilityId is EnvoyAbilityId {
  return ENVOY_PROC_ULTIMATES.includes(abilityId as EnvoyAbilityId);
}

export const FRACTURE_BREAK_PROMPT_MS = 1500;
export const ZERO_PROTOCOL_DURATION_MS = 2000;
export const ZERO_PROTOCOL_DAMAGE_PER_TAP = 3;
export const CATACLYSM_SIGIL_DURATION_MS = 1500;
export const CATACLYSM_SUCCESS_AOE = 50;
export const CATACLYSM_FAIL_AOE = 15;
export const CATACLYSM_FAIL_BACKLASH = 15;
export const CATACLYSM_FAIL_FLUX = 50;
