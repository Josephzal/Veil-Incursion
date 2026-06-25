import type { LeyLineMutationDefinition, LeyLineMutationId } from '../types/leyLineMutation';
import { BOON_RULES } from './boonEngine';

function effect(id: LeyLineMutationId): string {
  return BOON_RULES[id].trigger;
}

export const LEY_LINE_MUTATION_CATALOG: Record<LeyLineMutationId, LeyLineMutationDefinition> = {
  SHARPENED: {
    id: 'SHARPENED',
    name: 'Sharpened',
    tier: 'KINETIC',
    description: 'Melee attacks pierce 1 layer of Kinetic Armor automatically.',
    effect: effect('SHARPENED'),
  },
  VENOMOUS_RUIN: {
    id: 'VENOMOUS_RUIN',
    name: 'Venomous Ruin',
    tier: 'KINETIC',
    description: 'AoE actions leave a lingering hazard that deals 10 Fracture per hostile turn.',
    effect: effect('VENOMOUS_RUIN'),
  },
  SPIKED_WARD: {
    id: 'SPIKED_WARD',
    name: 'Spiked Ward',
    tier: 'KINETIC',
    description: 'Defensive actions reflect 50% of blocked physical damage back at the attacker.',
    effect: effect('SPIKED_WARD'),
  },
  RELENTLESS_MOMENTUM: {
    id: 'RELENTLESS_MOMENTUM',
    name: 'Relentless Momentum',
    tier: 'KINETIC',
    description: 'Killing a Fractured enemy restores 25% Abyssal Reserve.',
    effect: effect('RELENTLESS_MOMENTUM'),
  },
  HEAVY_CALIBER: {
    id: 'HEAVY_CALIBER',
    name: 'Heavy Caliber',
    tier: 'KINETIC',
    description: 'Control/displacement actions deal 15 bonus kinetic damage on success.',
    effect: effect('HEAVY_CALIBER'),
  },
  JUGGERNAUT_PLATING: {
    id: 'JUGGERNAUT_PLATING',
    name: 'Juggernaut Plating',
    tier: 'KINETIC',
    description: 'Mobility actions grant a temporary 1-hit physical shield.',
    effect: effect('JUGGERNAUT_PLATING'),
  },
  SHATTER_POINT: {
    id: 'SHATTER_POINT',
    name: 'Shatter-Point',
    tier: 'KINETIC',
    description: 'Attacking a Fractured enemy grants +20% Critical Hit Chance.',
    effect: effect('SHATTER_POINT'),
  },
  ADRENALINE_SPIKE: {
    id: 'ADRENALINE_SPIKE',
    name: 'Adrenaline Spike',
    tier: 'KINETIC',
    description: 'Taking health damage refunds 1 AP once per turn.',
    effect: effect('ADRENALINE_SPIKE'),
  },
  ABYSSAL_RESONANCE: {
    id: 'ABYSSAL_RESONANCE',
    name: 'Abyssal Resonance',
    tier: 'KINETIC',
    description: 'Kinetic actions deal +5% damage per Runic Brand held.',
    effect: effect('ABYSSAL_RESONANCE'),
  },
  EXECUTIONERS_GRIP: {
    id: 'EXECUTIONERS_GRIP',
    name: "Executioner's Grip",
    tier: 'KINETIC',
    description: 'Control actions shatter 1 layer of Kinetic Armor when exposing or displacing.',
    effect: effect('EXECUTIONERS_GRIP'),
  },
  BLACK_LIGHT_SIPHON: {
    id: 'BLACK_LIGHT_SIPHON',
    name: 'Black-Light Siphon',
    tier: 'OCCULT',
    description: 'Occult restore actions heal 3% Health per 10 Reserve consumed.',
    effect: effect('BLACK_LIGHT_SIPHON'),
  },
  VOID_CONTAGION: {
    id: 'VOID_CONTAGION',
    name: 'Void Contagion',
    tier: 'OCCULT',
    description: 'Doomed targets take 5 Occult damage at the start of their turn (stacks ×3).',
    effect: effect('VOID_CONTAGION'),
  },
  EVENT_HORIZON: {
    id: 'EVENT_HORIZON',
    name: 'Event Horizon',
    tier: 'OCCULT',
    description: 'Debuff actions completely drain the target\'s Stamina.',
    effect: effect('EVENT_HORIZON'),
  },
  ABYSSAL_OVERFLOW: {
    id: 'ABYSSAL_OVERFLOW',
    name: 'Abyssal Overflow',
    tier: 'OCCULT',
    description: 'Max Abyssal Reserve increased to 150%.',
    effect: effect('ABYSSAL_OVERFLOW'),
  },
  REACTIVE_WARDS: {
    id: 'REACTIVE_WARDS',
    name: 'Reactive Wards',
    tier: 'OCCULT',
    description: 'Occult defensive actions cost 0 AP but gain a 3-turn cooldown.',
    effect: effect('REACTIVE_WARDS'),
  },
  PHANTOM_STRIKES: {
    id: 'PHANTOM_STRIKES',
    name: 'Phantom Strikes',
    tier: 'OCCULT',
    description: 'Critical hits split 50% of post-armor damage to a random second target.',
    effect: effect('PHANTOM_STRIKES'),
  },
  CORRUPTED_BLOOD: {
    id: 'CORRUPTED_BLOOD',
    name: 'Corrupted Blood',
    tier: 'OCCULT',
    description: 'Ultimate survivors suffer 8 Occult bleed per hostile turn.',
    effect: effect('CORRUPTED_BLOOD'),
  },
  UMBRAL_CARAPACE: {
    id: 'UMBRAL_CARAPACE',
    name: 'Umbral Carapace',
    tier: 'OCCULT',
    description: 'Generating Abyssal Reserve restores 2% Soul Anchor.',
    effect: effect('UMBRAL_CARAPACE'),
  },
  NULL_ZONE: {
    id: 'NULL_ZONE',
    name: 'Null-Zone',
    tier: 'OCCULT',
    description: 'While a defensive buff is active, attackers lose 10% max HP on hit.',
    effect: effect('NULL_ZONE'),
  },
  ECHOING_VOID: {
    id: 'ECHOING_VOID',
    name: 'Echoing Void',
    tier: 'OCCULT',
    description: 'Occult melee actions no longer consume Reserve; +2-turn cooldown added.',
    effect: effect('ECHOING_VOID'),
  },
  DEEP_LUNGS: {
    id: 'DEEP_LUNGS',
    name: 'Deep Lungs',
    tier: 'SYSTEM',
    description: 'RESTORE actions surge Runic Brands to 3.',
    effect: effect('DEEP_LUNGS'),
  },
  BLOOD_PRICE: {
    id: 'BLOOD_PRICE',
    name: 'Blood Price',
    tier: 'SYSTEM',
    description: 'Sacrifice actions cost 66% less Health.',
    effect: effect('BLOOD_PRICE'),
  },
  SECOND_WIND: {
    id: 'SECOND_WIND',
    name: 'Second Wind',
    tier: 'SYSTEM',
    description: 'Below 10% HP: Aegis fills Abyssal Reserve (others refill Stamina) and gain +2 AP once per encounter.',
    effect: effect('SECOND_WIND'),
  },
  LEY_LINE_TAP: {
    id: 'LEY_LINE_TAP',
    name: 'Ley-Line Tap',
    tier: 'SYSTEM',
    description: 'Start every encounter with 50% Abyssal Reserve.',
    effect: effect('LEY_LINE_TAP'),
  },
  HYPER_METABOLISM: {
    id: 'HYPER_METABOLISM',
    name: 'Hyper-Metabolism',
    tier: 'SYSTEM',
    description: 'Healing effects +50% effective; max Soul Anchor −25%.',
    effect: effect('HYPER_METABOLISM'),
  },
  UNSTOPPABLE_FORCE: {
    id: 'UNSTOPPABLE_FORCE',
    name: 'Unstoppable Force',
    tier: 'SYSTEM',
    description: 'Immune to the first Fracture break applied each encounter.',
    effect: effect('UNSTOPPABLE_FORCE'),
  },
  GRID_GHOST: {
    id: 'GRID_GHOST',
    name: 'Grid Ghost',
    tier: 'SYSTEM',
    description: 'Evading an attack refunds 20% Reserve and grants +5% Evade (stacks 3×).',
    effect: effect('GRID_GHOST'),
  },
  MASOCISTS_JOY: {
    id: 'MASOCISTS_JOY',
    name: "Masochist's Joy",
    tier: 'SYSTEM',
    description: 'Failed defensive actions empower your next attack by 50%.',
    effect: effect('MASOCISTS_JOY'),
  },
  PERFECTED_FORM: {
    id: 'PERFECTED_FORM',
    name: 'Perfected Form',
    tier: 'SYSTEM',
    description: 'Perfect defensive parry heals 10% Max Soul Anchor.',
    effect: effect('PERFECTED_FORM'),
  },
  FINAL_STAND: {
    id: 'FINAL_STAND',
    name: 'The Final Stand',
    tier: 'SYSTEM',
    description: 'At 1 AP and 0 Stamina, all attacks deal True damage.',
    effect: effect('FINAL_STAND'),
  },
  EXECUTIONERS_HIGH: {
    id: 'EXECUTIONERS_HIGH',
    name: "The Executioner's High",
    tier: 'AP_BOOST',
    description: 'Killing with a kinetic action refunds 1 AP once per turn.',
    effect: effect('EXECUTIONERS_HIGH'),
  },
  FLAWLESS_CONDUIT: {
    id: 'FLAWLESS_CONDUIT',
    name: 'Flawless Conduit',
    tier: 'AP_BOOST',
    description: 'Perfect defensive parry grants +1 AP on your next turn.',
    effect: effect('FLAWLESS_CONDUIT'),
  },
  BLOOD_FOR_TIME: {
    id: 'BLOOD_FOR_TIME',
    name: 'Blood for Time',
    tier: 'AP_BOOST',
    description: 'Once per turn, spend 15% current HP to gain 1 AP.',
    effect: effect('BLOOD_FOR_TIME'),
  },
  MOMENTUM_SHIFT: {
    id: 'MOMENTUM_SHIFT',
    name: 'Momentum Shift',
    tier: 'AP_BOOST',
    description: 'Ending a turn at 0 Stamina grants +1 AP next turn but disables Evade until stamina returns.',
    effect: effect('MOMENTUM_SHIFT'),
  },
  MOMENTUM_TRANSFER: {
    id: 'MOMENTUM_TRANSFER',
    name: 'Momentum Transfer',
    tier: 'SYNAPTIC',
    description: 'Mobility actions reduce the AP cost of your next Kinetic action by 1.',
    effect: effect('MOMENTUM_TRANSFER'),
  },
  ABYSSAL_ERUPTION: {
    id: 'ABYSSAL_ERUPTION',
    name: 'Abyssal Eruption',
    tier: 'SYNAPTIC',
    description: 'AoE actions generate +10 Abyssal Reserve per enemy hit.',
    effect: effect('ABYSSAL_ERUPTION'),
  },
  EXECUTIONERS_STRIDE: {
    id: 'EXECUTIONERS_STRIDE',
    name: "Executioner's Stride",
    tier: 'SYNAPTIC',
    description: 'Melee hits against Exposed targets instantly refund 1 AP.',
    effect: effect('EXECUTIONERS_STRIDE'),
  },
  SPALL_SHATTER: {
    id: 'SPALL_SHATTER',
    name: 'Spall-Shatter',
    tier: 'SYNAPTIC',
    description: 'When a defensive buff expires, trigger an AoE burst equal to damage blocked.',
    effect: effect('SPALL_SHATTER'),
  },
  VOID_RESONANCE: {
    id: 'VOID_RESONANCE',
    name: 'Void Resonance',
    tier: 'SYNAPTIC',
    description: 'Occult actions immediately after a Kinetic action deal +15% damage.',
    effect: effect('VOID_RESONANCE'),
  },
  TAR_TRAPPED: {
    id: 'TAR_TRAPPED',
    name: 'Tar-Trapped',
    tier: 'SYNAPTIC',
    description: 'AoE damage prevents targets from evading for 2 turns.',
    effect: effect('TAR_TRAPPED'),
  },
  SLIPSTREAM: {
    id: 'SLIPSTREAM',
    name: 'Slipstream',
    tier: 'SYNAPTIC',
    description: 'Mobility actions consume 20% Abyssal Reserve instead of a stamina tithe.',
    effect: effect('SLIPSTREAM'),
  },
  NECROTIC_ATROPHY: {
    id: 'NECROTIC_ATROPHY',
    name: 'Necrotic Atrophy',
    tier: 'SYNAPTIC',
    description: 'Debuff actions permanently reduce target base damage by 5% this encounter.',
    effect: effect('NECROTIC_ATROPHY'),
  },
  SUNDER_WEAVE: {
    id: 'SUNDER_WEAVE',
    name: 'Sunder-Weave',
    tier: 'SYNAPTIC',
    description: 'Melee + Occult actions permanently shatter 1 layer of enemy armor.',
    effect: effect('SUNDER_WEAVE'),
  },
  VOIDS_TOLL: {
    id: 'VOIDS_TOLL',
    name: "The Void's Toll",
    tier: 'SYNAPTIC',
    description: 'Ultimate kills grant +1 Max AP for the incursion but reduce Max HP by 15%.',
    effect: effect('VOIDS_TOLL'),
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
