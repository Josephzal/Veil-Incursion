import type { LeyLineMutationId } from '../types/leyLineMutation';
import { COMBAT_ACTION } from '../types/run';

export interface MutationCombatModifiers {
  strikeArmorPierce: number;
  ruinDotFracture: number;
  parryReflectPct: number;
  graveBindDamage: number;
  graveBindArmorShred: number;
  shatterPointArMultiplier: number;
  abyssalResonancePctPer10Stam: number;
  bloodTitheHealPctPer10Ar: number;
  demonLungStaminaPct: number;
  crimsonPactHpCostPct: number;
  startingAbyssalPercent: number;
  healMultiplier: number;
  maxHpMultiplier: number;
  abyssalCap: number;
  ashenMantleFree: boolean;
  phantomStrikeChance: number;
  nailApDrain: number;
  bloodTitheFree: boolean;
  bloodTitheCooldown: number;
  voidContagionDamage: number;
  corruptedBloodDamage: number;
}

export function hasMutation(
  mutations: readonly LeyLineMutationId[],
  id: LeyLineMutationId,
): boolean {
  return mutations.includes(id);
}

export function aggregateMutationModifiers(
  mutations: readonly LeyLineMutationId[],
): MutationCombatModifiers {
  const has = (id: LeyLineMutationId) => hasMutation(mutations, id);
  return {
    strikeArmorPierce: has('SHARPENED') ? 1 : 0,
    ruinDotFracture: has('VENOMOUS_RUIN') ? 10 : 0,
    parryReflectPct: has('SPIKED_WARD') ? 50 : 0,
    graveBindDamage: has('HEAVY_CALIBER') ? 15 : 0,
    graveBindArmorShred: has('EXECUTIONERS_GRIP') ? 1 : 0,
    shatterPointArMultiplier: has('SHATTER_POINT') ? 2 : 1,
    abyssalResonancePctPer10Stam: has('ABYSSAL_RESONANCE') ? 5 : 0,
    bloodTitheHealPctPer10Ar: has('BLACK_LIGHT_SIPHON') ? 3 : 2,
    demonLungStaminaPct: has('DEEP_LUNGS') ? 80 : 40,
    crimsonPactHpCostPct: has('BLOOD_PRICE') ? 5 : 15,
    startingAbyssalPercent: has('LEY_LINE_TAP') ? 50 : 0,
    healMultiplier: has('HYPER_METABOLISM') ? 1.5 : 1,
    maxHpMultiplier: has('HYPER_METABOLISM') ? 0.75 : 1,
    abyssalCap: has('ABYSSAL_OVERFLOW') ? 150 : COMBAT_ACTION.ABYSSAL_RESERVE_CAP,
    ashenMantleFree: has('REACTIVE_WARDS'),
    phantomStrikeChance: has('PHANTOM_STRIKES') ? 0.25 : 0,
    nailApDrain: has('EVENT_HORIZON') ? 2 : 1,
    bloodTitheFree: has('ECHOING_VOID'),
    bloodTitheCooldown: has('ECHOING_VOID') ? 2 : 0,
    voidContagionDamage: has('VOID_CONTAGION') ? 5 : 0,
    corruptedBloodDamage: has('CORRUPTED_BLOOD') ? 8 : 0,
  };
}
