import type { EliteCombatModifierId, EnvironmentalModifiers } from '../types/game';

export const ELITE_MODIFIER_LABELS: Record<EliteCombatModifierId, string> = {
  KINETIC_SHIELDING: 'KINETIC SHIELDING — hostile absorbs 30% strike damage',
  LETHAL_RETALIATION: 'LETHAL RETALIATION — 6 HP feedback per operative strike',
  PHASE_SHROUD: 'PHASE SHROUD — 25% strike miss chance',
};

export function rollEliteModifier(seed: string): EliteCombatModifierId {
  const hash = seed.split('').reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 0);
  const roll = Math.abs(hash) % 3;
  const modifiers: EliteCombatModifierId[] = [
    'KINETIC_SHIELDING',
    'LETHAL_RETALIATION',
    'PHASE_SHROUD',
  ];
  return modifiers[roll];
}

export function applyEliteModifierToEnvironment(
  base: EnvironmentalModifiers,
  modifier: EliteCombatModifierId,
): EnvironmentalModifiers {
  switch (modifier) {
    case 'KINETIC_SHIELDING':
      return { ...base, eliteModifier: modifier, enemyDamageReductionPct: 30 };
    case 'LETHAL_RETALIATION':
      return { ...base, eliteModifier: modifier, lethalRetaliationDamage: 6 };
    case 'PHASE_SHROUD':
      return { ...base, eliteModifier: modifier, isEnemyPhaseShrouded: true };
    default:
      return base;
  }
}
