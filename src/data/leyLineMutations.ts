import type { LeyLineMutationDefinition, LeyLineMutationId } from '../types/leyLineMutation';

export const LEY_LINE_MUTATION_CATALOG: Record<LeyLineMutationId, LeyLineMutationDefinition> = {
  SHARPENED: {
    id: 'SHARPENED',
    name: 'Sharpened',
    tier: 'KINETIC',
    description: 'Strike pierces 1 layer of Kinetic Armor automatically.',
    effect: 'STRIKE // −1 enemy kinetic armor per hit',
  },
  VENOMOUS_RUIN: {
    id: 'VENOMOUS_RUIN',
    name: 'Venomous Ruin',
    tier: 'KINETIC',
    description: 'Ruin leaves a lingering hazard that deals 10 Fracture per hostile turn.',
    effect: 'RUIN // +10 fracture hazard each enemy turn',
  },
  SPIKED_WARD: {
    id: 'SPIKED_WARD',
    name: 'Spiked Ward',
    tier: 'KINETIC',
    description: 'Wraith Parry reflects 50% of blocked damage as HP retaliation.',
    effect: 'WRAITH PARRY // 50% damage reflect',
  },
  RELENTLESS_MOMENTUM: {
    id: 'RELENTLESS_MOMENTUM',
    name: 'Relentless Momentum',
    tier: 'KINETIC',
    description: 'Killing a Fractured enemy restores 20% Stamina.',
    effect: 'ON KILL FRACTURED // +20% stamina',
  },
  HEAVY_CALIBER: {
    id: 'HEAVY_CALIBER',
    name: 'Heavy Caliber',
    tier: 'KINETIC',
    description: 'Grave Bind deals 15 kinetic damage when pulling a target.',
    effect: 'GRAVE BIND // +15 kinetic on pull',
  },
  JUGGERNAUT_PLATING: {
    id: 'JUGGERNAUT_PLATING',
    name: 'Juggernaut Plating',
    tier: 'KINETIC',
    description: 'Shadow Step grants a 1-hit physical damage shield.',
    effect: 'SHADOW STEP // absorb next physical hit',
  },
  SHATTER_POINT: {
    id: 'SHATTER_POINT',
    name: 'Shatter-Point',
    tier: 'KINETIC',
    description: 'Attacking a Fractured enemy grants +20% Critical Hit Chance.',
    effect: 'VS FRACTURED // +20% crit chance',
  },
  ADRENALINE_SPIKE: {
    id: 'ADRENALINE_SPIKE',
    name: 'Adrenaline Spike',
    tier: 'KINETIC',
    description: 'Taking health damage refunds 1 AP once per turn.',
    effect: 'ON DAMAGE TAKEN // +1 AP (1×/turn)',
  },
  ABYSSAL_RESONANCE: {
    id: 'ABYSSAL_RESONANCE',
    name: 'Abyssal Resonance',
    tier: 'KINETIC',
    description: 'Strike deals +5% damage for every 10% Stamina you hold.',
    effect: 'STRIKE // +5% dmg per 10% stamina',
  },
  EXECUTIONERS_GRIP: {
    id: 'EXECUTIONERS_GRIP',
    name: "Executioner's Grip",
    tier: 'KINETIC',
    description: 'Grave Bind shatters 1 layer of Kinetic Armor on pull.',
    effect: 'GRAVE BIND // −1 kinetic armor',
  },
  BLACK_LIGHT_SIPHON: {
    id: 'BLACK_LIGHT_SIPHON',
    name: 'Black-Light Siphon',
    tier: 'OCCULT',
    description: 'Blood-Tithe heals 3% Health per 10 Reserve consumed.',
    effect: 'BLOOD-TITHE // 3% heal per 10 AR',
  },
  VOID_CONTAGION: {
    id: 'VOID_CONTAGION',
    name: 'Void Contagion',
    tier: 'OCCULT',
    description: 'Doomed targets take 5 Occult damage at the start of their turn.',
    effect: 'DOOMED // 5 occult pulse (stacks ×3)',
  },
  EVENT_HORIZON: {
    id: 'EVENT_HORIZON',
    name: 'Event Horizon',
    tier: 'OCCULT',
    description: 'Nail to the Grid reduces enemy AP by 2 instead of 1.',
    effect: 'NAIL TO GRID // −2 enemy AP',
  },
  ABYSSAL_OVERFLOW: {
    id: 'ABYSSAL_OVERFLOW',
    name: 'Abyssal Overflow',
    tier: 'OCCULT',
    description: 'Max Abyssal Reserve increased to 150%.',
    effect: 'RESERVE CAP // 150%',
  },
  REACTIVE_WARDS: {
    id: 'REACTIVE_WARDS',
    name: 'Reactive Wards',
    tier: 'OCCULT',
    description: 'Ashen Mantle costs 0 AP but has a 3-turn cooldown.',
    effect: 'ASHEN MANTLE // 0 AP, 3-turn CD',
  },
  PHANTOM_STRIKES: {
    id: 'PHANTOM_STRIKES',
    name: 'Phantom Strikes',
    tier: 'OCCULT',
    description: 'Critical hits split 50% of post-armor damage to a random second target.',
    effect: 'ON CRIT // 50% echo damage',
  },
  CORRUPTED_BLOOD: {
    id: 'CORRUPTED_BLOOD',
    name: 'Corrupted Blood',
    tier: 'OCCULT',
    description: 'Survivors of Eviscerate suffer 8 Occult bleed per hostile turn.',
    effect: 'POST-EVISCERATE // void bleed',
  },
  UMBRAL_CARAPACE: {
    id: 'UMBRAL_CARAPACE',
    name: 'Umbral Carapace',
    tier: 'OCCULT',
    description: 'Generating Abyssal Reserve restores 2% Soul Anchor.',
    effect: 'ON AR GAIN // +2% HP heal',
  },
  NULL_ZONE: {
    id: 'NULL_ZONE',
    name: 'Null-Zone',
    tier: 'OCCULT',
    description: 'Attackers hitting Ashen Mantle lose 10% max HP.',
    effect: 'ASHEN MANTLE // attacker −10% max HP',
  },
  ECHOING_VOID: {
    id: 'ECHOING_VOID',
    name: 'Echoing Void',
    tier: 'OCCULT',
    description: 'Blood-Tithe no longer consumes Reserve; 2-turn cooldown added.',
    effect: 'BLOOD-TITHE // free tithe, 2-turn CD',
  },
  DEEP_LUNGS: {
    id: 'DEEP_LUNGS',
    name: 'Deep Lungs',
    tier: 'SYSTEM',
    description: "Demon's Lung restores 80% Stamina instead of 40%.",
    effect: "DEMON'S LUNG // 80% stamina",
  },
  BLOOD_PRICE: {
    id: 'BLOOD_PRICE',
    name: 'Blood Price',
    tier: 'SYSTEM',
    description: 'Crimson Pact costs 5% Max Health instead of 15%.',
    effect: 'CRIMSON PACT // 5% HP cost',
  },
  SECOND_WIND: {
    id: 'SECOND_WIND',
    name: 'Second Wind',
    tier: 'SYSTEM',
    description: 'Below 10% HP: gain 100% Stamina and +2 AP once per run.',
    effect: 'ONCE/RUN // emergency surge',
  },
  LEY_LINE_TAP: {
    id: 'LEY_LINE_TAP',
    name: 'Ley-Line Tap',
    tier: 'SYSTEM',
    description: 'Start every encounter with 50% Abyssal Reserve.',
    effect: 'COMBAT ENTRY // 50% AR',
  },
  HYPER_METABOLISM: {
    id: 'HYPER_METABOLISM',
    name: 'Hyper-Metabolism',
    tier: 'SYSTEM',
    description: 'Healing effects +50% effective; max Soul Anchor −25%.',
    effect: 'HEAL +50% // MAX HP −25%',
  },
  UNSTOPPABLE_FORCE: {
    id: 'UNSTOPPABLE_FORCE',
    name: 'Unstoppable Force',
    tier: 'SYSTEM',
    description: 'Immune to the first Fracture break applied each encounter.',
    effect: '1×/FIGHT // fracture immunity',
  },
  GRID_GHOST: {
    id: 'GRID_GHOST',
    name: 'Grid Ghost',
    tier: 'SYSTEM',
    description: 'Evading an attack refunds 20% Stamina and grants +5% Evade (stacks 3×).',
    effect: 'ON EVADE // stamina + evade stack',
  },
  MASOCISTS_JOY: {
    id: 'MASOCISTS_JOY',
    name: "Masochist's Joy",
    tier: 'SYSTEM',
    description: 'Failed Wraith Parry empowers your next attack by 50%.',
    effect: 'ON PARRY FAIL // +50% next hit',
  },
  PERFECTED_FORM: {
    id: 'PERFECTED_FORM',
    name: 'Perfected Form',
    tier: 'SYSTEM',
    description: 'Perfect parry heals 10% Max Soul Anchor.',
    effect: 'PERFECT PARRY // +10% HP',
  },
  FINAL_STAND: {
    id: 'FINAL_STAND',
    name: 'The Final Stand',
    tier: 'SYSTEM',
    description: 'At 1 AP and 0 Stamina, all attacks deal True damage.',
    effect: 'DESPERATE // true damage',
  },
  EXECUTIONERS_HIGH: {
    id: 'EXECUTIONERS_HIGH',
    name: "The Executioner's High",
    tier: 'AP_BOOST',
    description: 'Killing with a physical attack refunds 1 AP once per turn.',
    effect: 'PHYSICAL KILL // +1 AP (1×/turn)',
  },
  FLAWLESS_CONDUIT: {
    id: 'FLAWLESS_CONDUIT',
    name: 'Flawless Conduit',
    tier: 'AP_BOOST',
    description: 'Perfect parry grants +1 AP on your next turn.',
    effect: 'PERFECT PARRY // +1 AP next turn',
  },
  BLOOD_FOR_TIME: {
    id: 'BLOOD_FOR_TIME',
    name: 'Blood for Time',
    tier: 'AP_BOOST',
    description: 'Once per turn, spend 15% current HP to gain 1 AP.',
    effect: '1×/TURN // HP → AP',
  },
  MOMENTUM_SHIFT: {
    id: 'MOMENTUM_SHIFT',
    name: 'Momentum Shift',
    tier: 'AP_BOOST',
    description: 'Ending a turn at 0 Stamina grants +1 AP next turn but Evade drops to 0% until stamina returns.',
    effect: '0 STAM END // +1 AP, evade disabled',
  },
};

export const ALL_LEY_LINE_MUTATION_IDS = Object.keys(LEY_LINE_MUTATION_CATALOG) as LeyLineMutationId[];

export function getLeyLineMutation(id: LeyLineMutationId): LeyLineMutationDefinition {
  return LEY_LINE_MUTATION_CATALOG[id];
}

export function pickRandomLeyLineMutations(
  count: number,
  owned: readonly LeyLineMutationId[] = [],
): LeyLineMutationDefinition[] {
  const ownedSet = new Set(owned);
  const pool = ALL_LEY_LINE_MUTATION_IDS.filter((id) => !ownedSet.has(id));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((id) => LEY_LINE_MUTATION_CATALOG[id]);
}
