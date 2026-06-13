import type { CargoItemId } from './cargoGrid';
import type { FactionType } from './game';
import type { MacroBiomeFamily } from './narrativeProcedural';

export type Biome =
  | 'city_streets'
  | 'city_buildings'
  | 'forests'
  | 'underground'
  | 'backroads';

export type Cabal = 'Terran_Grid' | 'Solaris' | 'Legion' | 'Neutral';

export type Tag =
  | 'urban'
  | 'indoor'
  | 'outdoor'
  | 'occult'
  | 'physical'
  | 'hazardous'
  | 'subterranean'
  | 'tech'
  | 'nature';

export type TensionMechanic =
  | 'Mechanic_ScavengeBar'
  | 'Mechanic_ConcealSlider'
  | 'Mechanic_SigilTrace';

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

export interface ComplicationSeed {
  id: string;
  requiredTags: Tag[];
  flavorText: string;
  defaultPenalty: NarrativePenalty;
}

export interface MechanicResolver {
  text: string;
  tensionMechanic: TensionMechanic;
  onSuccess: string;
  onFailure: string;
}

export interface CabalResolver {
  text: string;
  requirementType: 'Cabal';
  requirementValue: Cabal;
  onSuccess: string;
}

/** JSON catalog item id (PascalCase / snake_case in resolver_sets.json). */
export type NarrativeJsonItemId =
  | 'Grid_Cracker_Mag'
  | 'Grave_Dust_Ampoule'
  | 'Spectral_Salt'
  | 'Sanguine_Ampoule'
  | 'Smoke_Ampoule'
  | 'Null_Key'
  | 'Hazmat_Shielding';

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

export interface ResolverSet {
  id: string;
  complicationId: string;
  optionA: MechanicResolver;
  optionB: CabalResolver;
  optionC: ItemResolver;
  optionD: OptionDResolver;
}

export interface GeneratedEncounter {
  assemblyId: string;
  biome: Biome;
  context: ContextSeed;
  complication: ComplicationSeed;
  resolverSet: ResolverSet;
  scenarioText: string;
}

const MACRO_TO_BIOME: Record<MacroBiomeFamily, Biome | null> = {
  CITY_STREETS: 'city_streets',
  CITY_BUILDINGS: 'city_buildings',
  FORESTS: 'forests',
  UNDERGROUND: 'underground',
  BACKROADS: 'backroads',
  DEEP_VEIL: null,
};

const BIOME_TO_MACRO: Record<Biome, MacroBiomeFamily> = {
  city_streets: 'CITY_STREETS',
  city_buildings: 'CITY_BUILDINGS',
  forests: 'FORESTS',
  underground: 'UNDERGROUND',
  backroads: 'BACKROADS',
};

const CABAL_TO_FACTION: Record<Exclude<Cabal, 'Neutral'>, FactionType> = {
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
  Smoke_Ampoule: 'smoke-ampoule',
  Null_Key: 'null-key',
  Hazmat_Shielding: 'hazmat-shielding',
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
  return CABAL_TO_FACTION[cabal];
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
