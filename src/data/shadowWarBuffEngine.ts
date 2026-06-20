import type { ShadowWarBuffId } from '../types/shadowWar';
import { calculateSectorControl, collectActiveShadowWarBuffs } from './shadowWarEngine';

export interface ShadowWarRunBuffModifiers {
  maxHpBonusPct: number;
  kineticArmorBonus: number;
  rareLootBonusPct: number;
  blackMarketDiscountPct: number;
  firstTurnApBonus: number;
}

export function shadowWarBuffsToRunModifiers(buffs: readonly ShadowWarBuffId[]): ShadowWarRunBuffModifiers {
  return {
    maxHpBonusPct: buffs.includes('MAX_HP_PLUS_10') ? 10 : 0,
    kineticArmorBonus: buffs.includes('KINETIC_ARMOR_PLUS_1') ? 1 : 0,
    rareLootBonusPct: buffs.includes('RARE_LOOT_PLUS_10') ? 10 : 0,
    blackMarketDiscountPct: buffs.includes('BLACK_MARKET_DISCOUNT_15') ? 15 : 0,
    firstTurnApBonus: buffs.includes('FIRST_TURN_AP_PLUS_1') ? 1 : 0,
  };
}

export { calculateSectorControl, collectActiveShadowWarBuffs };
