import type {
  DeepVeilLawId,
  EncounterModifierId,
  VeilDistortionId,
} from '../types/depthIdentity';
import type { ProceduralNodeType } from '../types/proceduralRunTree';

export interface EncounterModifierDefinition {
  id: EncounterModifierId;
  displayName: string;
  fantasy: string;
  effectSummary: string;
  telegraph: string;
  /** Depths that may roll this modifier. */
  allowedDepths: readonly (1 | 2 | 3)[];
  favoredDistortions: readonly VeilDistortionId[];
  favoredLaws: readonly DeepVeilLawId[];
  /** Node types that can receive this modifier. */
  eligibleNodeTypes: readonly ProceduralNodeType[];
}

export const ENCOUNTER_MODIFIER_DEFINITIONS: Record<EncounterModifierId, EncounterModifierDefinition> = {
  MIRRORED: {
    id: 'MIRRORED',
    displayName: 'Mirrored',
    fantasy: 'The Veil reflects the player\'s violence back into the arena.',
    effectSummary: 'First enemy killed reflecting a lesser wound back at you.',
    telegraph: 'First kill leaves a mirror scar — expect a retaliatory pulse.',
    allowedDepths: [2, 3],
    favoredDistortions: ['MEMORY_CONTAMINATION'],
    favoredLaws: ['THE_VEIL_REMEMBERS', 'THE_SKY_IS_UNDERGROUND'],
    eligibleNodeTypes: ['COMBAT', 'ELITE', 'ANOMALY', 'GATEKEEPER'],
  },
  BLEEDING: {
    id: 'BLEEDING',
    displayName: 'Bleeding',
    fantasy: 'The arena itself weeps occult pressure on a cycle.',
    effectSummary: 'Every 3rd hostile cycle applies minor occult pressure.',
    telegraph: 'The walls pulse on a three-count — end fights before the bleed tax stacks.',
    allowedDepths: [2, 3],
    favoredDistortions: ['BLEEDING_ARCHITECTURE'],
    favoredLaws: ['THE_WALLS_ARE_HUNGRY'],
    eligibleNodeTypes: ['COMBAT', 'ELITE', 'ANOMALY', 'GATEKEEPER'],
  },
  UNSTABLE: {
    id: 'UNSTABLE',
    displayName: 'Unstable',
    fantasy: 'Value runs hot — the next path may burn for it.',
    effectSummary: 'Clears raise reward pressure; next node High-Risk chance rises.',
    telegraph: 'Rich signal. Clearing this node destabilizes the next vector.',
    allowedDepths: [2, 3],
    favoredDistortions: ['UNSTABLE_MATTER'],
    favoredLaws: ['THE_WALLS_ARE_HUNGRY', 'THE_SKY_IS_UNDERGROUND'],
    eligibleNodeTypes: ['COMBAT', 'ELITE', 'ANOMALY', 'RESOURCE', 'GATEKEEPER'],
  },
  FOLDED: {
    id: 'FOLDED',
    displayName: 'Folded',
    fantasy: 'One hostile starts displaced behind geometry.',
    effectSummary: 'One enemy begins phased — first strikes against it miss harder.',
    telegraph: 'One silhouette is folded out of true position until struck or revealed.',
    allowedDepths: [2, 3],
    favoredDistortions: ['PREDATORY_GEOMETRY'],
    favoredLaws: ['THE_SKY_IS_UNDERGROUND', 'THE_ROADS_ARE_LOOPING'],
    eligibleNodeTypes: ['COMBAT', 'ELITE', 'GATEKEEPER'],
  },
  STARVED: {
    id: 'STARVED',
    displayName: 'Starved',
    fantasy: 'The environment drinks every restorative act.',
    effectSummary: 'Healing received during this encounter is reduced.',
    telegraph: 'Restoratives are taxed here — heal for less until the node clears.',
    allowedDepths: [2, 3],
    favoredDistortions: ['RITUAL_PRESSURE', 'BLEEDING_ARCHITECTURE'],
    favoredLaws: ['THE_WALLS_ARE_HUNGRY'],
    eligibleNodeTypes: ['COMBAT', 'ELITE', 'ANOMALY', 'SANCTUARY', 'GATEKEEPER'],
  },
  RESONANT: {
    id: 'RESONANT',
    displayName: 'Resonant',
    fantasy: 'Anchor, Echo, and Operation pressure amplify each other.',
    effectSummary: 'Signal overlays hit harder; hostiles fight with more teeth.',
    telegraph: 'Resonance spike — signal clears pay more, hostiles hit harder.',
    allowedDepths: [2, 3],
    favoredDistortions: ['RITUAL_PRESSURE', 'MEMORY_CONTAMINATION'],
    favoredLaws: ['THE_VEIL_REMEMBERS', 'THE_MACHINE_IS_PRAYING'],
    eligibleNodeTypes: ['COMBAT', 'ELITE', 'ANOMALY', 'GATEKEEPER'],
  },
  CORE_SICK: {
    id: 'CORE_SICK',
    displayName: 'Core-Sick',
    fantasy: 'Depth 3 Anchor sickness bleeds into the squad.',
    effectSummary: 'Hostiles gain a one-time Core surge under Anchor pressure.',
    telegraph: 'Core-sick signature — expect a single Anchor-fed surge mid-fight.',
    allowedDepths: [3],
    favoredDistortions: [],
    favoredLaws: ['THE_VEIL_REMEMBERS', 'THE_MACHINE_IS_PRAYING', 'THE_SKY_IS_UNDERGROUND'],
    eligibleNodeTypes: ['ELITE', 'ANOMALY', 'GATEKEEPER', 'COMBAT'],
  },
};

export const ALL_ENCOUNTER_MODIFIER_IDS = Object.keys(
  ENCOUNTER_MODIFIER_DEFINITIONS,
) as EncounterModifierId[];

export function getEncounterModifierDefinition(
  id: EncounterModifierId,
): EncounterModifierDefinition {
  return ENCOUNTER_MODIFIER_DEFINITIONS[id];
}

/** Base chance a valid node rolls a modifier, by depth. */
export const ENCOUNTER_MODIFIER_BASE_CHANCE: Record<1 | 2 | 3, number> = {
  1: 0.03,
  2: 0.28,
  3: 0.48,
};

export const STARVED_HEAL_MULTIPLIER = 0.65;
export const MIRRORED_REFLECT_DAMAGE = 8;
export const BLEEDING_OCCULT_DAMAGE = 5;
export const RESONANT_ENEMY_DAMAGE_BONUS_PCT = 15;
export const CORE_SICK_HP_BONUS_PCT = 18;
export const FOLDED_EVADE_DURATION_HINT = 'First strike against folded target resists unless guaranteed.';
