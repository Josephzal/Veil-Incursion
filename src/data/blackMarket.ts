import {
  SOUL_CORE_ITEM,
  TARGET_FRAGMENT_ITEM,
  VEIL_SHARD_ITEM,
} from './incursionInventory';
import type { IncursionConsumableId } from '../types/incursionInventory';

export const BLACK_MARKET_ITEM_PRICE = 250;

export const RUN_CREDIT_STANDARD_KILL = 250;
export const RUN_CREDIT_ELITE_KILL = 350;
export const RUN_CREDIT_BOSS_KILL = 500;

export interface BlackMarketListing {
  id: IncursionConsumableId;
  name: string;
  description: string;
  effect: string;
  price: number;
}

export const BLACK_MARKET_LISTINGS: readonly BlackMarketListing[] = [
  {
    id: SOUL_CORE_ITEM.id,
    name: SOUL_CORE_ITEM.name,
    description: SOUL_CORE_ITEM.description,
    effect: `EFFECT: +${SOUL_CORE_ITEM.healPercent ?? 0}% SOUL ANCHOR INTEGRITY`,
    price: BLACK_MARKET_ITEM_PRICE,
  },
  {
    id: VEIL_SHARD_ITEM.id,
    name: VEIL_SHARD_ITEM.name,
    description: VEIL_SHARD_ITEM.description,
    effect: 'EFFECT: STUN HOSTILE — SKIPS NEXT TURN // SHATTERS WORLD-ENDER',
    price: BLACK_MARKET_ITEM_PRICE,
  },
  {
    id: TARGET_FRAGMENT_ITEM.id,
    name: TARGET_FRAGMENT_ITEM.name,
    description: TARGET_FRAGMENT_ITEM.description,
    effect: 'EFFECT: FIELD DEPLOYMENT PENDING — NOT YET OPERATIONAL',
    price: BLACK_MARKET_ITEM_PRICE,
  },
] as const;
