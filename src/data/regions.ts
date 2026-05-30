import {
  EncounterType,
  MIN_COMBAT_NODES,
  PathChoice,
  RadarDot,
  RegionTheme,
  SectorDefinition,
  SkillCheckEvent,
  TOTAL_RUN_NODES,
  Trinket,
} from '../types/run';

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
  { id: 'ghost-battery', name: 'Ghost Battery', description: 'Stores kinetic bleed from the veil.', effect: 'Start fights with 25% Kinetic', startingKineticPercent: 25 },
  { id: 'anchor-plate', name: 'Anchor Plate', description: 'Reinforced soul plating.', effect: '+15 Max Soul Anchor HP', maxHpBonus: 15 },
  { id: 'counter-matrix', name: 'Counter Matrix', description: 'Enhanced deflection firmware.', effect: '+10% Parry Counter Damage', parryMultiplierBonus: 0.1 },
  { id: 'ley-suture', name: 'Ley Suture', description: 'Stitches wounds across dimensions.', effect: 'Restore 20 Soul Anchor HP', hpRestore: 20 },
  { id: 'stamina-coil', name: 'Stamina Coil', description: 'Overclocked metabolic capacitor.', effect: 'Restore 30 Stamina', staminaRestore: 30 },
];

export const POST_COMBAT_BOON_POOL: Trinket[] = [
  { id: 'combat-fork', name: 'Tuning Fork', description: 'Parry timing harmonics improved.', effect: '+20% Parry Window', parryWindowBonus: 0.2 },
  { id: 'combat-matrix', name: 'Aegis Matrix', description: 'Counter-strike amplification.', effect: '+10% Parry Counter', parryMultiplierBonus: 0.1 },
  { id: 'combat-coil', name: 'Reservoir Coil', description: 'Kinetic pre-charge on entry.', effect: '+25% Start Kinetic', startingKineticPercent: 25 },
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

function generateInitialScanChoices(): PathChoice[] {
  const sectors = pickRandomSectors(3);
  return sectors.map((sector, i) => ({
    id: `init-${sector.id}-${i}`,
    sector,
    encounterType: 'COMBAT' as EncounterType,
    label: ENCOUNTER_LABELS.COMBAT[Math.floor(Math.random() * ENCOUNTER_LABELS.COMBAT.length)],
  }));
}

/** Build 3 radar blips with encounter metadata for the master scanner navigator. */
export function generateRadarScanDots(
  homeRegion: RegionTheme | null,
  upcomingNodeIndex: number,
  combatNodesCleared: number,
  coreDiameterPx: number,
): RadarDot[] {
  const choices = homeRegion === null
    ? generateInitialScanChoices()
    : generatePathChoices(homeRegion, upcomingNodeIndex, combatNodesCleared, 3);

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
      });
      found = true;
    }
  }

  return dots;
}

function pickSectorForTheme(homeTheme: RegionTheme, usedNames: Set<string>): SectorDefinition | null {
  const regional = REGION_ROOMS[homeTheme];
  const city = REGION_ROOMS.CITY;
  const useRegional = Math.random() < 0.8;
  const pool = useRegional
    ? regional
    : [...city, ...REGION_ROOMS.HOUSING, ...REGION_ROOMS.FOREST].filter((s) => s.theme !== homeTheme);

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  for (const sector of shuffled) {
    if (!usedNames.has(sector.name)) return sector;
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
  homeTheme: RegionTheme,
  upcomingNodeIndex: number,
  combatNodesCleared: number,
  count: number = 3,
): PathChoice[] {
  const choices: PathChoice[] = [];
  const usedNames = new Set<string>();
  let attempts = 0;

  while (choices.length < count && attempts < 40) {
    attempts += 1;
    const sector = pickSectorForTheme(homeTheme, usedNames);
    if (!sector) continue;

    usedNames.add(sector.name);
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
        dc: 13,
        successReward: { hp: 15, log: 'Recovered a stabilizer trinket from the cart.' },
        failurePenalty: { hp: 12, ambush: true, log: 'Containment breach — apparition drawn to the alarm.' },
      },
      {
        id: 'h-mainframe',
        narrative: 'The nurse station terminal still runs. Patient records scroll in languages that predate the building.',
        attribute: 'Interface',
        modifier: 4,
        dc: 14,
        successReward: { stamina: 25, log: 'Mainframe handshake successful — stamina rerouted.' },
        failurePenalty: { stamina: 20, log: 'Rift interference corrupts your metabolic sync.' },
      },
    ],
    HOUSING: [
      {
        id: 'ho-dumpster',
        narrative: 'A dumpster behind the complex hums with trapped ley-energy. Something valuable rattles inside.',
        attribute: 'Athletics',
        modifier: 2,
        dc: 12,
        successReward: { stamina: 20, log: 'Salvaged a charged trinket from the refuse.' },
        failurePenalty: { hp: 10, ambush: true, log: 'Something in the trash wakes up hungry.' },
      },
    ],
    FOREST: [
      {
        id: 'f-shrine',
        narrative: 'A moss-covered shrine pulses at the breach edge. Offerings still smolder.',
        attribute: 'Interface',
        modifier: 3,
        dc: 13,
        successReward: { hp: 20, log: 'Shrine blessing restores soul anchor integrity.' },
        failurePenalty: { hp: 15, log: 'The shrine rejects your frequency.' },
      },
    ],
    CITY: [
      {
        id: 'c-hack',
        narrative: 'A municipal relay box sparks — mainframe access might reroute local veil traffic.',
        attribute: 'Interface',
        modifier: 5,
        dc: 15,
        successReward: { hp: 10, stamina: 15, log: 'Relay hacked — resources siphoned from the grid.' },
        failurePenalty: { stamina: 25, ambush: true, log: 'Security daemon manifests as hostile vector.' },
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
