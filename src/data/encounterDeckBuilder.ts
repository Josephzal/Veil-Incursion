import type { EncounterEnemyKey } from './enemyCombatConfig';
import { getEnemyDefinition } from './enemyDefinitions';
import { enemyAllowedAtDepth } from './encounterSpawnGateEngine';
import { squadAllowedAtDepth } from './encounterSpawnGateEngine';
import { isDepth3ExclusiveEnemy } from './enemyDefinitions';
import type {
  EncounterOrigin,
  EncounterRole,
  VeilBiome,
} from '../types/encounterSpawn';
import { ALL_VEIL_BIOMES } from './sectorBiomeBridge';
import { veilBiomeToSynergyBiomes } from './sectorBiomeBridge';
import { BIOME_DEPTH_ENEMY_HINTS } from './encounterBiomePools';
import type { EncounterGridPos, EncounterUnitSpec, SynergySquadSpec } from './synergyEncounterTypes';
import type { EncounterSquadTier } from '../types/encounterSpawn';
import { THREAT_BUDGET_RANGES } from '../types/encounterSpawn';
import {
  ELITE_ONLY_TEMPLATE_KINDS,
  passesHardCounterRules,
} from './encounterHardCounterEngine';
import { squadFitsThreatBudget } from './encounterThreatBudget';

export type EncounterTemplateKind =
  | 'RIVAL_LIGHT'
  | 'RIVAL_DEFENSIVE'
  | 'BIOME_SWARM'
  | 'BIOME_BRUISER'
  | 'BIOME_SUPPORT'
  | 'BIOME_ASSASSIN'
  | 'TWO_SYNERGY'
  | 'THREE_SYNERGY'
  | 'ELITE_SYNERGY'
  | 'ALPHA_THREAT';

export const ENCOUNTER_TEMPLATE_KINDS: readonly EncounterTemplateKind[] = [
  'RIVAL_LIGHT',
  'RIVAL_DEFENSIVE',
  'BIOME_SWARM',
  'BIOME_BRUISER',
  'BIOME_SUPPORT',
  'BIOME_ASSASSIN',
  'TWO_SYNERGY',
  'THREE_SYNERGY',
  'ELITE_SYNERGY',
  'ALPHA_THREAT',
] as const;

interface TemplateDef {
  kind: EncounterTemplateKind;
  origin: EncounterOrigin;
  build: (pool: readonly EncounterEnemyKey[], depth: 1 | 2 | 3, slot: number) => EncounterUnitSpec[];
}

function pick(
  pool: readonly EncounterEnemyKey[],
  slot: number,
  role?: EncounterRole,
  exclude: readonly EncounterEnemyKey[] = ['AMALGAM'],
): EncounterEnemyKey {
  let working = pool.filter((key) => !exclude.includes(key));
  const rolePool = role
    ? working.filter((key) => getEnemyDefinition(key)?.role === role)
    : working;
  const usePool = rolePool.length > 0 ? rolePool : working;
  if (usePool.length === 0) return 'FRACTURE_HOUND';
  return usePool[slot % usePool.length];
}

function sortedLowThreatPool(pool: readonly EncounterEnemyKey[]): EncounterEnemyKey[] {
  return [...pool].sort(
    (a, b) => (getEnemyDefinition(a)?.threatCost ?? 2) - (getEnemyDefinition(b)?.threatCost ?? 2),
  );
}

function validationTierForTemplate(kind: EncounterTemplateKind): EncounterSquadTier {
  return ELITE_ONLY_TEMPLATE_KINDS.has(kind) ? 'ELITE' : 'NORMAL';
}

function pseudoSquad(depth: 1 | 2 | 3, roster: EncounterUnitSpec[]): SynergySquadSpec {
  return {
    id: 'validate',
    allowedDepths: [depth],
    allowedBiomes: ['CITY_STREETS'],
    roster,
  };
}

function rosterPassesSpawnValidation(
  roster: EncounterUnitSpec[],
  depth: 1 | 2 | 3,
  templateKind: EncounterTemplateKind,
): boolean {
  const tier = validationTierForTemplate(templateKind);
  const squad = pseudoSquad(depth, roster);
  const nodeTier = tier === 'ELITE' ? 'ELITE' : 'NORMAL';
  if (!passesHardCounterRules(squad, { depth, tier, nodeTier })) return false;
  const maxBudget = THREAT_BUDGET_RANGES[depth][tier].max;
  return squadFitsThreatBudget(squad, maxBudget, tier);
}

function fallbackRoster(
  pool: readonly EncounterEnemyKey[],
  depth: 1 | 2 | 3,
  templateKind: EncounterTemplateKind,
): EncounterUnitSpec[] {
  const low = sortedLowThreatPool(pool);
  const primary = low[0] ?? 'SCUTTLER';
  const secondary = low[1] ?? primary;
  const candidates: EncounterUnitSpec[][] = [
    [{ type: primary, pos: 'FRONT_LEFT' }, { type: secondary, pos: 'FRONT_RIGHT' }],
    [{ type: primary, pos: 'FRONT_CENTER' }],
  ];
  if (ELITE_ONLY_TEMPLATE_KINDS.has(templateKind) && low.length >= 2) {
    candidates.unshift([
      { type: primary, pos: 'FRONT_LEFT' },
      { type: secondary, pos: 'BACK_RIGHT', isAlpha: true },
    ]);
  }
  for (const roster of candidates) {
    if (rosterPassesSpawnValidation(roster, depth, templateKind)) return roster;
  }
  return [{ type: primary, pos: 'FRONT_CENTER' }];
}

function buildValidatedRoster(
  build: TemplateDef['build'],
  pool: readonly EncounterEnemyKey[],
  depth: 1 | 2 | 3,
  kind: EncounterTemplateKind,
): EncounterUnitSpec[] {
  const lowThreatPool = depth === 1 ? sortedLowThreatPool(pool) : pool;
  for (let slot = 0; slot < 12; slot += 1) {
    const roster = build(lowThreatPool, depth, slot);
    if (rosterPassesSpawnValidation(roster, depth, kind)) return roster;
  }
  for (let slot = 0; slot < 12; slot += 1) {
    const roster = build(pool, depth, slot);
    if (rosterPassesSpawnValidation(roster, depth, kind)) return roster;
  }
  return fallbackRoster(pool, depth, kind);
}

function rivalLight(_pool: readonly EncounterEnemyKey[], depth: 1 | 2 | 3, slot: number): EncounterUnitSpec[] {
  const lead: EncounterEnemyKey = depth >= 3 || slot % 2 === 1 ? 'RIVAL_REAVER' : 'BREACHER';
  const partner: EncounterEnemyKey = slot % 3 === 0 ? 'BURNER' : 'CUTTER';
  return [
    { type: lead, pos: 'FRONT_LEFT' },
    { type: partner, pos: 'FRONT_RIGHT' },
  ];
}

function rivalDefensive(_pool: readonly EncounterEnemyKey[], depth: 1 | 2 | 3, slot: number): EncounterUnitSpec[] {
  if (depth === 1) {
    const backline: EncounterEnemyKey[] = ['FIXER', 'BURNER', 'SPOTTER'];
    return [
      { type: 'WARDEN', pos: 'FRONT_CENTER' },
      { type: backline[slot % backline.length], pos: 'BACK_CENTER' },
    ];
  }
  if (depth === 2) {
    const backline: EncounterEnemyKey[] = ['RIVAL_VEILBINDER', 'RIVAL_HEXER', 'BURNER'];
    return [
      { type: 'WARDEN', pos: 'FRONT_CENTER' },
      { type: backline[slot % backline.length], pos: 'BACK_CENTER' },
    ];
  }
  return [
    { type: 'WARDEN', pos: 'FRONT_LEFT' },
    { type: slot % 2 === 0 ? 'BURNER' : 'SPOTTER', pos: 'BACK_RIGHT' },
  ];
}

function biomeSwarm(pool: readonly EncounterEnemyKey[], _depth: 1 | 2 | 3, slot: number): EncounterUnitSpec[] {
  return [
    { type: pick(pool, slot, 'FRONTLINE'), pos: 'FRONT_LEFT' },
    { type: pick(pool, slot + 1, 'FRONTLINE'), pos: 'FRONT_RIGHT' },
    { type: pick(pool, slot + 2, 'FRONTLINE'), pos: 'BACK_CENTER' },
  ];
}

function biomeBruiser(pool: readonly EncounterEnemyKey[], _depth: 1 | 2 | 3, slot: number): EncounterUnitSpec[] {
  const heavy = pick(pool, slot, 'FRONTLINE');
  return [
    { type: heavy, pos: 'FRONT_CENTER' },
    { type: pick(pool, slot + 1, 'SUPPORT'), pos: 'BACK_RIGHT' },
  ];
}

function biomeSupport(pool: readonly EncounterEnemyKey[], _depth: 1 | 2 | 3, slot: number): EncounterUnitSpec[] {
  return [
    { type: pick(pool, slot, 'FRONTLINE'), pos: 'FRONT_LEFT' },
    { type: pick(pool, slot + 1, 'BACKLINE'), pos: 'BACK_LEFT' },
    { type: pick(pool, slot + 2, 'SUPPORT'), pos: 'BACK_RIGHT' },
  ];
}

function biomeAssassin(pool: readonly EncounterEnemyKey[], _depth: 1 | 2 | 3, slot: number): EncounterUnitSpec[] {
  return [
    { type: pick(pool, slot, 'FRONTLINE'), pos: 'FRONT_LEFT' },
    { type: pick(pool, slot + 1, 'DISRUPTOR'), pos: 'BACK_RIGHT' },
  ];
}

function twoSynergy(pool: readonly EncounterEnemyKey[], _depth: 1 | 2 | 3, slot: number): EncounterUnitSpec[] {
  return [
    { type: pick(pool, slot, 'FRONTLINE'), pos: 'FRONT_LEFT' },
    { type: pick(pool, slot + 2, 'BACKLINE'), pos: 'BACK_RIGHT' },
  ];
}

function threeSynergy(pool: readonly EncounterEnemyKey[], _depth: 1 | 2 | 3, slot: number): EncounterUnitSpec[] {
  return [
    { type: pick(pool, slot, 'FRONTLINE'), pos: 'FRONT_LEFT' },
    { type: pick(pool, slot + 1, 'FRONTLINE'), pos: 'FRONT_RIGHT' },
    { type: pick(pool, slot + 3, 'BACKLINE'), pos: 'BACK_CENTER' },
  ];
}

function eliteSynergy(pool: readonly EncounterEnemyKey[], depth: 1 | 2 | 3, slot: number): EncounterUnitSpec[] {
  const roster: EncounterUnitSpec[] = [
    { type: pick(pool, slot, 'FRONTLINE'), pos: 'FRONT_LEFT' },
    { type: pick(pool, slot + 1, 'FRONTLINE'), pos: 'FRONT_RIGHT' },
    { type: pick(pool, slot + 2, 'BACKLINE'), pos: 'BACK_LEFT' },
    { type: pick(pool, slot + 3, 'DISRUPTOR'), pos: 'BACK_RIGHT' },
  ];
  if (depth >= 2 && slot % 2 === 1) {
    roster[0] = { ...roster[0], isAlpha: true };
  }
  return roster;
}

function alphaThreat(pool: readonly EncounterEnemyKey[], depth: 1 | 2 | 3, slot: number): EncounterUnitSpec[] {
  const alphaKey = pick(pool, slot + depth, 'FRONTLINE');
  if (alphaKey === 'AMALGAM') {
    return [
      { type: 'AMALGAM', pos: 'FRONT_CENTER', isAlpha: true },
      { type: pick(pool, slot + 1, 'BACKLINE'), pos: 'BACK_RIGHT' },
    ];
  }
  return [
    { type: alphaKey, pos: 'FRONT_CENTER', isAlpha: true },
    { type: pick(pool, slot + 2, 'SUPPORT'), pos: 'BACK_LEFT' },
    { type: pick(pool, slot + 3, 'BACKLINE'), pos: 'BACK_RIGHT' },
  ];
}

const TEMPLATE_DEFS: TemplateDef[] = [
  { kind: 'RIVAL_LIGHT', origin: 'RIVAL_MERC', build: rivalLight },
  { kind: 'RIVAL_DEFENSIVE', origin: 'RIVAL_MERC', build: rivalDefensive },
  { kind: 'BIOME_SWARM', origin: 'VEIL', build: biomeSwarm },
  { kind: 'BIOME_BRUISER', origin: 'VEIL', build: biomeBruiser },
  { kind: 'BIOME_SUPPORT', origin: 'VEIL', build: biomeSupport },
  { kind: 'BIOME_ASSASSIN', origin: 'VEIL', build: biomeAssassin },
  { kind: 'TWO_SYNERGY', origin: 'VEIL', build: twoSynergy },
  { kind: 'THREE_SYNERGY', origin: 'VEIL', build: threeSynergy },
  { kind: 'ELITE_SYNERGY', origin: 'VEIL', build: eliteSynergy },
  { kind: 'ALPHA_THREAT', origin: 'VEIL', build: alphaThreat },
];

function normalizeAmalgamRoster(roster: EncounterUnitSpec[]): EncounterUnitSpec[] {
  const hasAmalgam = roster.some((u) => u.type === 'AMALGAM');
  if (!hasAmalgam) return roster;
  const alpha = roster.find((u) => u.isAlpha)?.isAlpha;
  return [
    { type: 'AMALGAM', pos: 'FRONT_CENTER', isAlpha: alpha },
    ...roster.filter((u) => u.type !== 'AMALGAM'),
  ];
}

function veilPoolFor(biome: VeilBiome, depth: 1 | 2 | 3): EncounterEnemyKey[] {
  const hints = BIOME_DEPTH_ENEMY_HINTS[biome][depth];
  const seen = new Set<EncounterEnemyKey>();
  const pool: EncounterEnemyKey[] = [];
  for (const key of hints) {
    const def = getEnemyDefinition(key);
    if (!def || def.origin !== 'VEIL') continue;
    if (!def.biomeTags.includes(biome)) continue;
    if (!enemyAllowedAtDepth(key, depth)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push(key);
  }
  return pool;
}

function squadId(biome: VeilBiome, depth: 1 | 2 | 3, kind: EncounterTemplateKind): string {
  return `${biome}_D${depth}_${kind}`;
}

function toSynergySpec(
  id: string,
  depth: 1 | 2 | 3,
  biome: VeilBiome | undefined,
  roster: EncounterUnitSpec[],
  origin: EncounterOrigin,
  templateKind: EncounterTemplateKind,
): SynergySquadSpec {
  const normalized = normalizeAmalgamRoster(roster);
  return {
    id,
    allowedDepths: [depth],
    allowedBiomes: biome ? [...veilBiomeToSynergyBiomes(biome)] : ['CITY_STREETS', 'CITY_BUILDINGS', 'BACKROADS', 'BLACK_SITE_SECTOR', 'UNDERGROUND', 'FORESTS', 'DEEP_VEIL', 'FRACTAL_ABYSS', 'SANGUINE_ATRIUM'],
    veilBiome: biome,
    roster: normalized,
    encounterSquadOrigin: origin,
    templateKind,
  };
}

/** Curated rival merc squads from design spec (any biome). */
function buildCuratedRivalSquads(): SynergySquadSpec[] {
  const anyBiome = undefined;
  return [
    toSynergySpec('D1_RIVAL_KNIFE_TEAM', 1, anyBiome, [
      { type: 'RIVAL_REAVER', pos: 'FRONT_LEFT' },
      { type: 'CUTTER', pos: 'FRONT_RIGHT' },
    ], 'RIVAL_MERC', 'RIVAL_LIGHT'),
    toSynergySpec('D1_RIVAL_HEX_ESCORT', 1, anyBiome, [
      { type: 'WARDEN', pos: 'FRONT_CENTER' },
      { type: 'RIVAL_HEXER', pos: 'BACK_RIGHT', isAlpha: true },
    ], 'RIVAL_MERC', 'ELITE_SYNERGY'),
    toSynergySpec('D2_RIVAL_RITUAL_SWEEP', 2, anyBiome, [
      { type: 'RIVAL_REAVER', pos: 'FRONT_LEFT' },
      { type: 'RIVAL_HEXER', pos: 'BACK_RIGHT' },
    ], 'RIVAL_MERC', 'TWO_SYNERGY'),
    toSynergySpec('D2_RIVAL_WARD_TEAM', 2, anyBiome, [
      { type: 'WARDEN', pos: 'FRONT_CENTER' },
      { type: 'RIVAL_VEILBINDER', pos: 'BACK_CENTER' },
    ], 'RIVAL_MERC', 'RIVAL_DEFENSIVE'),
    toSynergySpec('D2_RIVAL_OCCULT_BREACH_CREW', 2, anyBiome, [
      { type: 'BREACHER', pos: 'FRONT_LEFT' },
      { type: 'RIVAL_REAVER', pos: 'FRONT_RIGHT' },
      { type: 'RIVAL_HEXER', pos: 'BACK_LEFT' },
      { type: 'RIVAL_VEILBINDER', pos: 'BACK_RIGHT' },
    ], 'RIVAL_MERC', 'ELITE_SYNERGY'),
    toSynergySpec('D2_RIVAL_PAINTED_BLADE', 2, anyBiome, [
      { type: 'RIVAL_REAVER', pos: 'FRONT_CENTER', isAlpha: true },
      { type: 'SPOTTER', pos: 'BACK_LEFT' },
      { type: 'RIVAL_HEXER', pos: 'BACK_RIGHT' },
    ], 'RIVAL_MERC', 'ELITE_SYNERGY'),
    toSynergySpec('D3_RIVAL_LAST_CONTRACT', 3, anyBiome, [
      { type: 'RIVAL_REAVER', pos: 'FRONT_LEFT', isAlpha: true },
      { type: 'RIVAL_VEILBINDER', pos: 'BACK_LEFT' },
      { type: 'RIVAL_HEXER', pos: 'BACK_RIGHT' },
    ], 'RIVAL_MERC', 'ALPHA_THREAT'),
  ];
}

export function buildTemplateEncounterDeck(): SynergySquadSpec[] {
  const squads: SynergySquadSpec[] = [];

  for (const biome of ALL_VEIL_BIOMES) {
    for (const depth of [1, 2, 3] as const) {
      const pool = veilPoolFor(biome, depth);
      if (pool.length === 0) {
        throw new Error(`buildTemplateEncounterDeck: empty pool for ${biome} D${depth}`);
      }

      for (let t = 0; t < TEMPLATE_DEFS.length; t += 1) {
        const template = TEMPLATE_DEFS[t];
        const roster = buildValidatedRoster(template.build, pool, depth, template.kind);
        const unitKeys = roster.map((u) => u.type);
        if (!squadAllowedAtDepth(unitKeys, depth)) continue;

        squads.push(toSynergySpec(
          squadId(biome, depth, template.kind),
          depth,
          biome,
          roster,
          template.origin,
          template.kind,
        ));
      }
    }
  }

  return squads;
}

export function buildEncounterDeck(): readonly SynergySquadSpec[] {
  return [...buildTemplateEncounterDeck(), ...buildCuratedRivalSquads()];
}

export function verifyEncounterDecks(): void {
  const deck = buildEncounterDeck();
  const ids = new Set<string>();

  for (const squad of deck) {
    if (ids.has(squad.id)) {
      throw new Error(`verifyEncounterDecks: duplicate id ${squad.id}`);
    }
    ids.add(squad.id);

    if (squad.roster.length === 0) {
      throw new Error(`verifyEncounterDecks: empty roster ${squad.id}`);
    }

    for (const depth of squad.allowedDepths) {
      const unitKeys = squad.roster.map((u) => u.type);
      if (!squadAllowedAtDepth(unitKeys, depth)) {
        throw new Error(`verifyEncounterDecks: depth gate violation ${squad.id} at D${depth}`);
      }
      if (depth < 3) {
        for (const key of unitKeys) {
          if (isDepth3ExclusiveEnemy(key)) {
            throw new Error(`verifyEncounterDecks: D3 exclusive ${key} in ${squad.id} at D${depth}`);
          }
        }
      }
    }

    const hasAmalgam = squad.roster.some((u) => u.type === 'AMALGAM');
    if (hasAmalgam) {
      const frontOthers = squad.roster.filter(
        (u) => u.type !== 'AMALGAM'
          && (u.pos === 'FRONT_LEFT' || u.pos === 'FRONT_RIGHT' || u.pos === 'FRONT_CENTER'),
      );
      if (frontOthers.length > 0) {
        throw new Error(`verifyEncounterDecks: invalid AMALGAM front overlap ${squad.id}`);
      }
    }
  }

  for (const biome of ALL_VEIL_BIOMES) {
    for (const depth of [1, 2, 3] as const) {
      for (const kind of ENCOUNTER_TEMPLATE_KINDS) {
        const id = squadId(biome, depth, kind);
        if (!ids.has(id)) {
          throw new Error(`verifyEncounterDecks: missing template squad ${id}`);
        }
      }
      const biomeSquads = deck.filter((s) => s.veilBiome === biome && s.allowedDepths.includes(depth));
      const rivalSquads = biomeSquads.filter((s) => s.encounterSquadOrigin === 'RIVAL_MERC');
      const veilSquads = biomeSquads.filter((s) => s.encounterSquadOrigin === 'VEIL');
      if (rivalSquads.length < 2) {
        throw new Error(`verifyEncounterDecks: insufficient rival squads ${biome} D${depth}`);
      }
      if (veilSquads.length < 6) {
        throw new Error(`verifyEncounterDecks: insufficient veil squads ${biome} D${depth}`);
      }
    }
  }

  const curatedIds = [
    'D1_RIVAL_KNIFE_TEAM',
    'D1_RIVAL_HEX_ESCORT',
    'D2_RIVAL_RITUAL_SWEEP',
    'D2_RIVAL_WARD_TEAM',
    'D2_RIVAL_OCCULT_BREACH_CREW',
    'D2_RIVAL_PAINTED_BLADE',
    'D3_RIVAL_LAST_CONTRACT',
  ];
  for (const id of curatedIds) {
    if (!ids.has(id)) {
      throw new Error(`verifyEncounterDecks: missing curated squad ${id}`);
    }
  }
}

const ELITE_SOLO_ALPHA: Record<VeilBiome, Partial<Record<1 | 2 | 3, readonly EncounterEnemyKey[]>>> = {
  ABYSSAL_SINK: {
    1: ['FRACTURE_HOUND', 'THRALL'],
    2: ['HOOK_WEAVER', 'LEY_SIREN'],
    3: ['NULL_SHADE', 'HOLLOW_LUNG'],
  },
  NULL_ZONE: {
    1: ['ECHOING_BRUTE', 'CONCRETE_GARGOYLE'],
    2: ['GUTTER_GOLIATH', 'WIRE_GHOUL'],
    3: ['AMALGAM', 'MEMORY_LEECH'],
  },
  ASHEN_WASTE: {
    1: ['SLAG_BLOOD', 'FRACTURE_HOUND'],
    2: ['GUTTER_GOLIATH', 'TAR_SPITTER'],
    3: ['COIL_SPIKE_SNIPER', 'RESONANCE_CASTER'],
  },
  SLAG_WORKS: {
    1: ['ECHOING_BRUTE', 'TAR_SPITTER'],
    2: ['GOLEM', 'WIRE_GHOUL'],
    3: ['IRON_MAIDEN', 'CHURN'],
  },
  BLACKLINE_TERMINUS: {
    1: ['SPLINTER', 'SCUTTLER'],
    2: ['SPATIAL_GLITCH', 'WIRE_GHOUL', 'SAPPER'],
    3: ['NULL_SHADE', 'SPATIAL_GLITCH', 'MEMORY_LEECH'],
  },
};

function eliteId(biome: VeilBiome, depth: 1 | 2 | 3, key: EncounterEnemyKey): string {
  return `ELITE_${biome}_D${depth}_${key}`;
}

/** Biome-scoped elite squads for alpha duels and elite combat nodes. */
export function buildEliteDeck(): readonly SynergySquadSpec[] {
  const squads: SynergySquadSpec[] = [
    toSynergySpec('ELITE_WARDEN', 1, undefined, [
      { type: 'WARDEN', pos: 'FRONT_CENTER', isAlpha: true },
    ], 'RIVAL_MERC', 'ALPHA_THREAT'),
    toSynergySpec('ELITE_BREACHER', 1, undefined, [
      { type: 'BREACHER', pos: 'FRONT_CENTER', isAlpha: true },
    ], 'RIVAL_MERC', 'ALPHA_THREAT'),
    toSynergySpec('ELITE_FIXER_NODE', 1, undefined, [
      { type: 'WARDEN', pos: 'FRONT_CENTER' },
      { type: 'FIXER', pos: 'BACK_CENTER', isAlpha: true },
    ], 'RIVAL_MERC', 'ELITE_SYNERGY'),
    toSynergySpec('ELITE_COIL_SNIPER', 3, undefined, [
      { type: 'WARDEN', pos: 'FRONT_LEFT' },
      { type: 'WARDEN', pos: 'FRONT_RIGHT' },
      { type: 'COIL_SPIKE_SNIPER', pos: 'BACK_CENTER', isAlpha: true },
    ], 'RIVAL_MERC', 'ELITE_SYNERGY'),
  ];

  for (const biome of ALL_VEIL_BIOMES) {
    for (const depth of [1, 2, 3] as const) {
      const picks = ELITE_SOLO_ALPHA[biome][depth] ?? [];
      for (const key of picks) {
        if (!enemyAllowedAtDepth(key, depth)) continue;
        const def = getEnemyDefinition(key);
        if (!def || def.origin !== 'VEIL' || !def.biomeTags.includes(biome)) continue;
        squads.push(toSynergySpec(
          eliteId(biome, depth, key),
          depth,
          biome,
          buildValidatedRoster(
            (_p, d, slot) => [{ type: key, pos: 'FRONT_CENTER', isAlpha: true }],
            [key],
            depth,
            'ALPHA_THREAT',
          ),
          'VEIL',
          'ALPHA_THREAT',
        ));
      }

      const pool = veilPoolFor(biome, depth);
      if (pool.length >= 2) {
        const commander = pick(pool, depth, 'FRONTLINE');
        const backline = pick(pool, depth + 2, 'BACKLINE');
        const commandRoster = buildValidatedRoster(
          (_p, _d, slot) => [
            { type: commander, pos: 'FRONT_CENTER' },
            { type: pick(pool, slot + 3, 'BACKLINE'), pos: 'BACK_CENTER', isAlpha: true },
          ],
          pool,
          depth,
          'ELITE_SYNERGY',
        );
        squads.push(toSynergySpec(
          `ELITE_${biome}_D${depth}_COMMAND`,
          depth,
          biome,
          commandRoster,
          'VEIL',
          'ELITE_SYNERGY',
        ));
      }
    }
  }

  return squads;
}

export function verifyEliteDecks(): void {
  const deck = buildEliteDeck();
  const ids = new Set<string>();
  for (const squad of deck) {
    if (ids.has(squad.id)) throw new Error(`verifyEliteDecks: duplicate ${squad.id}`);
    ids.add(squad.id);
    for (const depth of squad.allowedDepths) {
      const unitKeys = squad.roster.map((u) => u.type);
      if (!squadAllowedAtDepth(unitKeys, depth)) {
        throw new Error(`verifyEliteDecks: depth gate ${squad.id}`);
      }
      if (depth < 3) {
        for (const key of unitKeys) {
          if (isDepth3ExclusiveEnemy(key)) {
            throw new Error(`verifyEliteDecks: D3 exclusive ${key} in ${squad.id}`);
          }
        }
      }
    }
  }

  for (const biome of ALL_VEIL_BIOMES) {
    for (const depth of [1, 2, 3] as const) {
      const biomeElites = deck.filter(
        (s) => (s.veilBiome === biome || s.veilBiome == null) && s.allowedDepths.includes(depth),
      );
      const alphaDuels = biomeElites.filter((s) => s.roster.every((u) => u.isAlpha));
      if (alphaDuels.length === 0) {
        throw new Error(`verifyEliteDecks: no alpha duel for ${biome} D${depth}`);
      }
      if (biomeElites.length < 2) {
        throw new Error(`verifyEliteDecks: insufficient elites for ${biome} D${depth}`);
      }
    }
  }
}
