import type { SynergySquadSpec } from './synergyEncounterTypes';

function elite(
  id: string,
  allowedDepths: SynergySquadSpec['allowedDepths'],
  allowedBiomes: SynergySquadSpec['allowedBiomes'],
  roster: SynergySquadSpec['roster'],
): SynergySquadSpec {
  return { id, allowedDepths, allowedBiomes, roster };
}

export const ELITE_DATABASE: readonly SynergySquadSpec[] = [
  // ============================================================================
  // DEPTH 1 ELITES (Early Game Bosses)
  // ============================================================================
  elite('ELITE_WARDEN', [1], ['CITY_STREETS', 'CITY_BUILDINGS', 'BLACK_SITE_SECTOR'], [
    { type: 'WARDEN', pos: 'FRONT_CENTER', isAlpha: true },
  ]),
  elite('ELITE_BREACHER', [1], ['CITY_STREETS', 'CITY_BUILDINGS', 'BLACK_SITE_SECTOR'], [
    { type: 'BREACHER', pos: 'FRONT_CENTER', isAlpha: true },
  ]),
  elite('ELITE_GARGOYLE', [1], ['CITY_STREETS', 'BLACK_SITE_SECTOR'], [
    { type: 'CONCRETE_GARGOYLE', pos: 'FRONT_CENTER', isAlpha: true },
  ]),
  elite('ELITE_GOLIATH', [1], ['BACKROADS', 'UNDERGROUND'], [
    { type: 'GUTTER_GOLIATH', pos: 'FRONT_CENTER', isAlpha: true },
  ]),

  // Twin Terrors (Duos)
  elite('ELITE_HOUND_PACK', [1], ['CITY_STREETS', 'FORESTS', 'BACKROADS'], [
    { type: 'FRACTURE_HOUND', pos: 'FRONT_LEFT', isAlpha: true },
    { type: 'FRACTURE_HOUND', pos: 'FRONT_RIGHT', isAlpha: true },
  ]),
  elite('ELITE_TICK_SWARM', [1], ['FORESTS', 'UNDERGROUND'], [
    { type: 'MIASMA_SWARM', pos: 'FRONT_LEFT', isAlpha: true },
    { type: 'MIASMA_SWARM', pos: 'FRONT_RIGHT', isAlpha: true },
  ]),

  // Alpha Commanders (Alpha + standard minions)
  elite('ELITE_FIXER_NODE', [1], ['CITY_BUILDINGS', 'BLACK_SITE_SECTOR'], [
    { type: 'WARDEN', pos: 'FRONT_CENTER' },
    { type: 'FIXER', pos: 'BACK_CENTER', isAlpha: true },
  ]),
  elite('ELITE_GRAVE_ROBBER', [1], ['FORESTS', 'UNDERGROUND'], [
    { type: 'THRALL', pos: 'FRONT_CENTER' },
    { type: 'GRAVE_ROBBER', pos: 'BACK_CENTER', isAlpha: true },
  ]),

  // ============================================================================
  // DEPTH 2 ELITES (Mid Game Bosses)
  // ============================================================================
  elite('ELITE_AMALGAM', [2], ['CITY_STREETS', 'BLACK_SITE_SECTOR', 'FORESTS'], [
    { type: 'AMALGAM', pos: 'FRONT_CENTER', isAlpha: true },
  ]),
  elite('ELITE_ECHOING_BRUTE', [2], ['CITY_BUILDINGS', 'BLACK_SITE_SECTOR'], [
    { type: 'ECHOING_BRUTE', pos: 'FRONT_CENTER', isAlpha: true },
  ]),
  elite('ELITE_GOLEM', [2], ['FORESTS'], [
    { type: 'GOLEM', pos: 'FRONT_CENTER', isAlpha: true },
  ]),

  elite('ELITE_SCUTTLER_TWINS', [2], ['BACKROADS', 'UNDERGROUND'], [
    { type: 'SCUTTLER', pos: 'FRONT_LEFT', isAlpha: true },
    { type: 'SCUTTLER', pos: 'FRONT_RIGHT', isAlpha: true },
  ]),
  elite('ELITE_SPALL_BOMBERS', [2], ['BACKROADS', 'UNDERGROUND'], [
    { type: 'SPALL', pos: 'FRONT_LEFT', isAlpha: true },
    { type: 'SPALL', pos: 'FRONT_RIGHT', isAlpha: true },
  ]),

  elite('ELITE_LEY_SIREN', [2], ['FORESTS'], [
    { type: 'AMALGAM', pos: 'FRONT_CENTER' },
    { type: 'LEY_SIREN', pos: 'BACK_CENTER', isAlpha: true },
  ]),
  elite('ELITE_SMOG_CALLER', [2], ['BACKROADS', 'UNDERGROUND'], [
    { type: 'CONCRETE_GARGOYLE', pos: 'FRONT_CENTER' },
    { type: 'SMOG_CALLER', pos: 'BACK_CENTER', isAlpha: true },
  ]),

  // ============================================================================
  // DEPTH 3 ELITES (The Apex Nightmares)
  // ============================================================================
  elite('ELITE_SLAG_BLOOD', [3], ['BACKROADS', 'UNDERGROUND', 'SANGUINE_ATRIUM'], [
    { type: 'SLAG_BLOOD', pos: 'FRONT_CENTER', isAlpha: true },
  ]),
  elite('ELITE_IRON_MAIDEN', [3], ['SANGUINE_ATRIUM', 'DEEP_VEIL', 'FRACTAL_ABYSS'], [
    { type: 'IRON_MAIDEN', pos: 'FRONT_CENTER', isAlpha: true },
  ]),
  elite('ELITE_NULL_SHADE', [3], ['FRACTAL_ABYSS', 'DEEP_VEIL', 'SANGUINE_ATRIUM'], [
    { type: 'NULL_SHADE', pos: 'FRONT_CENTER', isAlpha: true },
  ]),
  elite('ELITE_MEMORY_LEECH', [3], ['DEEP_VEIL', 'FRACTAL_ABYSS'], [
    { type: 'MEMORY_LEECH', pos: 'FRONT_CENTER', isAlpha: true },
  ]),

  elite('ELITE_GLITCH_TWINS', [3], ['DEEP_VEIL', 'FRACTAL_ABYSS'], [
    { type: 'SPATIAL_GLITCH', pos: 'FRONT_LEFT', isAlpha: true },
    { type: 'SPATIAL_GLITCH', pos: 'FRONT_RIGHT', isAlpha: true },
  ]),

  elite('ELITE_COIL_SNIPER', [3], ['BLACK_SITE_SECTOR', 'FRACTAL_ABYSS'], [
    { type: 'WARDEN', pos: 'FRONT_LEFT' },
    { type: 'WARDEN', pos: 'FRONT_RIGHT' },
    { type: 'COIL_SPIKE_SNIPER', pos: 'BACK_CENTER', isAlpha: true },
  ]),
  elite('ELITE_CHURN_CANNON', [3], ['SANGUINE_ATRIUM', 'DEEP_VEIL'], [
    { type: 'THRALL', pos: 'FRONT_LEFT' },
    { type: 'THRALL', pos: 'FRONT_RIGHT' },
    { type: 'CHURN', pos: 'BACK_CENTER', isAlpha: true },
  ]),
];
