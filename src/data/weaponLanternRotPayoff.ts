import type { WeaponFamilyId } from '../types/weapon';
import {
  LANTERN_FLUX_PURGE_DAMAGE_PER_EXTRA_ROT,
  LANTERN_FLUX_PURGE_EXTRA_ROT_CONSUME,
} from './weaponBasicEngine';
import { getVeilRotStacks } from './envoyRotEngine';
import type { ClassCombatEncounterState } from '../types/classCombatAbility';

/**
 * Echo Lantern Rot payoff via existing FLUX_PURGE (does not detonate Rot applied
 * on the same basic — Purge is a separate Flux-dump action).
 */
export function resolveLanternFluxPurgePayoff(args: {
  familyId: WeaponFamilyId | null | undefined;
  classState: ClassCombatEncounterState;
  targetId: string;
  baseDamage: number;
}): {
  rotConsume: number;
  damage: number;
  logLines: string[];
  lanternDetonation: boolean;
} {
  const stacks = getVeilRotStacks(args.classState, args.targetId);
  if (stacks <= 0) {
    return { rotConsume: 0, damage: args.baseDamage, logLines: [], lanternDetonation: false };
  }

  if (args.familyId !== 'envoy-echo-lantern') {
    return {
      rotConsume: 1,
      damage: args.baseDamage,
      logLines: [],
      lanternDetonation: false,
    };
  }

  const extra = Math.min(LANTERN_FLUX_PURGE_EXTRA_ROT_CONSUME, Math.max(0, stacks - 1));
  const rotConsume = 1 + extra;
  const damage = args.baseDamage + extra * LANTERN_FLUX_PURGE_DAMAGE_PER_EXTRA_ROT;
  return {
    rotConsume,
    damage,
    lanternDetonation: extra > 0,
    logLines: [
      extra > 0
        ? `[VAMBRACE] >> Rot siphon detonation — consumed ${rotConsume} stacks (+${extra * LANTERN_FLUX_PURGE_DAMAGE_PER_EXTRA_ROT} occult).`
        : '[VAMBRACE] >> Rot siphon — single stack (bank more Rot before Flux-Purge).',
    ],
  };
}
