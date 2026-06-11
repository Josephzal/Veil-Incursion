import type { CargoItemId } from '../types/cargoGrid';
import { CARGO_ITEM_CATALOG } from '../types/cargoGrid';

export interface BlackMarketCargoListing {
  id: CargoItemId;
  name: string;
  description: string;
  effect: string;
  price: number;
  /** Always stocked when true (Soul Core). */
  alwaysStocked?: boolean;
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
    id: 'grave-dust-ampoule',
    name: CARGO_ITEM_CATALOG['grave-dust-ampoule'].name,
    description: 'Pulverized bone and synthetic amphetamines. Overclocks the nervous system mid-fight.',
    effect: 'EFFECT: 100% STAMINA +1 AP // 1×1',
    price: 75,
  },
  {
    id: 'grid-cracker-mag',
    name: CARGO_ITEM_CATALOG['grid-cracker-mag'].name,
    description: 'Terran Grid breaching munitions. Silent concussive wave shatters kinetic plating.',
    effect: 'EFFECT: −2 KINETIC ARMOR // 1×1',
    price: 50,
  },
  {
    id: 'eclipse-flare',
    name: CARGO_ITEM_CATALOG['eclipse-flare'].name,
    description: 'Anti-magic black-light flare. Burns occult wards off the target.',
    effect: 'EFFECT: −2 OCCULT WARDS // 1×1',
    price: 50,
  },
  {
    id: 'coagulation-stitch',
    name: CARGO_ITEM_CATALOG['coagulation-stitch'].name,
    description: 'Enchanted self-tying suture thread. Binds shut hexes and arterial bleed.',
    effect: 'EFFECT: CLEAR DEBUFFS +10% HP // 1×1',
    price: 40,
  },
  {
    id: 'dead-drop-token',
    name: CARGO_ITEM_CATALOG['dead-drop-token'].name,
    description: 'One-time ley-line router. Secures one cargo piece to the Cabal vault from the field.',
    effect: 'EFFECT: INSTANT CARGO EXTRACT // 1×1',
    price: 150,
  },
  {
    id: 'resonance-bribe',
    name: CARGO_ITEM_CATALOG['resonance-bribe'].name,
    description: 'Encrypted false-anomaly data bundle. Scrambles faction trackers on the overworld.',
    effect: 'EFFECT: −25% RESONANCE // SCANNER USE',
    price: 130,
  },
  {
    id: 'spall-weave-vest',
    name: CARGO_ITEM_CATALOG['spall-weave-vest'].name,
    description: 'Disposable kevlar and warding ash weave. Absorbs the next lethal strike entirely.',
    effect: 'EFFECT: ABSORB NEXT HIT // 1×1',
    price: 65,
  },
  {
    id: 'void-surge-catalyst',
    name: CARGO_ITEM_CATALOG['void-surge-catalyst'].name,
    description: 'Unstable Veil runoff vial. Overclocks the supernatural conduit to 100% Reserve.',
    effect: 'EFFECT: MAX ABYSSAL RESERVE // 1×1',
    price: 120,
  },
] as const;

const ROTATING_POOL = BLACK_MARKET_CARGO_LISTINGS
  .filter((entry) => !entry.alwaysStocked)
  .map((entry) => entry.id);

export function rollBlackMarketStock(): CargoItemId[] {
  const extraCount = 2 + Math.floor(Math.random() * 3);
  const shuffled = [...ROTATING_POOL].sort(() => Math.random() - 0.5);
  return ['soul-core', ...shuffled.slice(0, extraCount)];
}

export function listingsForStock(stock: readonly CargoItemId[]): BlackMarketCargoListing[] {
  const set = new Set(stock);
  return BLACK_MARKET_CARGO_LISTINGS.filter((entry) => set.has(entry.id));
}
