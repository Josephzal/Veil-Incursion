import { DEPTH_3_EXCLUSIVE_ENEMY_KEYS } from '../types/encounterSpawn';
import { buildEncounterDeck, verifyEncounterDecks } from './encounterDeckBuilder';

/** Procedural combat deck — 10 templates × 5 biomes × 3 depths + curated rival squads. */
export const SYNERGY_DATABASE: readonly import('./synergyEncounterTypes').SynergySquadSpec[] =
  buildEncounterDeck();

export const DEPTH_3_EXCLUSIVE_ENEMIES = DEPTH_3_EXCLUSIVE_ENEMY_KEYS;

export const DEPTH_1_2_BIOMES: readonly import('./synergyEncounterTypes').SynergyBiome[] = [
  'CITY_BUILDINGS',
  'CITY_STREETS',
  'BACKROADS',
  'BLACK_SITE_SECTOR',
  'UNDERGROUND',
  'FORESTS',
];

export const DEPTH_3_BIOMES: readonly import('./synergyEncounterTypes').SynergyBiome[] = [
  'DEEP_VEIL',
  'FRACTAL_ABYSS',
  'SANGUINE_ATRIUM',
];

export { verifyEncounterDecks };
