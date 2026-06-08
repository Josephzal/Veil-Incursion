import {
  ClimateClusterId,
  EncounterType,
  MIN_COMBAT_NODES,
  PathChoice,
  RadarDot,
  RadarScanResult,
  RegionTheme,
  SectorDefinition,
  SkillCheckEvent,
  TOTAL_RUN_NODES,
  Trinket,
} from '../types/run';
import { getClusterBiomes } from './climateClusters';
import { pickSectorFromUnlocked } from './biomes';
import { BiomeType } from '../types/game';

export const INITIAL_SECTOR_POOL: SectorDefinition[] = [
  {
    id: 'hospital-icu',
    name: 'St. Jude Hospital',
    subsector: 'Intensive Care Unit',
    theme: 'HOSPITAL',
    description: 'Flatlined monitors flicker with ectoplasmic interference. IV drips pulse like ley-lines.',
  },
  {
    id: 'housing-boiler',
    name: 'Subsidized Housing Complex',
    subsector: 'Boiler Room',
    theme: 'HOUSING',
    description: 'Steam vents exhale cold mist. Something scratches inside the pipes.',
  },
  {
    id: 'forest-breach',
    name: 'Forgotten Forest',
    subsector: 'Breach Point',
    theme: 'FOREST',
    description: 'Ancient roots pierce asphalt. The canopy leaks starlight from another veil.',
  },
  {
    id: 'hospital-morgue',
    name: 'St. Jude Hospital',
    subsector: 'Morgue',
    theme: 'HOSPITAL',
    description: 'Drawer handles rattle without hands. Toe tags list names not yet dead.',
  },
  {
    id: 'city-subway',
    name: 'Metro Transit',
    subsector: 'Abandoned Platform',
    theme: 'CITY',
    description: 'A train that never arrives screeches in the static between stations.',
  },
  {
    id: 'housing-roof',
    name: 'Subsidized Housing Complex',
    subsector: 'Rooftop Antenna Array',
    theme: 'HOUSING',
    description: 'Satellite dishes hum wrong frequencies. Pigeons watch with too many eyes.',
  },
];

const REGION_ROOMS: Record<RegionTheme, SectorDefinition[]> = {
  HOSPITAL: [
    { id: 'h-icu', name: 'St. Jude Hospital', subsector: 'Intensive Care Unit', theme: 'HOSPITAL', description: 'Critical patients share beds with apparitions.' },
    { id: 'h-morgue', name: 'St. Jude Hospital', subsector: 'Morgue', theme: 'HOSPITAL', description: 'Cold storage. Warm secrets.' },
    { id: 'h-psych', name: 'St. Jude Hospital', subsector: 'Psych Ward', theme: 'HOSPITAL', description: 'Walls absorb whispers. Doors lock themselves.' },
    { id: 'h-pharm', name: 'St. Jude Hospital', subsector: 'Pharmacy Vault', theme: 'HOSPITAL', description: 'Pills rattle in bottles that were never opened.' },
  ],
  HOUSING: [
    { id: 'ho-boiler', name: 'Subsidized Housing Complex', subsector: 'Boiler Room', theme: 'HOUSING', description: 'Pressure gauges read impossible temperatures.' },
    { id: 'ho-laundry', name: 'Subsidized Housing Complex', subsector: 'Basement Laundry', theme: 'HOUSING', description: 'Dryers spin with no clothes inside.' },
    { id: 'ho-hall', name: 'Subsidized Housing Complex', subsector: 'East Wing Hallway', theme: 'HOUSING', description: 'Every door number is 13.' },
  ],
  FOREST: [
    { id: 'f-breach', name: 'Forgotten Forest', subsector: 'Breach Point', theme: 'FOREST', description: 'Reality thins where roots break through.' },
    { id: 'f-grove', name: 'Forgotten Forest', subsector: 'Hollow Grove', theme: 'FOREST', description: 'Trees lean inward, listening.' },
    { id: 'f-creek', name: 'Forgotten Forest', subsector: 'Blackwater Creek', theme: 'FOREST', description: 'Water runs upward at midnight.' },
  ],
  CITY: [
    { id: 'c-subway', name: 'Metro Transit', subsector: 'Subway Tunnel', theme: 'CITY', description: 'Third rail sparks violet.' },
    { id: 'c-alley', name: 'Downtown Grid', subsector: 'Service Alleyway', theme: 'CITY', description: 'Dumpsters contain more than trash.' },
    { id: 'c-rooftop', name: 'Commercial Block', subsector: 'Rooftop Access', theme: 'CITY', description: 'HVAC units breathe in sync.' },
  ],
};

const ENCOUNTER_LABELS: Record<EncounterType, string[]> = {
  COMBAT: ['Hostile Apparition', 'Veil Stalker', 'Incursion Vector'],
  SKILL_CHECK: ['Signal Anomaly', 'Rift Disturbance', 'Calibration Event'],
  REST: ['Sanctuary Anchor', 'Safe Room', 'Recovery Node'],
};

export const TRINKET_POOL: Trinket[] = [
  { id: 'tuning-fork', name: 'Tuning Fork', description: 'Resonates with parry windows.', effect: '+20% Parry Window, -5% Slice Damage', parryWindowBonus: 0.2, sliceDamagePenalty: 0.05 },
  { id: 'ghost-battery', name: 'Ghost Battery', description: 'Stores abyssal bleed from the veil.', effect: 'Start fights with 25% Abyssal', startingAbyssalReservePercent: 25 },
  { id: 'anchor-plate', name: 'Anchor Plate', description: 'Reinforced soul plating.', effect: '+15 Max Soul Anchor HP', maxHpBonus: 15 },
  { id: 'counter-matrix', name: 'Counter Matrix', description: 'Enhanced deflection firmware.', effect: '+10% Parry Counter Damage', parryMultiplierBonus: 0.1 },
  { id: 'ley-suture', name: 'Ley Suture', description: 'Stitches wounds across dimensions.', effect: 'Restore 20 Soul Anchor HP', hpRestore: 20 },
  { id: 'stamina-coil', name: 'Stamina Coil', description: 'Overclocked metabolic capacitor.', effect: 'Restore 30 Stamina', staminaRestore: 30 },
];

export const POST_COMBAT_BOON_POOL: Trinket[] = [
  { id: 'combat-fork', name: 'Tuning Fork', description: 'Parry timing harmonics improved.', effect: '+20% Parry Window', parryWindowBonus: 0.2 },
  { id: 'combat-matrix', name: 'Aegis Matrix', description: 'Counter-strike amplification.', effect: '+10% Parry Counter', parryMultiplierBonus: 0.1 },
  { id: 'combat-coil', name: 'Reservoir Coil', description: 'Abyssal pre-charge on entry.', effect: '+25% Start Abyssal Reserve', startingAbyssalReservePercent: 25 },
  { id: 'combat-plate', name: 'Veil Plate', description: 'Emergency anchor reinforcement.', effect: '+10 Max HP', maxHpBonus: 10 },
  { id: 'combat-edge', name: 'Monomolecular Edge', description: 'Sharper slice vectors.', effect: '-5% Slice Penalty Removed', sliceDamagePenalty: -0.05 },
];

/** Pick sectors with unique display names — never two cards for the same location name. */
export function pickRandomSectors(count: number): SectorDefinition[] {
  const shuffled = [...INITIAL_SECTOR_POOL].sort(() => Math.random() - 0.5);
  const picked: SectorDefinition[] = [];
  const usedNames = new Set<string>();

  for (const sector of shuffled) {
    if (picked.length >= count) break;
    if (usedNames.has(sector.name)) continue;
    usedNames.add(sector.name);
    picked.push(sector);
  }

  return picked;
}

const RADAR_DOT_MIN_DISTANCE_PX = 65;

const ENCOUNTER_TYPE_TAG: Record<EncounterType, string> = {
  COMBAT: 'COMBAT',
  SKILL_CHECK: 'SKILL CHECK',
  REST: 'REST SANCTUARY',
};

const REGION_ENCOUNTER_FLAVOR: Record<RegionTheme, Record<EncounterType, string[]>> = {
  HOSPITAL: {
    COMBAT: ['Intensive Care Anomaly', 'Veil Stalker Manifest', 'ICU Hostile Vector'],
    SKILL_CHECK: ['Encrypted Medical Mainframe', 'Patient Monitor Ghost Signal', 'Pharmacy Vault Lock'],
    REST: ['Abandoned Staff Lounge', 'Chapel Anchor Point', 'Supply Closet Sanctuary'],
  },
  HOUSING: {
    COMBAT: ['Boiler Room Stalker', 'Pipe Crawler Manifest', 'Basement Hostile Vector'],
    SKILL_CHECK: ['Faulty Intercom Matrix', 'Meter Room Signal Drift', 'Laundry Lock Calibration'],
    REST: ['Rooftop Anchor Nook', 'Vacant Unit Sanctuary', 'Boiler Rest Node'],
  },
  FOREST: {
    COMBAT: ['Root Labyrinth Predator', 'Canopy Stalker', 'Breach Point Vector'],
    SKILL_CHECK: ['Ley-Line Interference Grid', 'Moss-Covered Relay', 'Hollow Grove Cipher'],
    REST: ['Fern Hollow Sanctuary', 'Creek Bed Recovery Node', 'Root-Cradle Safe Zone'],
  },
  CITY: {
    COMBAT: ['Subway Tunnel Stalker', 'Alleyway Apparition', 'Transit Vector Hostile'],
    SKILL_CHECK: ['Transit Signal Override', 'Grid Interference Node', 'Platform Lock Sequence'],
    REST: ['Abandoned Platform Rest', 'Service Alley Sanctuary', 'Rooftop Recovery Node'],
  },
};

function pickFlavor(theme: RegionTheme, type: EncounterType): string {
  const pool = REGION_ENCOUNTER_FLAVOR[theme][type];
  return pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
}

function buildPingLabel(index: number, type: EncounterType, theme: RegionTheme): string {
  return `Ping ${index}: [${ENCOUNTER_TYPE_TAG[type]}] ${pickFlavor(theme, type)}`;
}

function generateInitialScanChoicesFromBiomes(unlockedBiomes: BiomeType[], count: number): PathChoice[] {
  const usedIds = new Set<string>();
  const choices: PathChoice[] = [];
  let attempts = 0;
  while (choices.length < count && attempts < 40) {
    attempts += 1;
    const sector = pickSectorFromUnlocked(unlockedBiomes, usedIds);
    if (!sector) continue;
    choices.push({
      id: `init-${sector.id}-${choices.length}`,
      sector,
      encounterType: 'COMBAT',
      label: ENCOUNTER_LABELS.COMBAT[Math.floor(Math.random() * ENCOUNTER_LABELS.COMBAT.length)],
    });
  }
  return choices;
}

function generateInitialScanChoices(clusterId: ClimateClusterId, count: number): PathChoice[] {
  const usedIds = new Set<string>();
  const choices: PathChoice[] = [];
  let attempts = 0;
  while (choices.length < count && attempts < 40) {
    attempts += 1;
    const sector = pickSectorFromCluster(clusterId, usedIds);
    if (!sector) continue;
    choices.push({
      id: `init-${sector.id}-${choices.length}`,
      sector,
      encounterType: 'COMBAT',
      label: ENCOUNTER_LABELS.COMBAT[Math.floor(Math.random() * ENCOUNTER_LABELS.COMBAT.length)],
    });
  }
  return choices;
}

function randomSignalCount(): number {
  return 2 + Math.floor(Math.random() * 4);
}

/** Build 2–5 radar blips with encounter metadata for the master scanner navigator. */
export function generateRadarScanDots(
  climateCluster: ClimateClusterId | null,
  upcomingNodeIndex: number,
  combatNodesCleared: number,
  coreDiameterPx: number,
  unlockedBiomes: BiomeType[] = ['HOSPITAL', 'ALLEYWAYS'],
): RadarScanResult {
  const signalCount = randomSignalCount();
  if (!climateCluster || unlockedBiomes.length === 0) {
    return { dots: [], signalCount: 0 };
  }

  const choices = upcomingNodeIndex === 0 && combatNodesCleared === 0
    ? generateInitialScanChoicesFromBiomes(unlockedBiomes, signalCount)
    : generatePathChoices(climateCluster, upcomingNodeIndex, combatNodesCleared, signalCount, unlockedBiomes);

  const center = coreDiameterPx / 2;
  const maxRadius = center * 0.78;
  const minRadius = center * 0.22;
  const placed: { x: number; y: number }[] = [];
  const dots: RadarDot[] = [];

  for (let i = 0; i < choices.length; i += 1) {
    const choice = choices[i];
    let found = false;

    for (let attempt = 0; attempt < 80 && !found; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = minRadius + Math.random() * (maxRadius - minRadius);
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;

      const overlaps = placed.some(
        (p) => Math.hypot(p.x - x, p.y - y) < RADAR_DOT_MIN_DISTANCE_PX,
      );
      if (overlaps) continue;

      placed.push({ x, y });
      const angleDeg = ((Math.atan2(y - center, x - center) * 180) / Math.PI + 360) % 360;
      dots.push({
        id: choice.id,
        sector: choice.sector,
        encounterType: choice.encounterType,
        label: choice.label,
        pingIndex: i + 1,
        pingLabel: buildPingLabel(i + 1, choice.encounterType, choice.sector.theme),
        x,
        y,
        angleDeg,
        encounterIndex: i,
      });
      found = true;
    }
  }

  return { dots, signalCount };
}

function pickSectorFromCluster(clusterId: ClimateClusterId, usedIds: Set<string>): SectorDefinition | null {
  const shuffled = [...getClusterBiomes(clusterId)].sort(() => Math.random() - 0.5);
  for (const sector of shuffled) {
    if (usedIds.has(sector.id)) continue;
    usedIds.add(sector.id);
    return sector;
  }
  return null;
}

/**
 * Resolve encounter type for an upcoming node (0-based index).
 * Node 1 (index 0) and Node 7 (index 6) are always COMBAT.
 * Ensures at least MIN_COMBAT_NODES (4) combat encounters across the run.
 */
export function pickEncounterTypeForNode(
  upcomingNodeIndex: number,
  combatNodesCleared: number,
  totalNodes: number = TOTAL_RUN_NODES,
): EncounterType {
  const finalNodeIndex = totalNodes - 1;

  if (upcomingNodeIndex === 0 || upcomingNodeIndex === finalNodeIndex) {
    return 'COMBAT';
  }

  const combatsStillRequired = Math.max(0, MIN_COMBAT_NODES - combatNodesCleared);
  const nodesUntilFinal = finalNodeIndex - upcomingNodeIndex;

  if (combatsStillRequired >= nodesUntilFinal) {
    return 'COMBAT';
  }

  if (combatsStillRequired > 0 && Math.random() < 0.55) {
    return 'COMBAT';
  }

  return Math.random() < 0.55 ? 'SKILL_CHECK' : 'REST';
}

export function generatePathChoices(
  clusterId: ClimateClusterId,
  upcomingNodeIndex: number,
  combatNodesCleared: number,
  count: number,
  unlockedBiomes: BiomeType[] = ['HOSPITAL', 'ALLEYWAYS'],
): PathChoice[] {
  const choices: PathChoice[] = [];
  const usedIds = new Set<string>();
  let attempts = 0;

  while (choices.length < count && attempts < 40) {
    attempts += 1;
    const sector = pickSectorFromUnlocked(unlockedBiomes, usedIds)
      ?? pickSectorFromCluster(clusterId, usedIds);
    if (!sector) continue;

    const encounterType = pickEncounterTypeForNode(upcomingNodeIndex, combatNodesCleared);
    const labels = ENCOUNTER_LABELS[encounterType];

    choices.push({
      id: `${sector.id}-${encounterType}-${choices.length}`,
      sector,
      encounterType,
      label: labels[Math.floor(Math.random() * labels.length)],
    });
  }

  return choices;
}

export function buildEncounter(nodeIndex: number, sector: SectorDefinition, type: EncounterType, label: string) {
  return { index: nodeIndex, type, label, sector };
}

export function getThemedSkillChecks(theme: RegionTheme): SkillCheckEvent[] {
  const base: Record<RegionTheme, SkillCheckEvent[]> = {
    HOSPITAL: [
      {
        id: 'h-vault',
        narrative: 'A crash cart drawer slides open on its own — something glints inside the sterile steel.',
        attribute: 'Security',
        modifier: 3,
      },
      {
        id: 'h-mainframe',
        narrative: 'The nurse station terminal still runs. Patient records scroll in languages that predate the building.',
        attribute: 'Interface',
        modifier: 4,
      },
    ],
    HOUSING: [
      {
        id: 'ho-dumpster',
        narrative: 'A dumpster behind the complex hums with trapped ley-energy. Something valuable rattles inside.',
        attribute: 'Athletics',
        modifier: 2,
      },
    ],
    FOREST: [
      {
        id: 'f-shrine',
        narrative: 'A moss-covered shrine pulses at the breach edge. Offerings still smolder.',
        attribute: 'Interface',
        modifier: 3,
      },
    ],
    CITY: [
      {
        id: 'c-hack',
        narrative: 'A municipal relay box sparks — mainframe access might reroute local veil traffic.',
        attribute: 'Interface',
        modifier: 5,
      },
    ],
  };
  return base[theme] ?? base.CITY;
}

export function pickRandomTrinkets(pool: Trinket[], count: number): Trinket[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function pickRandomPostCombatBoons(count: number): Trinket[] {
  return pickRandomTrinkets(POST_COMBAT_BOON_POOL, count);
}
