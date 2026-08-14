import type { InstinctAdapterInput, InstinctGrade } from '../../types/nineStrain';

function envoyGrade(prevented: number, wouldReachHp: number): InstinctGrade {
  if (wouldReachHp <= 0) return 'FAILED';
  const ratio = prevented / wouldReachHp;
  if (ratio >= 1) return 'PERFECT';
  if (ratio >= 0.5) return 'CLEAN';
  if (ratio > 0) return 'STANDARD';
  return 'FAILED';
}

/**
 * Normalized Instinct grades. Class identity is adapter input, never a weapon display name.
 */
export function resolveInstinctGrade(input: InstinctAdapterInput): InstinctGrade {
  if (input.classId === 'AEGIS') {
    if (input.perfectParry) return 'PERFECT';
    if (input.wraithParrySuccess) return 'CLEAN';
    if (input.voidWardPrevented) return 'STANDARD';
    if (input.parryAttempted) return 'FAILED';
    return 'FAILED';
  }
  if (input.classId === 'HEX_SHOT') {
    if (input.reloadQuality === 'PERFECT') return 'PERFECT';
    if (input.reloadQuality === 'CLEAN') return 'CLEAN';
    return 'FAILED';
  }
  return envoyGrade(input.riftPreventedDamage ?? 0, input.riftWouldReachHp ?? 0);
}

export function isPositiveInstinctGrade(grade: InstinctGrade): boolean {
  return grade !== 'FAILED';
}
