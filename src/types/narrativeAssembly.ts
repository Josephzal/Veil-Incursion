import type { CargoItemId } from './cargoGrid';
import type { ClassType, FactionType } from './game';
import type { MacroBiomeFamily } from './narrativeProcedural';

export type Biome =
  | 'city_streets'
  | 'city_buildings'
  | 'forests'
  | 'underground'
  | 'backroads'
  | 'sunken_transit'
  | 'black_site_sector'
  | 'deep_veil'
  | 'fractal_abyss'
  | 'sanguine_atrium';

export type Cabal =
  | 'Terran_Grid'
  | 'Solaris'
  | 'Legion'
  | 'Void_Weavers'
  | 'The_Syndicate'
  | 'Aegis_Vanguard'
  | 'Neutral';

export type Tag =
  | 'urban'
  | 'indoor'
  | 'outdoor'
  | 'occult'
  | 'physical'
  | 'hazardous'
  | 'subterranean'
  | 'tech'
  | 'nature'
  | 'flooded'
  | 'industrial'
  | 'militarized'
  | 'organic'
  | 'void'
  | 'cosmic'
  | 'city'
  | 'forest';

/**
 * Narrative tension minigame IDs (out-of-combat).
 *
 * Naming — do not confuse with combat systems:
 * - Mechanic_ScavengeBar — OLD narrative loot/scavenge tension (InstabilityProtocol UI).
 *   Still supported for legacy content + DevTest force. Deprecated for new normal generation.
 * - Mechanic_ConcealSlider — player-facing **Scanner Sweep** (1D blind-zone tracking + sweep pulses).
 * - Mechanic_SigilTrace — player-facing **Ritual Echo** (sequence memory + forbidden beats).
 * - Mechanic_CipherRite — DEPRECATED in-game narrative hacking (Cipher Rite UI).
 *   Kept for DevTest force + legacy nodes only; in-game hacking now routes to
 *   Mechanic_LeyCircuitBreach.
 * - Mechanic_LeyCircuitBreach — player-facing **Ley Circuit Breach** (6×6 polarity
 *   routing puzzle: rotate conduits to route the signal to the Exit Seal in the
 *   required Grid/Veil polarity before the Trace meter fills).
 * - Mechanic_SignalAlignment — DEPRECATED in-game **Veil Lock** (limited rotatable
 *   glyph-key lock routing). Kept for DevTest force + legacy nodes only; in-game
 *   lock fiction now routes to Mechanic_SigilTumbler.
 * - Mechanic_SigilTumbler — player-facing **Sigil Tumbler** (occult-tech lockpick:
 *   find the hidden resonance angle, hold tension, and set four glyph tumblers on
 *   a randomized four-beat rhythm before Stability drains).
 * - Dead-Man's Switch — Hex Shot *combat graft* on Phase-Shift Reload. NOT a narrative mechanic.
 */
export type TensionMechanic =
  | 'Mechanic_ScavengeBar'
  | 'Mechanic_ConcealSlider'
  | 'Mechanic_SigilTrace'
  | 'Mechanic_CipherRite'
  | 'Mechanic_LeyCircuitBreach'
  | 'Mechanic_SignalAlignment'
  | 'Mechanic_SigilTumbler';

export type PenaltyType = 'HP' | 'Resonance';

export interface NarrativePenalty {
  type: PenaltyType;
  amount: number;
}

export interface ContextSeed {
  id: string;
  biomes: Biome[];
  tags: Tag[];
  flavorText: string;
}

export interface NarrativeReward {
  type: string;
  amount: number;
}

export interface ComplicationSeed {
  id: string;
  requiredTags: Tag[];
  flavorText: string;
  defaultPenalty: NarrativePenalty;
  defaultReward?: NarrativeReward;
}

export interface MechanicResolver {
  text: string;
  /** Omitted for plain stash / free secure paths (no tension minigame). */
  tensionMechanic?: TensionMechanic;
  onSuccess: string;
  onFailure: string;
}

export interface CabalResolver {
  text: string;
  requirementType: 'Cabal';
  requirementValue: Cabal;
  onSuccess: string;
}

export interface ClassResolver {
  text: string;
  requirementType: 'Class';
  requirementValue: ClassType;
  onSuccess: string;
}

export type OptionBResolver = CabalResolver | ClassResolver;

/** JSON catalog item id (PascalCase / snake_case in resolver_sets.json). */
export type NarrativeJsonItemId =
  | 'Grid_Cracker_Mag'
  | 'Grave_Dust_Ampoule'
  | 'Spectral_Salt'
  | 'Sanguine_Ampoule'
  | 'Smoke_Ampoule'
  | 'Null_Key'
  | 'Hazmat_Shielding'
  | 'FILTER_MASK'
  | 'EMP_GRENADE'
  | 'BREACHING_CHARGE'
  | 'VOID_ANCHOR'
  | 'PURITY_SEAL'
  | 'DEFUSAL_KIT'
  | 'GRAPPLE_LINE'
  | 'HAZMAT_SHIELDING'
  | 'SANGUINE_AMPOULE';

export interface ItemResolver {
  text: string;
  requirementType: 'Item';
  requirementValue: NarrativeJsonItemId | string;
  onSuccess: string;
}

export interface BruteForceResolver {
  text: string;
  type: 'BruteForce';
  onSuccess: string;
}

export interface RetreatResolver {
  text: string;
  type: 'Retreat';
  onSuccess: string;
}

export type OptionDResolver = BruteForceResolver | RetreatResolver;

export type OptionAResolver = MechanicResolver | BruteForceResolver;

export interface ResolverSet {
  id: string;
  complicationId: string;
  optionA: OptionAResolver;
  optionB: OptionBResolver;
  optionC: ItemResolver;
  optionD: OptionDResolver;
  assemblyMode?: 'static-v1' | 'dynamic-v2';
}

export interface GeneratedEncounter {
  assemblyId: string;
  biome: Biome;
  context: ContextSeed;
  complication: ComplicationSeed;
  resolverSet: ResolverSet;
  scenarioText: string;
  /** Rolled once per encounter — shared by options A/B/C on success. */
  bonusReward?: import('./narrativeBonusReward').NarrativeBonusReward;
  /** Dynamic v2 template ids for lock refresh / resolution lookup. */
  dynamicSelection?: { cabalTemplateId: string; itemTemplateId: string };
}

const MACRO_TO_BIOME: Record<MacroBiomeFamily, Biome | null> = {
  CITY_STREETS: 'city_streets',
  CITY_BUILDINGS: 'city_buildings',
  FORESTS: 'forests',
  UNDERGROUND: 'underground',
  BACKROADS: 'backroads',
  SUNKEN_TRANSIT: 'sunken_transit',
  BLACK_SITE_SECTOR: 'black_site_sector',
  DEEP_VEIL: 'deep_veil',
  FRACTAL_ABYSS: 'fractal_abyss',
  SANGUINE_ATRIUM: 'sanguine_atrium',
};

const BIOME_TO_MACRO: Record<Biome, MacroBiomeFamily> = {
  city_streets: 'CITY_STREETS',
  city_buildings: 'CITY_BUILDINGS',
  forests: 'FORESTS',
  underground: 'UNDERGROUND',
  backroads: 'BACKROADS',
  sunken_transit: 'SUNKEN_TRANSIT',
  black_site_sector: 'BLACK_SITE_SECTOR',
  deep_veil: 'DEEP_VEIL',
  fractal_abyss: 'FRACTAL_ABYSS',
  sanguine_atrium: 'SANGUINE_ATRIUM',
};

const CABAL_TO_FACTION: Partial<Record<Exclude<Cabal, 'Neutral'>, FactionType>> = {
  Terran_Grid: 'TERRAN_GRID',
  Solaris: 'SOLARIS',
  Legion: 'LEGION',
};

const FACTION_TO_CABAL: Record<FactionType, Cabal> = {
  TERRAN_GRID: 'Terran_Grid',
  SOLARIS: 'Solaris',
  LEGION: 'Legion',
};

/** Maps resolver_sets.json item ids to live cargo ids. Unmapped ids resolve to null. */
const JSON_ITEM_TO_CARGO: Partial<Record<NarrativeJsonItemId, CargoItemId>> = {
  Grid_Cracker_Mag: 'grid-cracker-mag',
  Grave_Dust_Ampoule: 'grave-dust-ampoule',
  Spectral_Salt: 'spectral-salt',
  Sanguine_Ampoule: 'sanguine-coagulant',
  SANGUINE_AMPOULE: 'sanguine-coagulant',
  Smoke_Ampoule: 'smoke-ampoule',
  Null_Key: 'null-key',
  Hazmat_Shielding: 'hazmat-shielding',
  HAZMAT_SHIELDING: 'hazmat-shielding',
  GRAPPLE_LINE: 'gravity-grapple',
};

const CARGO_TO_JSON_ITEM = Object.fromEntries(
  Object.entries(JSON_ITEM_TO_CARGO).map(([jsonId, cargoId]) => [cargoId, jsonId]),
) as Partial<Record<CargoItemId, NarrativeJsonItemId>>;

export function macroFamilyToBiome(family: MacroBiomeFamily): Biome | null {
  return MACRO_TO_BIOME[family];
}

export function biomeToMacroFamily(biome: Biome): MacroBiomeFamily {
  return BIOME_TO_MACRO[biome];
}

export function cabalToFaction(cabal: Cabal): FactionType | null {
  if (cabal === 'Neutral') return null;
  return CABAL_TO_FACTION[cabal] ?? null;
}

export function isOptionABruteForce(optionA: OptionAResolver): optionA is BruteForceResolver {
  return 'type' in optionA && optionA.type === 'BruteForce';
}

export function isOptionBClassResolver(optionB: OptionBResolver): optionB is ClassResolver {
  return optionB.requirementType === 'Class';
}

export function isOptionBCabalResolver(optionB: OptionBResolver): optionB is CabalResolver {
  return optionB.requirementType === 'Cabal';
}

export function factionToCabal(faction: FactionType): Cabal {
  return FACTION_TO_CABAL[faction];
}

export function jsonItemToCargoItemId(jsonItemId: string): CargoItemId | null {
  return (JSON_ITEM_TO_CARGO as Record<string, CargoItemId | undefined>)[jsonItemId] ?? null;
}

export function cargoItemIdToJsonItem(cargoItemId: CargoItemId): NarrativeJsonItemId | null {
  return CARGO_TO_JSON_ITEM[cargoItemId] ?? null;
}

export function isOptionDRetreat(optionD: OptionDResolver): optionD is RetreatResolver {
  return optionD.type === 'Retreat';
}

export function isOptionDBruteForce(optionD: OptionDResolver): optionD is BruteForceResolver {
  return optionD.type === 'BruteForce';
}
