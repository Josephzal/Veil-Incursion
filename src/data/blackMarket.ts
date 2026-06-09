import type { CargoItemId } from '../types/cargoGrid';
import { CARGO_ITEM_CATALOG } from '../types/cargoGrid';

export const BLACK_MARKET_ITEM_PRICE = 250;

export const RUN_CREDIT_STANDARD_KILL = 250;
export const RUN_CREDIT_ELITE_KILL = 350;
export const RUN_CREDIT_BOSS_KILL = 500;

export interface BlackMarketCargoListing {
  id: CargoItemId;
  name: string;
  description: string;
  effect: string;
  price: number;
}

export const BLACK_MARKET_CARGO_LISTINGS: readonly BlackMarketCargoListing[] = [
  {
    id: 'soul-core',
    name: CARGO_ITEM_CATALOG['soul-core'].name,
    description: 'Stabilized ley-fragment harvested from anchor chapels. Pack in cargo; deploy in combat to restore Soul Anchor integrity.',
    effect: 'EFFECT: +25% SOUL ANCHOR INTEGRITY // 1×1 CARGO SLOT',
    price: BLACK_MARKET_ITEM_PRICE,
  },
  {
    id: 'veil-shard',
    name: CARGO_ITEM_CATALOG['veil-shard'].name,
    description: 'Crystallized veil interference. Pack in cargo; deploy in combat to stagger a hostile and shatter World-Ender channels.',
    effect: 'EFFECT: STUN HOSTILE — SKIPS NEXT TURN // 1×1 CARGO SLOT',
    price: BLACK_MARKET_ITEM_PRICE,
  },
  {
    id: 'focusing-ampoule',
    name: CARGO_ITEM_CATALOG['focusing-ampoule'].name,
    description: 'Single-use attunement stabilizer. Pack in cargo grid; deploy on scanner for +1 attunement.',
    effect: 'EFFECT: +1 ATTUNEMENT // 1×1 CARGO SLOT',
    price: BLACK_MARKET_ITEM_PRICE,
  },
  {
    id: 'gravity-grapple',
    name: CARGO_ITEM_CATALOG['gravity-grapple'].name,
    description: 'Tactical rift anchor for narrative breach options. Occupies 1×1 cargo slot.',
    effect: 'EFFECT: NARRATIVE GATE TAG // 1×1 CARGO SLOT',
    price: BLACK_MARKET_ITEM_PRICE,
  },
] as const;
