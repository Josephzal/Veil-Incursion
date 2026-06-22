import type {
  Biome,
  ComplicationSeed,
  ContextSeed,
  NarrativePenalty,
  NarrativeReward,
  Tag,
} from '../../types/narrativeAssembly';

export type ResolverRequirementType = 'CABAL' | 'ITEM' | 'CLASS';

export interface ExpansionResolverTemplate {
  id: string;
  requires: { type: ResolverRequirementType; value: string };
  text: string;
  cost?: { type: string; amount?: number; value?: string };
  reward: string;
}

function ctx(
  id: string,
  flavorText: string,
  tags: Tag[],
  biomes: Biome[],
): ContextSeed {
  return { id, flavorText, tags, biomes };
}

function cmp(
  id: string,
  requiredTag: Tag,
  flavorText: string,
  defaultPenalty: { type: string; amount: number },
  defaultReward: { type: string; amount: number },
): ComplicationSeed {
  return {
    id,
    requiredTags: [requiredTag],
    flavorText,
    defaultPenalty: mapExpansionPenalty(defaultPenalty),
    defaultReward: defaultReward as NarrativeReward,
  };
}

function mapExpansionPenalty(penalty: { type: string; amount: number }): NarrativePenalty {
  if (penalty.type === 'STAMINA_DRAIN') {
    return { type: 'Resonance', amount: Math.max(5, Math.round(penalty.amount / 5)) };
  }
  return { type: 'HP', amount: penalty.amount };
}

function res(
  id: string,
  type: ResolverRequirementType,
  value: string,
  text: string,
  cost?: ExpansionResolverTemplate['cost'],
): ExpansionResolverTemplate {
  return { id, requires: { type, value }, text, cost, reward: 'DEFAULT_COMPLICATION_REWARD' };
}

/** DnD-style expansion contexts (sections 2.1, 2.4, 2.5, 2.6). */
export const EXPANSION_CONTEXT_SEEDS: readonly ContextSeed[] = [
  ctx('CTX_SUNKEN_CORE', 'You breach a flooded Sunken Transit maintenance shaft.', ['flooded', 'industrial'], ['sunken_transit', 'underground']),
  ctx('CTX_BLACK_SITE_VAULT', 'You crack the blast doors of an abandoned Black-Site armory.', ['militarized', 'tech'], ['black_site_sector', 'city_buildings']),
  ctx('CTX_ATRIUM_HEART', 'You step into a pulsating, bone-calcified chamber in the Sanguine Atrium.', ['organic', 'occult'], ['sanguine_atrium']),
  ctx('CTX_DROWNED_TRAIN', 'You pry open the rusted doors of a derailed transit car, half-submerged in black, oily water.', ['flooded', 'industrial'], ['sunken_transit', 'underground']),
  ctx('CTX_AUTO_MORGUE', 'You enter a pristine, automated cryo-morgue. Rows of frosted stasis pods hum with failing backup power.', ['militarized', 'tech'], ['black_site_sector', 'city_buildings']),
  ctx('CTX_SHATTERED_OBSERVATORY', 'You drift onto a suspended shard of marble that once belonged to a grand observatory, now floating aimlessly in the void.', ['void', 'cosmic'], ['fractal_abyss', 'deep_veil']),
  ctx('CTX_BARRICADED_CHECKPOINT', 'You approach a heavily fortified, abandoned military checkpoint choking the main city thoroughfare.', ['city', 'militarized'], ['city_streets', 'backroads']),
  ctx('CTX_PETRIFIED_GROVE', 'You enter a silent grove where the trees have calcified into jagged, black glass structures.', ['forest', 'organic'], ['forests']),
  ctx('CTX_RUINED_PENTHOUSE', 'You scale the remains of a corporate penthouse. The shattered glass walls overlook the ruined skyline.', ['tech', 'city'], ['city_buildings', 'city_streets']),
  ctx('CTX_PULSATING_VALVE', 'You slide down into a fleshy, cavernous chamber in the Atrium where massive, veined valves rhythmically pump dark fluid.', ['organic', 'occult'], ['sanguine_atrium']),
  ctx('CTX_COLLAPSED_TUNNEL', 'You crawl through a crushed subway tunnel. Exposed high-voltage cables dangle perilously close to the damp floor.', ['flooded', 'industrial'], ['sunken_transit', 'underground']),
  ctx('CTX_INVERTED_CATHEDRAL', 'You land on the ceiling of a massive, gothic cathedral that is floating completely upside-down in the abyss.', ['void', 'cosmic'], ['fractal_abyss', 'deep_veil']),
  ctx('CTX_SUBMERGED_PUMP_ROOM', 'You wade into a rusted transit pump station. The water is thick with bioluminescent grime, and a sealed loot cache sits on a raised central platform.', ['flooded', 'industrial'], ['sunken_transit']),
  ctx('CTX_SHATTERED_CONTAINMENT', 'You step through the torn blast doors of a Black-Site containment cell. The reinforced glass is spider-webbed, and emergency strobes flash wildly.', ['militarized', 'tech'], ['black_site_sector']),
  ctx('CTX_LIVING_BRIDGE', 'You must cross a bridge woven entirely from pulsating muscle tissue and fused bone, suspended over a gorge of boiling blood.', ['organic', 'occult'], ['sanguine_atrium']),
  ctx('CTX_FRACTURED_HALLWAY', 'You enter a corridor where reality has shattered like a mirror. Dozens of floating glass shards reflect parallel timelines and impossible geometry.', ['void', 'cosmic'], ['fractal_abyss']),
  ctx('CTX_DROWNED_ARMORY', 'You locate a high-security military armory that has collapsed into the flooded transit lines. Weapons lockers are barely visible beneath the murky surface.', ['militarized', 'flooded'], ['sunken_transit', 'black_site_sector']),
  ctx('CTX_INFINITE_STAIRWELL', 'You stand before a cosmic staircase made of floating obsidian slabs. It spirals upward into a suffocating, starless void.', ['void', 'cosmic'], ['deep_veil', 'fractal_abyss']),
];

/** DnD-style expansion complications (sections 2.2, 2.4, 2.5, 2.6). */
export const EXPANSION_COMPLICATION_SEEDS: readonly ComplicationSeed[] = [
  cmp('COMP_PLASMA_FLARE', 'industrial', 'The atmospheric valves have ruptured, filling the sector with volatile plasma flares.', { type: 'HP_LOSS', amount: 20 }, { type: 'RESOURCES', amount: 50 }),
  cmp('COMP_FIREWALL', 'tech', 'The primary terminal is locked behind a lethal, feedback-loop firewall.', { type: 'STAMINA_DRAIN', amount: 100 }, { type: 'INTEL', amount: 1 }),
  cmp('COMP_BOILING_BLOOD', 'organic', 'The arterial floor gives way, exposing a river of boiling occult blood.', { type: 'HP_LOSS', amount: 30 }, { type: 'VEIL_RESIDUE', amount: 25 }),
  cmp('COMP_TOXIC_VAPOR', 'flooded', 'The stagnant water reacts with the oxygen, releasing a suffocating cloud of toxic vapor that obscures a locked supply crate.', { type: 'HP_LOSS', amount: 15 }, { type: 'CREDITS', amount: 100 }),
  cmp('COMP_ROGUE_AI_PURGE', 'tech', 'The sector defense AI detects your breach and initiates a room-wide purge sequence, rapidly dropping the temperature to absolute zero.', { type: 'HP_LOSS', amount: 25 }, { type: 'ENCRYPTED_GRID_DRIVE', amount: 1 }),
  cmp('COMP_GRAVITY_SHEAR', 'void', 'A localized gravity shear is tearing the platform apart, pulling a cluster of raw Anomalous Cores directly into the abyss.', { type: 'STAMINA_DRAIN', amount: 100 }, { type: 'ANOMALOUS_CORE', amount: 2 }),
  cmp('COMP_FERAL_HOUNDS', 'city', 'A pack of starving, Veil-corrupted hounds is actively tearing into a sealed corporate supply drop.', { type: 'HP_LOSS', amount: 15 }, { type: 'CREDITS', amount: 150 }),
  cmp('COMP_SPORE_CLOUD', 'organic', 'The environment begins releasing dense, hallucinogenic spores that violently attack the Operative\'s central nervous system.', { type: 'STAMINA_DRAIN', amount: 80 }, { type: 'VEIL_RESIDUE', amount: 20 }),
  cmp('COMP_LEAKING_MECH', 'militarized', 'A downed automated Siege-Mech is leaking heavy radiation, but its primary logic drive is still intact and pulsing.', { type: 'HP_LOSS', amount: 25 }, { type: 'ENCRYPTED_GRID_DRIVE', amount: 1 }),
  cmp('COMP_BLOOD_RITUAL', 'occult', 'A dormant summoning circle violently activates, locking down the exit. It demands an immediate offering of vital essence to dispel.', { type: 'HP_LOSS', amount: 30 }, { type: 'LEY_SLAG', amount: 40 }),
  cmp('COMP_LIVE_WIRES', 'industrial', 'The area is a deadly grid of sparking, live electrical wires thrashing wildly across the only safe pathway.', { type: 'HP_LOSS', amount: 20 }, { type: 'LEY_SLAG', amount: 30 }),
  cmp('COMP_TIME_PARADOX', 'void', 'A fractured time-loop is rapidly accelerating entropy in the chamber, threatening to exhaust you completely before you can grab the floating cache.', { type: 'STAMINA_DRAIN', amount: 100 }, { type: 'ANOMALOUS_CORE', amount: 1 }),
  cmp('COMP_RISING_TIDE', 'flooded', 'The structural integrity of the sector fails, causing a rapid influx of toxic water. You must act before the room entirely drowns.', { type: 'HP_LOSS', amount: 30 }, { type: 'CREDITS', amount: 150 }),
  cmp('COMP_LASER_GRID', 'tech', 'A corrupted, high-intensity defense laser grid is sweeping the room in erratic, unpredictable patterns.', { type: 'STAMINA_DRAIN', amount: 80 }, { type: 'ENCRYPTED_GRID_DRIVE', amount: 1 }),
  cmp('COMP_PARASITIC_SWARM', 'organic', 'A swarm of fleshy, Veil-born parasites drops from the ceiling, attempting to latch onto your armor and drain your vitals.', { type: 'HP_LOSS', amount: 25 }, { type: 'LEY_SLAG', amount: 40 }),
  cmp('COMP_NON_EUCLIDEAN_SHIFT', 'cosmic', 'The geometry of the room violently folds in on itself, causing extreme vertigo and psychic strain to navigate.', { type: 'STAMINA_DRAIN', amount: 100 }, { type: 'ANOMALOUS_CORE', amount: 1 }),
  cmp('COMP_UXO_MINEFIELD', 'militarized', 'The floor is littered with unexploded ordnance rigged with decaying, Veil-corrupted tripwires.', { type: 'HP_LOSS', amount: 35 }, { type: 'CREDITS', amount: 200 }),
  cmp('COMP_GHOSTLY_POSSESSION', 'occult', 'A whispering specter of a dead Operative is trapped here, attempting to possess your mind out of sheer interdimensional terror.', { type: 'HP_LOSS', amount: 20 }, { type: 'VEIL_RESIDUE', amount: 30 }),
];

/** DnD-style resolver templates — dynamically rolled into options B/C. */
export const EXPANSION_RESOLVER_TEMPLATES: readonly ExpansionResolverTemplate[] = [
  res('RES_SOLARIS_CABAL', 'CABAL', 'SOLARIS', 'Execute Thermal Override. (Siphons the heat to charge your shields).'),
  res('RES_HAZMAT_ITEM', 'ITEM', 'HAZMAT_SHIELDING', 'Deploy protective matrix. (Consumes 1 Hazmat Shielding from Cargo).', { type: 'CONSUME_ITEM', value: 'HAZMAT_SHIELDING' }),
  res('RES_OCCULT_SIGIL', 'CABAL', 'VOID_WEAVERS', 'Siphon the blood river. (Heal 20 HP and cross safely).'),
  res('RES_FILTER_MASK', 'ITEM', 'FILTER_MASK', 'Equip rebreather and wade in. (Consumes 1 Filter Mask from Cargo).', { type: 'CONSUME_ITEM', value: 'FILTER_MASK' }),
  res('RES_TERRAN_GRID_CLEARANCE', 'CABAL', 'TERRAN_GRID', 'Transmit overriding military clearance codes. (Commands the AI to stand down).'),
  res('RES_VOID_WEAVERS_ANCHOR', 'CABAL', 'VOID_WEAVERS', 'Anchor the platform with a spatial tether. (Bypass the gravity shear safely).'),
  res('RES_EMP_GRENADE', 'ITEM', 'EMP_GRENADE', 'Detonate an EMP. (Instantly disables mechs, traps, and electronics. Consumes 1 EMP Grenade).', { type: 'CONSUME_ITEM', value: 'EMP_GRENADE' }),
  res('RES_SANGUINE_AMPOULE', 'ITEM', 'SANGUINE_AMPOULE', 'Offer extracted blood. (Satisfies occult ritual requirements safely. Consumes 1 Sanguine Ampoule).', { type: 'CONSUME_ITEM', value: 'SANGUINE_AMPOULE' }),
  res('RES_BREACHING_CHARGE', 'ITEM', 'BREACHING_CHARGE', 'Blow a new path. (Bypasses the hazard entirely by destroying the surrounding geometry. Consumes 1 Breaching Charge).', { type: 'CONSUME_ITEM', value: 'BREACHING_CHARGE' }),
  res('RES_SYNDICATE_CABAL', 'CABAL', 'THE_SYNDICATE', 'Utilize Black-Market overrides. (Bypasses city and corporate security measures perfectly).'),
  res('RES_AEGIS_VANGUARD', 'CABAL', 'AEGIS_VANGUARD', 'Intimidate and overpower. (Use brute force and Vanguard presence to scatter hounds or smash obstacles).'),
  res('RES_VOID_ANCHOR', 'ITEM', 'VOID_ANCHOR', 'Deploy a Void Anchor. (Stabilizes temporal and cosmic distortions. Consumes 1 Void Anchor).', { type: 'CONSUME_ITEM', value: 'VOID_ANCHOR' }),
  res('RES_CLASS_HEX_SHOT', 'CLASS', 'HEX_SHOT', 'Execute precision ballistics. (Shoot the control panel or tripwires from a perfectly safe distance).'),
  res('RES_CLASS_ENVOY', 'CLASS', 'ENVOY', 'Channel the Anomaly. (Use raw Veil-Flux to banish the specter or stabilize the cosmic geometry).', { type: 'FLUX_INCREASE', amount: 30 }),
  res('RES_GRAPPLE_LINE', 'ITEM', 'GRAPPLE_LINE', 'Deploy Grapple Line. (Swing safely over the hazard or rising water. Consumes 1 Grapple Line).', { type: 'CONSUME_ITEM', value: 'GRAPPLE_LINE' }),
  res('RES_PURITY_SEAL', 'ITEM', 'PURITY_SEAL', 'Burn a Purity Seal. (Repels occult parasites and supernatural entities instantly. Consumes 1 Purity Seal).', { type: 'CONSUME_ITEM', value: 'PURITY_SEAL' }),
  res('RES_VOID_WEAVERS_COMMUNION', 'CABAL', 'VOID_WEAVERS', 'Commune with the Abyss. (Your Cabal training allows you to navigate the shifting void geometry flawlessly).'),
  res('RES_DEFUSAL_KIT', 'ITEM', 'DEFUSAL_KIT', 'Utilize Defusal Kit. (Carefully disarm the military ordnance or defense grid. Consumes 1 Defusal Kit).', { type: 'CONSUME_ITEM', value: 'DEFUSAL_KIT' }),
];

const resolverTemplateById = new Map(
  EXPANSION_RESOLVER_TEMPLATES.map((template) => [template.id, template]),
);

export function getExpansionResolverTemplateById(id: string): ExpansionResolverTemplate | undefined {
  return resolverTemplateById.get(id);
}
