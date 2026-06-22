import type { SynergySquadSpec } from './synergyEncounterTypes';

function squad(
  id: string,
  allowedDepths: SynergySquadSpec['allowedDepths'],
  allowedBiomes: SynergySquadSpec['allowedBiomes'],
  roster: SynergySquadSpec['roster'],
): SynergySquadSpec {
  return { id, allowedDepths, allowedBiomes, roster };
}

const URBAN_MILITARIZED_SQUADS: SynergySquadSpec[] = [
  squad('CABAL_SHIELD_WALL', [1], ['CITY_STREETS', 'CITY_BUILDINGS', 'BLACK_SITE_SECTOR'], [
    { type: 'WARDEN', pos: 'FRONT_LEFT' },
    { type: 'FIXER', pos: 'BACK_RIGHT' },
  ]),
  squad('CABAL_PINNED_TARGET', [1], ['CITY_STREETS', 'CITY_BUILDINGS', 'BLACK_SITE_SECTOR'], [
    { type: 'BREACHER', pos: 'FRONT_CENTER' },
    { type: 'SPOTTER', pos: 'BACK_CENTER' },
  ]),
  squad('CABAL_BREACH_CLEAR', [1], ['CITY_STREETS', 'CITY_BUILDINGS', 'BLACK_SITE_SECTOR'], [
    { type: 'BREACHER', pos: 'FRONT_LEFT' },
    { type: 'CUTTER', pos: 'FRONT_RIGHT' },
    { type: 'BURNER', pos: 'BACK_RIGHT' },
  ]),
  squad('CORRUPT_CONCRETE_WALL', [1], ['CITY_STREETS', 'BLACK_SITE_SECTOR'], [
    { type: 'CONCRETE_GARGOYLE', pos: 'FRONT_CENTER' },
    { type: 'SAPPER', pos: 'BACK_RIGHT' },
  ]),
  squad('CABAL_VANGUARD_PATROL', [1], ['CITY_STREETS', 'CITY_BUILDINGS'], [
    { type: 'WARDEN', pos: 'FRONT_LEFT' },
    { type: 'CUTTER', pos: 'FRONT_RIGHT' },
    { type: 'CUTTER', pos: 'BACK_CENTER' },
  ]),
  squad('CABAL_RIOT_LINE', [1], ['CITY_STREETS', 'BLACK_SITE_SECTOR'], [
    { type: 'WARDEN', pos: 'FRONT_LEFT' },
    { type: 'WARDEN', pos: 'FRONT_RIGHT' },
    { type: 'SPOTTER', pos: 'BACK_CENTER' },
  ]),
  squad('CABAL_HEAVY_ORDNANCE', [1], ['CITY_BUILDINGS', 'BLACK_SITE_SECTOR'], [
    { type: 'BREACHER', pos: 'FRONT_CENTER' },
    { type: 'BURNER', pos: 'BACK_RIGHT' },
  ]),
  squad('CORRUPT_AUTO_DEFENSE', [1], ['CITY_BUILDINGS', 'BLACK_SITE_SECTOR'], [
    { type: 'WIRE_GHOUL', pos: 'FRONT_LEFT' },
    { type: 'SPOTTER', pos: 'BACK_RIGHT' },
  ]),
  squad('CABAL_URBAN_SKIRMISH', [1], ['CITY_STREETS', 'CITY_BUILDINGS'], [
    { type: 'CUTTER', pos: 'FRONT_LEFT' },
    { type: 'FIXER', pos: 'BACK_LEFT' },
    { type: 'SPOTTER', pos: 'BACK_RIGHT' },
  ]),

  squad('CABAL_TRENCH_WARFARE', [2, 3], ['CITY_STREETS', 'BLACK_SITE_SECTOR', 'FRACTAL_ABYSS'], [
    { type: 'WARDEN', pos: 'FRONT_LEFT' },
    { type: 'BREACHER', pos: 'FRONT_RIGHT' },
    { type: 'BURNER', pos: 'BACK_CENTER' },
  ]),
  squad('SQUAD_EE_ESCALATING_WALL', [2, 3], ['CITY_STREETS', 'CITY_BUILDINGS', 'DEEP_VEIL'], [
    { type: 'CONCRETE_GARGOYLE', pos: 'FRONT_CENTER' },
    { type: 'RESONANCE_CASTER', pos: 'BACK_LEFT' },
    { type: 'RESONANCE_CASTER', pos: 'BACK_RIGHT' },
  ]),
  squad('SQUAD_FF_DOUBLE_BIND', [2, 3], ['CITY_BUILDINGS', 'BLACK_SITE_SECTOR', 'DEEP_VEIL'], [
    { type: 'ECHOING_BRUTE', pos: 'FRONT_LEFT' },
    { type: 'SAPPER', pos: 'BACK_RIGHT' },
  ]),
  squad('SQUAD_HH_SCORCHED_EARTH', [2, 3], ['CITY_BUILDINGS', 'BLACK_SITE_SECTOR', 'FRACTAL_ABYSS'], [
    { type: 'SAPPER', pos: 'BACK_RIGHT' },
    { type: 'SPLINTER', pos: 'BACK_LEFT' },
  ]),
  squad('CABAL_SUPPRESSION_FIRE', [2], ['CITY_BUILDINGS', 'BLACK_SITE_SECTOR'], [
    { type: 'WARDEN', pos: 'FRONT_CENTER' },
    { type: 'SPOTTER', pos: 'BACK_LEFT' },
    { type: 'SPOTTER', pos: 'BACK_RIGHT' },
  ]),
  squad('CABAL_ARMORED_PHALANX', [2], ['CITY_STREETS', 'BLACK_SITE_SECTOR'], [
    { type: 'AMALGAM', pos: 'FRONT_CENTER' },
    { type: 'FIXER', pos: 'BACK_CENTER' },
  ]),
  squad('CABAL_THE_KILLBOX', [2], ['CITY_STREETS', 'CITY_BUILDINGS'], [
    { type: 'WARDEN', pos: 'FRONT_LEFT' },
    { type: 'WARDEN', pos: 'FRONT_RIGHT' },
    { type: 'BURNER', pos: 'BACK_LEFT' },
    { type: 'SPOTTER', pos: 'BACK_RIGHT' },
  ]),
  squad('CORRUPT_KINETIC_CASCADE', [2], ['CITY_BUILDINGS', 'BLACK_SITE_SECTOR'], [
    { type: 'ECHOING_BRUTE', pos: 'FRONT_LEFT' },
    { type: 'BREACHER', pos: 'FRONT_RIGHT' },
  ]),
  squad('CABAL_THE_FIREWALL', [2], ['BLACK_SITE_SECTOR'], [
    { type: 'BURNER', pos: 'FRONT_LEFT' },
    { type: 'BURNER', pos: 'FRONT_RIGHT' },
    { type: 'SAPPER', pos: 'BACK_CENTER' },
  ]),
];

const INDUSTRIAL_DECAY_SQUADS: SynergySquadSpec[] = [
  squad('CORRUPT_GUTTER_SCUM', [1], ['BACKROADS', 'UNDERGROUND'], [
    { type: 'GUTTER_GOLIATH', pos: 'FRONT_LEFT' },
    { type: 'SCUTTLER', pos: 'BACK_RIGHT' },
  ]),
  squad('CORRUPT_TOXIC_SPILL', [1], ['BACKROADS', 'UNDERGROUND'], [
    { type: 'SPALL', pos: 'FRONT_LEFT' },
    { type: 'SPALL', pos: 'FRONT_RIGHT' },
  ]),
  squad('CORRUPT_SCAVENGER_PACK', [1], ['BACKROADS', 'UNDERGROUND'], [
    { type: 'SCUTTLER', pos: 'FRONT_LEFT' },
    { type: 'SCUTTLER', pos: 'FRONT_RIGHT' },
    { type: 'FRACTURE_HOUND', pos: 'BACK_CENTER' },
  ]),
  squad('CORRUPT_FILTH_DWELLERS', [1], ['BACKROADS', 'UNDERGROUND'], [
    { type: 'MIASMA_SWARM', pos: 'FRONT_LEFT' },
    { type: 'SPALL', pos: 'FRONT_RIGHT' },
  ]),
  squad('CORRUPT_SLUDGE_CRAWLERS', [1], ['BACKROADS', 'UNDERGROUND'], [
    { type: 'GUTTER_GOLIATH', pos: 'FRONT_LEFT' },
    { type: 'MIASMA_SWARM', pos: 'FRONT_RIGHT' },
  ]),
  squad('CORRUPT_TOXIC_HARVEST', [1], ['BACKROADS', 'UNDERGROUND'], [
    { type: 'GRAVE_ROBBER', pos: 'BACK_CENTER' },
    { type: 'SPALL', pos: 'FRONT_LEFT' },
  ]),
  squad('CORRUPT_RAT_KING', [1], ['BACKROADS', 'UNDERGROUND'], [
    { type: 'MIASMA_SWARM', pos: 'FRONT_LEFT' },
    { type: 'SCUTTLER', pos: 'FRONT_RIGHT' },
    { type: 'FRACTURE_HOUND', pos: 'BACK_RIGHT' },
  ]),
  squad('CORRUPT_BROKEN_PIPES', [1], ['UNDERGROUND'], [
    { type: 'SPALL', pos: 'FRONT_LEFT' },
    { type: 'WIRE_GHOUL', pos: 'BACK_RIGHT' },
  ]),
  squad('CORRUPT_ABANDONED_TECH', [1], ['UNDERGROUND'], [
    { type: 'WIRE_GHOUL', pos: 'FRONT_LEFT' },
    { type: 'SAPPER', pos: 'BACK_RIGHT' },
  ]),

  squad('SQUAD_LL_TAR_PIT', [2, 3], ['BACKROADS', 'UNDERGROUND', 'DEEP_VEIL'], [
    { type: 'SCUTTLER', pos: 'FRONT_LEFT' },
    { type: 'TAR_SPITTER', pos: 'BACK_RIGHT' },
  ]),
  squad('SQUAD_MM_CHOKING_HAZARD', [2, 3], ['BACKROADS', 'UNDERGROUND', 'DEEP_VEIL'], [
    { type: 'SPALL', pos: 'FRONT_LEFT' },
    { type: 'SMOG_CALLER', pos: 'BACK_RIGHT' },
  ]),
  squad('SQUAD_NN_BRANDING_IRON', [2, 3], ['BACKROADS', 'FRACTAL_ABYSS'], [
    { type: 'GUTTER_GOLIATH', pos: 'FRONT_LEFT' },
    { type: 'SPLINTER', pos: 'BACK_RIGHT' },
  ]),
  squad('CORRUPT_ASPHYXIATION', [2], ['UNDERGROUND'], [
    { type: 'WIRE_GHOUL', pos: 'FRONT_LEFT' },
    { type: 'HOLLOW_LUNG', pos: 'BACK_RIGHT' },
  ]),
  squad('CORRUPT_TOXIC_SHOCK', [2], ['BACKROADS', 'UNDERGROUND'], [
    { type: 'CONCRETE_GARGOYLE', pos: 'FRONT_CENTER' },
    { type: 'HOLLOW_LUNG', pos: 'BACK_LEFT' },
    { type: 'SAPPER', pos: 'BACK_RIGHT' },
  ]),
  squad('CORRUPT_NERVE_DAMAGE_EARLY', [2], ['UNDERGROUND'], [
    { type: 'WIRE_GHOUL', pos: 'FRONT_LEFT' },
    { type: 'TAR_SPITTER', pos: 'BACK_RIGHT' },
  ]),
  squad('CORRUPT_ASHEN_COFFIN', [2], ['BACKROADS', 'UNDERGROUND'], [
    { type: 'AMALGAM', pos: 'FRONT_CENTER' },
    { type: 'HOLLOW_LUNG', pos: 'BACK_LEFT' },
    { type: 'SMOG_CALLER', pos: 'BACK_RIGHT' },
  ]),
  squad('CORRUPT_SMOG_SCREEN', [2], ['BACKROADS', 'UNDERGROUND'], [
    { type: 'SMOG_CALLER', pos: 'FRONT_CENTER' },
    { type: 'TAR_SPITTER', pos: 'BACK_LEFT' },
    { type: 'SCUTTLER', pos: 'BACK_RIGHT' },
  ]),
  squad('CORRUPT_DESPERATION_RUSH', [2], ['BACKROADS', 'UNDERGROUND'], [
    { type: 'ECHOING_BRUTE', pos: 'FRONT_LEFT' },
    { type: 'FRACTURE_HOUND', pos: 'FRONT_RIGHT' },
  ]),
];

const ORGANIC_WILDS_SQUADS: SynergySquadSpec[] = [
  squad('CORRUPT_FEEDING_GROUND', [1], ['FORESTS'], [
    { type: 'MIASMA_SWARM', pos: 'FRONT_LEFT' },
    { type: 'MIASMA_SWARM', pos: 'FRONT_RIGHT' },
    { type: 'GRAVE_ROBBER', pos: 'BACK_CENTER' },
  ]),
  squad('CORRUPT_RESTLESS_DEAD', [1], ['FORESTS'], [
    { type: 'THRALL', pos: 'FRONT_LEFT' },
    { type: 'THRALL', pos: 'FRONT_RIGHT' },
  ]),
  squad('CORRUPT_THE_PACK', [1], ['FORESTS'], [
    { type: 'FRACTURE_HOUND', pos: 'FRONT_LEFT' },
    { type: 'FRACTURE_HOUND', pos: 'FRONT_RIGHT' },
    { type: 'FRACTURE_HOUND', pos: 'BACK_CENTER' },
  ]),
  squad('CORRUPT_FUNGAL_BLOOM', [1], ['FORESTS'], [
    { type: 'HOLLOW_LUNG', pos: 'BACK_CENTER' },
    { type: 'MIASMA_SWARM', pos: 'FRONT_LEFT' },
  ]),
  squad('CORRUPT_BLEEDING_TREES', [1], ['FORESTS'], [
    { type: 'THRALL', pos: 'FRONT_LEFT' },
    { type: 'LEY_SIREN', pos: 'BACK_RIGHT' },
  ]),
  squad('CORRUPT_CARRION_FEEDERS', [1], ['FORESTS'], [
    { type: 'SCUTTLER', pos: 'FRONT_LEFT' },
    { type: 'GRAVE_ROBBER', pos: 'BACK_RIGHT' },
  ]),
  squad('CORRUPT_SWARM_NEST', [1], ['FORESTS'], [
    { type: 'MIASMA_SWARM', pos: 'FRONT_LEFT' },
    { type: 'MIASMA_SWARM', pos: 'FRONT_RIGHT' },
    { type: 'MIASMA_SWARM', pos: 'BACK_CENTER' },
  ]),
  squad('CORRUPT_OCCULT_RITUAL', [1], ['FORESTS'], [
    { type: 'LEY_SIREN', pos: 'BACK_LEFT' },
    { type: 'THRALL', pos: 'FRONT_RIGHT' },
  ]),
  squad('CORRUPT_BONE_YARD', [1], ['FORESTS'], [
    { type: 'GRAVE_ROBBER', pos: 'BACK_LEFT' },
    { type: 'GRAVE_ROBBER', pos: 'BACK_RIGHT' },
  ]),

  squad('SQUAD_GG_BACKALLEY_SURGEON', [2, 3], ['FORESTS', 'SANGUINE_ATRIUM'], [
    { type: 'THRALL', pos: 'FRONT_LEFT' },
    { type: 'ASH_WEEPER', pos: 'BACK_LEFT' },
    { type: 'LEY_SIREN', pos: 'BACK_RIGHT' },
  ]),
  squad('SQUAD_X_BOILING_POINT', [2, 3], ['FORESTS', 'SANGUINE_ATRIUM'], [
    { type: 'GOLEM', pos: 'FRONT_LEFT' },
    { type: 'HOOK_WEAVER', pos: 'BACK_RIGHT' },
  ]),
  squad('CORRUPT_FLESH_HARVEST', [2], ['FORESTS'], [
    { type: 'AMALGAM', pos: 'FRONT_CENTER' },
    { type: 'GRAVE_ROBBER', pos: 'BACK_CENTER' },
  ]),
  squad('CORRUPT_FEAST_OF_FLIES', [2], ['FORESTS'], [
    { type: 'SCUTTLER', pos: 'FRONT_LEFT' },
    { type: 'SCUTTLER', pos: 'FRONT_RIGHT' },
    { type: 'GRAVE_ROBBER', pos: 'BACK_CENTER' },
  ]),
  squad('CORRUPT_THE_GRAVEYARD', [2], ['FORESTS'], [
    { type: 'THRALL', pos: 'FRONT_LEFT' },
    { type: 'THRALL', pos: 'FRONT_RIGHT' },
    { type: 'GRAVE_ROBBER', pos: 'BACK_LEFT' },
    { type: 'ASH_WEEPER', pos: 'BACK_RIGHT' },
  ]),
  squad('CORRUPT_OCCULT_TETHER', [2], ['FORESTS'], [
    { type: 'ECHOING_BRUTE', pos: 'FRONT_LEFT' },
    { type: 'HOOK_WEAVER', pos: 'BACK_RIGHT' },
  ]),
  squad('CORRUPT_ABYSSAL_WORSHIP', [2], ['FORESTS'], [
    { type: 'LEY_SIREN', pos: 'BACK_LEFT' },
    { type: 'LEY_SIREN', pos: 'BACK_RIGHT' },
    { type: 'THRALL', pos: 'FRONT_CENTER' },
  ]),
  squad('CORRUPT_ASH_STORM', [2], ['FORESTS'], [
    { type: 'ASH_WEEPER', pos: 'FRONT_LEFT' },
    { type: 'ASH_WEEPER', pos: 'FRONT_RIGHT' },
    { type: 'HOLLOW_LUNG', pos: 'BACK_CENTER' },
  ]),
  squad('CORRUPT_SEARING_WOODS', [2], ['FORESTS'], [
    { type: 'SPLINTER', pos: 'BACK_LEFT' },
    { type: 'THRALL', pos: 'FRONT_RIGHT' },
    { type: 'HOOK_WEAVER', pos: 'BACK_RIGHT' },
  ]),
];

const DEPTH_3_SANGUINE_SQUADS: SynergySquadSpec[] = [
  squad('SQUAD_V_IMMORTAL_THRALLS', [3], ['SANGUINE_ATRIUM'], [
    { type: 'THRALL', pos: 'FRONT_LEFT' },
    { type: 'THRALL', pos: 'FRONT_RIGHT' },
    { type: 'ASH_WEEPER', pos: 'BACK_LEFT' },
    { type: 'NULL_SHADE', pos: 'BACK_RIGHT' },
  ]),
  squad('SQUAD_N_AMMO_FACTORY', [3], ['SANGUINE_ATRIUM'], [
    { type: 'MIASMA_SWARM', pos: 'FRONT_LEFT' },
    { type: 'MIASMA_SWARM', pos: 'FRONT_RIGHT' },
    { type: 'CHURN', pos: 'BACK_LEFT' },
    { type: 'ASH_WEEPER', pos: 'BACK_RIGHT' },
  ]),
  squad('SQUAD_Z_ENDLESS_MAGAZINE', [3], ['SANGUINE_ATRIUM'], [
    { type: 'THRALL', pos: 'FRONT_RIGHT' },
    { type: 'CHURN', pos: 'BACK_LEFT' },
  ]),
  squad('SQUAD_II_RABID_DOG', [3], ['SANGUINE_ATRIUM'], [
    { type: 'SLAG_BLOOD', pos: 'FRONT_LEFT' },
    { type: 'NULL_SHADE', pos: 'BACK_RIGHT' },
  ]),
  squad('SQUAD_JJ_BLOOD_TAX', [3], ['SANGUINE_ATRIUM'], [
    { type: 'IRON_MAIDEN', pos: 'FRONT_LEFT' },
    { type: 'HOOK_WEAVER', pos: 'BACK_RIGHT' },
  ]),
  squad('SQUAD_O_SPIKE_PIT', [3], ['SANGUINE_ATRIUM'], [
    { type: 'IRON_MAIDEN', pos: 'FRONT_LEFT' },
    { type: 'IRON_MAIDEN', pos: 'FRONT_RIGHT' },
    { type: 'TAR_SPITTER', pos: 'BACK_LEFT' },
    { type: 'LEY_SIREN', pos: 'BACK_RIGHT' },
  ]),
  squad('CORRUPT_MEAT_WALL', [3], ['SANGUINE_ATRIUM'], [
    { type: 'AMALGAM', pos: 'FRONT_CENTER' },
    { type: 'NULL_SHADE', pos: 'BACK_RIGHT' },
  ]),
  squad('CORRUPT_OPERATING_TABLE', [3], ['SANGUINE_ATRIUM'], [
    { type: 'IRON_MAIDEN', pos: 'FRONT_LEFT' },
    { type: 'WIRE_GHOUL', pos: 'FRONT_RIGHT' },
    { type: 'GRAVE_ROBBER', pos: 'BACK_LEFT' },
    { type: 'MEMORY_LEECH', pos: 'BACK_RIGHT' },
  ]),
  squad('SQUAD_PP_PRESSURE_COOKER', [3], ['SANGUINE_ATRIUM'], [
    { type: 'GOLEM', pos: 'FRONT_LEFT' },
    { type: 'LEY_SIREN', pos: 'BACK_RIGHT' },
  ]),
];

const DEPTH_3_COSMIC_SQUADS: SynergySquadSpec[] = [
  squad('SQUAD_Q_SUICIDE_SQUAD', [3], ['DEEP_VEIL', 'FRACTAL_ABYSS'], [
    { type: 'SPALL', pos: 'FRONT_LEFT' },
    { type: 'SPALL', pos: 'FRONT_RIGHT' },
    { type: 'NULL_SHADE', pos: 'BACK_LEFT' },
    { type: 'NULL_SHADE', pos: 'BACK_RIGHT' },
  ]),
  squad('SQUAD_S_OVERLOAD_TRAP', [3], ['DEEP_VEIL', 'FRACTAL_ABYSS'], [
    { type: 'GOLEM', pos: 'FRONT_LEFT' },
    { type: 'ECHOING_BRUTE', pos: 'FRONT_RIGHT' },
    { type: 'SPLINTER', pos: 'BACK_LEFT' },
    { type: 'SPATIAL_GLITCH', pos: 'BACK_RIGHT' },
  ]),
  squad('SQUAD_W_PHANTOM_EXECUTION', [3], ['DEEP_VEIL', 'FRACTAL_ABYSS'], [
    { type: 'ECHOING_BRUTE', pos: 'FRONT_LEFT' },
    { type: 'SCUTTLER', pos: 'FRONT_RIGHT' },
    { type: 'SPATIAL_GLITCH', pos: 'BACK_LEFT' },
    { type: 'TAR_SPITTER', pos: 'BACK_RIGHT' },
  ]),
  squad('SQUAD_BB_DEAD_END', [3], ['DEEP_VEIL', 'FRACTAL_ABYSS'], [
    { type: 'IRON_MAIDEN', pos: 'FRONT_LEFT' },
    { type: 'TAR_SPITTER', pos: 'BACK_LEFT' },
    { type: 'NULL_SHADE', pos: 'BACK_RIGHT' },
  ]),
  squad('SQUAD_CC_PANIC_CLOCK', [3], ['DEEP_VEIL', 'FRACTAL_ABYSS'], [
    { type: 'COIL_SPIKE_SNIPER', pos: 'BACK_LEFT' },
    { type: 'SPATIAL_GLITCH', pos: 'BACK_RIGHT' },
  ]),
  squad('SQUAD_KK_LOBOTOMY', [3], ['DEEP_VEIL', 'FRACTAL_ABYSS'], [
    { type: 'RESONANCE_CASTER', pos: 'BACK_LEFT' },
    { type: 'MEMORY_LEECH', pos: 'BACK_RIGHT' },
  ]),
  squad('SQUAD_OO_DIRTY_BOMB', [3], ['DEEP_VEIL'], [
    { type: 'SPALL', pos: 'FRONT_LEFT' },
    { type: 'CHURN', pos: 'BACK_RIGHT' },
  ]),
  squad('SQUAD_P_SABOTAGED_WALL', [3], ['DEEP_VEIL', 'FRACTAL_ABYSS'], [
    { type: 'GUTTER_GOLIATH', pos: 'FRONT_LEFT' },
    { type: 'MEMORY_LEECH', pos: 'BACK_LEFT' },
    { type: 'HOOK_WEAVER', pos: 'BACK_RIGHT' },
  ]),
  squad('SQUAD_DD_SHRAPNEL_TRAP', [3], ['DEEP_VEIL', 'FRACTAL_ABYSS'], [
    { type: 'SPALL', pos: 'FRONT_LEFT' },
    { type: 'SPALL', pos: 'FRONT_RIGHT' },
    { type: 'MEMORY_LEECH', pos: 'BACK_RIGHT' },
  ]),
  squad('SQUAD_R_UNTOUCHABLE_GUNNER', [3], ['FRACTAL_ABYSS'], [
    { type: 'CONCRETE_GARGOYLE', pos: 'FRONT_LEFT' },
    { type: 'CONCRETE_GARGOYLE', pos: 'FRONT_RIGHT' },
    { type: 'COIL_SPIKE_SNIPER', pos: 'BACK_LEFT' },
    { type: 'SMOG_CALLER', pos: 'BACK_RIGHT' },
  ]),
  squad('SQUAD_QQ_CROSSFIRE', [3], ['FRACTAL_ABYSS'], [
    { type: 'ECHOING_BRUTE', pos: 'FRONT_LEFT' },
    { type: 'COIL_SPIKE_SNIPER', pos: 'BACK_RIGHT' },
  ]),
  squad('SQUAD_T_ESCALATION_PROTOCOL', [3], ['DEEP_VEIL', 'FRACTAL_ABYSS'], [
    { type: 'SLAG_BLOOD', pos: 'FRONT_LEFT' },
    { type: 'SCUTTLER', pos: 'FRONT_RIGHT' },
    { type: 'RESONANCE_CASTER', pos: 'BACK_LEFT' },
    { type: 'RESONANCE_CASTER', pos: 'BACK_RIGHT' },
  ]),
  squad('SQUAD_AA_EXECUTIONERS_MARK', [3], ['DEEP_VEIL', 'FRACTAL_ABYSS'], [
    { type: 'SLAG_BLOOD', pos: 'FRONT_LEFT' },
    { type: 'SPLINTER', pos: 'BACK_RIGHT' },
  ]),
];

export const SYNERGY_DATABASE: readonly SynergySquadSpec[] = [
  ...URBAN_MILITARIZED_SQUADS,
  ...INDUSTRIAL_DECAY_SQUADS,
  ...ORGANIC_WILDS_SQUADS,
  ...DEPTH_3_SANGUINE_SQUADS,
  ...DEPTH_3_COSMIC_SQUADS,
];

export const DEPTH_3_EXCLUSIVE_ENEMIES = [
  'SPATIAL_GLITCH',
  'MEMORY_LEECH',
  'NULL_SHADE',
  'COIL_SPIKE_SNIPER',
  'CHURN',
  'SLAG_BLOOD',
  'IRON_MAIDEN',
] as const;

export const DEPTH_1_2_BIOMES: readonly SynergySquadSpec['allowedBiomes'][number][] = [
  'CITY_BUILDINGS',
  'CITY_STREETS',
  'BACKROADS',
  'BLACK_SITE_SECTOR',
  'UNDERGROUND',
  'FORESTS',
];

export const DEPTH_3_BIOMES: readonly SynergySquadSpec['allowedBiomes'][number][] = [
  'DEEP_VEIL',
  'FRACTAL_ABYSS',
  'SANGUINE_ATRIUM',
];
