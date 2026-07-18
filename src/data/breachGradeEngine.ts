import type { BreachGradeId } from '../types/progression';
import { BREACH_GRADE_LABELS, ALL_BREACH_GRADES } from '../types/progression';
import type { ProgressionProfile } from '../types/progression';
import type { EnemyCombatProfile } from '../types/run';
import { isBreachGradeUnlockedInProfile } from './progressionProfileEngine';

/** Playable grades in Phase 1D — IV/V stay catalog-only. */
export const PLAYABLE_BREACH_GRADES: readonly BreachGradeId[] = ['I', 'II', 'III'] as const;

export interface BreachGradeTuning {
  id: BreachGradeId;
  label: string;
  shortLabel: string;
  /** Enemy HP multiplier. */
  enemyHpMultiplier: number;
  /** Enemy base damage multiplier. */
  enemyDamageMultiplier: number;
  /** Added to encounterBias.eliteWeightDelta. */
  eliteWeightDelta: number;
  /** Added to encounterBias.combatWeightDelta. */
  combatWeightDelta: number;
  /** Multiplier for encounterBudget spawn/phase budgets. */
  threatBudgetMultiplier: number;
  /** Added to rewardModifiers.rareLootBonusPct. */
  rareLootBonusPct: number;
  /** Added to rewardModifiers.creditBonusPct. */
  creditBonusPct: number;
  /** Multiplier for Runner Clearance XP from the run. */
  clearanceXpMultiplier: number;
  /** Briefing blurb. */
  summary: string;
}

export const BREACH_GRADE_TUNING: Record<BreachGradeId, BreachGradeTuning> = {
  I: {
    id: 'I',
    label: BREACH_GRADE_LABELS.I,
    shortLabel: 'I',
    enemyHpMultiplier: 1,
    enemyDamageMultiplier: 1,
    eliteWeightDelta: 0,
    combatWeightDelta: 0,
    threatBudgetMultiplier: 1,
    rareLootBonusPct: 0,
    creditBonusPct: 0,
    clearanceXpMultiplier: 1,
    summary: 'Readable Edge pressure — baseline rewards.',
  },
  II: {
    id: 'II',
    label: BREACH_GRADE_LABELS.II,
    shortLabel: 'II',
    enemyHpMultiplier: 1.12,
    enemyDamageMultiplier: 1.08,
    eliteWeightDelta: 0.08,
    combatWeightDelta: 0.04,
    threatBudgetMultiplier: 1.12,
    rareLootBonusPct: 6,
    creditBonusPct: 12,
    clearanceXpMultiplier: 1.15,
    summary: 'Pressurized routes — denser elites, better salvage.',
  },
  III: {
    id: 'III',
    label: BREACH_GRADE_LABELS.III,
    shortLabel: 'III',
    enemyHpMultiplier: 1.25,
    enemyDamageMultiplier: 1.15,
    eliteWeightDelta: 0.15,
    combatWeightDelta: 0.08,
    threatBudgetMultiplier: 1.28,
    rareLootBonusPct: 12,
    creditBonusPct: 25,
    clearanceXpMultiplier: 1.3,
    summary: 'Hostile breach — heavier foes, stronger payouts.',
  },
  IV: {
    id: 'IV',
    label: BREACH_GRADE_LABELS.IV,
    shortLabel: 'IV',
    enemyHpMultiplier: 1.4,
    enemyDamageMultiplier: 1.25,
    eliteWeightDelta: 0.22,
    combatWeightDelta: 0.12,
    threatBudgetMultiplier: 1.4,
    rareLootBonusPct: 18,
    creditBonusPct: 40,
    clearanceXpMultiplier: 1.45,
    summary: 'Condemned — locked until later phases.',
  },
  V: {
    id: 'V',
    label: BREACH_GRADE_LABELS.V,
    shortLabel: 'V',
    enemyHpMultiplier: 1.55,
    enemyDamageMultiplier: 1.35,
    eliteWeightDelta: 0.3,
    combatWeightDelta: 0.16,
    threatBudgetMultiplier: 1.55,
    rareLootBonusPct: 25,
    creditBonusPct: 55,
    clearanceXpMultiplier: 1.6,
    summary: 'Black — optional endgame challenge.',
  },
};

const GRADE_ORDER: Record<BreachGradeId, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
};

export function breachGradeRank(grade: BreachGradeId): number {
  return GRADE_ORDER[grade] ?? 1;
}

export function compareBreachGrades(a: BreachGradeId, b: BreachGradeId): number {
  return breachGradeRank(a) - breachGradeRank(b);
}

export function isBreachGradeAtLeast(
  grade: BreachGradeId,
  minimum: BreachGradeId,
): boolean {
  return breachGradeRank(grade) >= breachGradeRank(minimum);
}

export function getBreachGradeTuning(grade: BreachGradeId): BreachGradeTuning {
  return BREACH_GRADE_TUNING[grade] ?? BREACH_GRADE_TUNING.I;
}

export function formatBreachGradeLabel(grade: BreachGradeId, compact = false): string {
  const tuning = getBreachGradeTuning(grade);
  return compact ? `Grade ${tuning.shortLabel}` : `Breach Grade ${tuning.shortLabel} — ${tuning.label}`;
}

/** Clamp a preferred grade to what the profile has unlocked (playable set only). */
export function resolveSelectedBreachGrade(
  profile: ProgressionProfile,
  preferred: BreachGradeId | null | undefined,
): BreachGradeId {
  const unlocked = profile.runner.unlockedBreachGrades.filter((g) =>
    (PLAYABLE_BREACH_GRADES as readonly string[]).includes(g),
  );
  const available = unlocked.length > 0 ? unlocked : (['I'] as BreachGradeId[]);
  if (preferred && available.includes(preferred)) return preferred;
  return available.reduce((best, g) => (
    breachGradeRank(g) > breachGradeRank(best) ? g : best
  ), available[0]!);
}

export function listSelectableBreachGrades(
  profile: ProgressionProfile,
): BreachGradeId[] {
  return PLAYABLE_BREACH_GRADES.filter((g) => isBreachGradeUnlockedInProfile(profile, g));
}

export function normalizeBreachGradeId(raw: unknown): BreachGradeId {
  if (typeof raw === 'string' && (ALL_BREACH_GRADES as readonly string[]).includes(raw)) {
    return raw as BreachGradeId;
  }
  return 'I';
}

/** Scale squad stats for the active breach grade. */
export function applyBreachGradeEnemyScaling(
  enemies: readonly EnemyCombatProfile[],
  grade: BreachGradeId | null | undefined,
): EnemyCombatProfile[] {
  const tuning = getBreachGradeTuning(grade ?? 'I');
  if (tuning.enemyHpMultiplier === 1 && tuning.enemyDamageMultiplier === 1) {
    return [...enemies];
  }
  return enemies.map((enemy) => {
    const maxHp = Math.max(1, Math.ceil(enemy.maxHp * tuning.enemyHpMultiplier));
    const currentHp = Math.max(1, Math.min(maxHp, Math.ceil(enemy.currentHp * tuning.enemyHpMultiplier)));
    const baseDamage = Math.max(1, Math.ceil(enemy.baseDamage * tuning.enemyDamageMultiplier));
    return {
      ...enemy,
      maxHp,
      currentHp,
      baseDamage,
    };
  });
}

/** Contract difficulty → suggested minimum breach grade. */
export function minBreachGradeForContractDifficulty(difficulty: number): BreachGradeId | undefined {
  if (difficulty >= 5) return 'III';
  if (difficulty >= 4) return 'II';
  if (difficulty >= 3) return 'II';
  return undefined;
}

export function contractMeetsBreachGrade(
  selectedGrade: BreachGradeId,
  minGrade: BreachGradeId | null | undefined,
): boolean {
  if (!minGrade) return true;
  return isBreachGradeAtLeast(selectedGrade, minGrade);
}

export function maxBreachGrade(
  a: BreachGradeId | null | undefined,
  b: BreachGradeId | null | undefined,
): BreachGradeId | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return breachGradeRank(a) >= breachGradeRank(b) ? a : b;
}

export function buildBreachGradeDebriefLines(grade: BreachGradeId): string[] {
  const tuning = getBreachGradeTuning(grade);
  const lines = [
    formatBreachGradeLabel(grade),
    tuning.summary,
  ];
  if (tuning.creditBonusPct > 0) {
    lines.push(`Credit bonus +${tuning.creditBonusPct}%`);
  }
  if (tuning.rareLootBonusPct > 0) {
    lines.push(`Rare loot +${tuning.rareLootBonusPct}%`);
  }
  if (tuning.clearanceXpMultiplier !== 1) {
    lines.push(`Clearance XP ×${tuning.clearanceXpMultiplier.toFixed(2)}`);
  }
  return lines;
}

/** Persist sector mastery of a cleared breach grade after successful extract. */
export function recordSectorHighestGradeCleared(
  profile: ProgressionProfile,
  sectorId: import('../types/worldState').SectorId,
  grade: BreachGradeId,
): { profile: ProgressionProfile; updated: boolean; previous: BreachGradeId | null } {
  const sector = profile.sectors[sectorId];
  if (!sector) {
    return { profile, updated: false, previous: null };
  }
  const nextHighest = maxBreachGrade(sector.highestGradeCleared, grade);
  const gradeImproved = Boolean(nextHighest && nextHighest !== sector.highestGradeCleared);
  // Always grant a small mastery tick on successful grade clear extract.
  const masteryXpGain = 40 + breachGradeRank(grade) * 20;
  const nextXp = sector.masteryXp + masteryXpGain;
  // Levels 0–5 from XP (100 XP per level). Grade clear always advances mastery XP.
  const nextLevel = Math.min(5, Math.floor(nextXp / 100));
  if (!gradeImproved && masteryXpGain <= 0) {
    return { profile, updated: false, previous: sector.highestGradeCleared };
  }
  return {
    profile: {
      ...profile,
      sectors: {
        ...profile.sectors,
        [sectorId]: {
          ...sector,
          highestGradeCleared: nextHighest ?? sector.highestGradeCleared,
          masteryXp: nextXp,
          masteryLevel: Math.max(sector.masteryLevel, nextLevel),
        },
      },
    },
    updated: true,
    previous: sector.highestGradeCleared,
  };
}
