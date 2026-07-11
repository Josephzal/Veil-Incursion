import type { CargoItemId } from '../types/cargoGrid';
import { CARGO_ITEM_CATALOG } from '../types/cargoGrid';
import {
  isRunItemMarketId,
  resolveRunItemMarketPrice,
  rollRunItemMarketStock,
  runItemMarketListing,
} from './runItemMarketEngine';

export interface BlackMarketCargoListing {
  id: CargoItemId;
  name: string;
  description: string;
  effect: string;
  price: number;
  /** Always stocked when true (Soul Core). */
  alwaysStocked?: boolean;
  /** Run items route to dedicated slots instead of cargo grid. */
  isRunItem?: boolean;
}

export const BLACK_MARKET_CARGO_LISTINGS: readonly BlackMarketCargoListing[] = [
  {
    id: 'soul-core',
    name: CARGO_ITEM_CATALOG['soul-core'].name,
    description: 'Condensed life-force from a Solaris ritual site. Restores 50% Soul Anchor in combat.',
    effect: 'EFFECT: +50% SOUL ANCHOR // 1×1 CARGO',
    price: 60,
    alwaysStocked: true,
  },
  {
    id: 'veil-shard',
    name: CARGO_ITEM_CATALOG['veil-shard'].name,
    description: 'Jagged veil interference. Maxes hostile Fracture Gauge and shatters charge channels.',
    effect: 'EFFECT: MAX FRACTURE // STUN CHANNEL // 1×1',
    price: 100,
  },
  {
    id: 'coagulation-stitch',
    name: CARGO_ITEM_CATALOG['coagulation-stitch'].name,
    description: 'Enchanted self-tying suture thread. Binds shut hexes and arterial bleed.',
    effect: 'EFFECT: CLEAR DEBUFFS +10% HP // 1×1',
    price: 40,
  },
  {
    id: 'resonance-bribe',
    name: CARGO_ITEM_CATALOG['resonance-bribe'].name,
    description: 'Encrypted false-anomaly data bundle. Scrambles faction trackers on the overworld.',
    effect: 'EFFECT: −25% RESONANCE // SCANNER USE',
    price: 130,
  },
  {
    id: 'void-surge-catalyst',
    name: CARGO_ITEM_CATALOG['void-surge-catalyst'].name,
    description: 'Unstable Veil runoff vial. Overclocks the supernatural conduit to 100% Reserve.',
    effect: 'EFFECT: MAX ABYSSAL RESERVE // 1×1',
    price: 120,
  },
] as const;

const ROTATING_CARGO_POOL = BLACK_MARKET_CARGO_LISTINGS
  .filter((entry) => !entry.alwaysStocked)
  .filter((entry) => !isRunItemMarketId(entry.id))
  .map((entry) => entry.id);

export function rollBlackMarketStock(depth = 1): CargoItemId[] {
  const runItems = rollRunItemMarketStock(depth);
  const cargoExtraCount = Math.max(0, 1 + Math.floor(Math.random() * 2) - Math.floor(runItems.length / 3));
  const shuffledCargo = [...ROTATING_CARGO_POOL].sort(() => Math.random() - 0.5);
  const cargoExtras = shuffledCargo.slice(0, cargoExtraCount);
  const merged = ['soul-core', ...runItems, ...cargoExtras] as CargoItemId[];
  const unique = [...new Set(merged)];
  return unique.slice(0, 5);
}

export function listingsForStock(stock: readonly CargoItemId[]): BlackMarketCargoListing[] {
  return stock.map((itemId) => {
    if (isRunItemMarketId(itemId)) {
      const listing = runItemMarketListing(itemId);
      return {
        id: itemId,
        name: listing.name,
        description: listing.description,
        effect: listing.effect,
        price: listing.price,
        isRunItem: true,
      };
    }
    const entry = BLACK_MARKET_CARGO_LISTINGS.find((listing) => listing.id === itemId);
    if (entry) return entry;
    const catalog = CARGO_ITEM_CATALOG[itemId];
    return {
      id: itemId,
      name: catalog?.name ?? itemId,
      description: 'Black market cargo listing.',
      effect: `EFFECT: ${(catalog?.name ?? itemId).toUpperCase()} // 1×1 CARGO`,
      price: catalog?.baseValue ?? 60,
    };
  });
}

export function resolveBlackMarketListingPrice(itemId: CargoItemId): number {
  if (isRunItemMarketId(itemId)) {
    return resolveRunItemMarketPrice(itemId);
  }
  const listing = BLACK_MARKET_CARGO_LISTINGS.find((entry) => entry.id === itemId);
  return listing?.price ?? CARGO_ITEM_CATALOG[itemId]?.baseValue ?? 60;
}

/** Run black market fence payout — one third of catalog listing price. */
export function blackMarketFencePrice(itemId: CargoItemId): number {
  return Math.floor(resolveBlackMarketListingPrice(itemId) / 3);
}
