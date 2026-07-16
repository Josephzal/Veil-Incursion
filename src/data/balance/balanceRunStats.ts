/**
 * Per-run combat/economy counters for balance telemetry (Phase B).
 * Updated lightly during combat; aggregated into RunBalanceTelemetry at debrief.
 */

export type BalanceCombatKind = 'STANDARD' | 'ELITE' | 'BOSS';

export interface BalanceCombatEncounterSample {
  kind: BalanceCombatKind;
  playerTurns: number;
  damageTaken: number;
  healingReceived: number;
  damageDealt: number;
  victory: boolean;
  /** Phase 1 combat refactor telemetry (optional for legacy samples). */
  playerClassId?: string;
  depth?: number;
  enemyCount?: number;
  startingPlayerHp?: number;
  endingPlayerHp?: number;
  playerHpLostPercent?: number;
  defense?: import('./combatTelemetryEngine').CombatDefenseTelemetry;
  /** Phase 2 — enemy intent telegraph / counterplay telemetry. */
  intent?: import('./combatIntentTelemetryEngine').CombatIntentTelemetry;
  /** Phase 3 — class loop fantasy telemetry. */
  classLoop?: import('./classLoopTelemetryEngine').ClassLoopTelemetry;
  /** Phase 4 — encounter objective telemetry. */
  objective?: import('./encounterObjectiveTelemetryEngine').EncounterObjectiveTelemetry;
  /** Phase 5 — combat director metadata snapshot. */
  director?: {
    pressureTotal: number;
    pressureLabel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    rewardMultiplier: number;
    adjustmentsApplied: number;
    severity: 'OK' | 'WARNING' | 'ERROR';
    debugSummary: string;
  };
  /** Phase 5 — juice feedback telemetry. */
  juice?: import('../combatJuiceFeedbackEngine').CombatJuiceTelemetry;
}

export interface BalanceRunStats {
  /** Completed (or attempted) combat samples this run. */
  combats: BalanceCombatEncounterSample[];
  totalDamageTaken: number;
  totalHealingReceived: number;
  totalDamageDealt: number;
  totalPlayerTurns: number;
  sanctuaryVisits: number;
  marketVisits: number;
  creditsSpent: number;
  /** Set on death path for debrief/career. */
  deathCause: string | null;
  deathDistrict: 1 | 2 | 3 | null;
}

export function createDefaultBalanceRunStats(): BalanceRunStats {
  return {
    combats: [],
    totalDamageTaken: 0,
    totalHealingReceived: 0,
    totalDamageDealt: 0,
    totalPlayerTurns: 0,
    sanctuaryVisits: 0,
    marketVisits: 0,
    creditsSpent: 0,
    deathCause: null,
    deathDistrict: null,
  };
}

export function recordBalanceCombatSample(
  stats: BalanceRunStats,
  sample: BalanceCombatEncounterSample,
): BalanceRunStats {
  return {
    ...stats,
    combats: [...stats.combats, sample],
    totalDamageTaken: stats.totalDamageTaken + sample.damageTaken,
    totalHealingReceived: stats.totalHealingReceived + sample.healingReceived,
    totalDamageDealt: stats.totalDamageDealt + sample.damageDealt,
    totalPlayerTurns: stats.totalPlayerTurns + sample.playerTurns,
  };
}

export function averageTurnsForKind(
  samples: readonly BalanceCombatEncounterSample[],
  kind: BalanceCombatKind,
): number | null {
  const subset = samples.filter((s) => s.kind === kind && s.victory);
  if (subset.length === 0) return null;
  const sum = subset.reduce((acc, s) => acc + s.playerTurns, 0);
  return Math.round((sum / subset.length) * 10) / 10;
}
