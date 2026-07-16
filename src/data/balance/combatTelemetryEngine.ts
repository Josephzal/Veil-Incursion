/**
 * Combat Refactor Phase 1 — extended combat encounter telemetry.
 */

import type { BalanceCombatEncounterSample, BalanceCombatKind } from './balanceRunStats';

export interface CombatDefenseTelemetry {
  fractureAppliedCount: number;
  fractureTriggeredByArmorBreakCount: number;
  fractureTriggeredByWardBreakCount: number;
  kineticArmorDamageReduced: number;
  kineticArmorStacksRemoved: number;
  kineticArmorBreaks: number;
  occultWardDamageReduced: number;
  occultWardStacksRemoved: number;
  occultWardBreaks: number;
  hadKineticArmorEnemy: boolean;
  hadOccultWardEnemy: boolean;
}

export interface CombatTelemetrySummary {
  kind: BalanceCombatKind;
  playerClassId?: string;
  depth?: number;
  enemyCount?: number;
  startingPlayerHp?: number;
  endingPlayerHp?: number;
  playerHpLostPercent?: number;
  turnsTaken: number;
  totalDamageDealtByPlayer: number;
  totalDamageTakenByPlayer: number;
  totalHealingDone?: number;
  playerDied: boolean;
  victory: boolean;
  defense?: CombatDefenseTelemetry;
}

export function createEmptyDefenseTelemetry(): CombatDefenseTelemetry {
  return {
    fractureAppliedCount: 0,
    fractureTriggeredByArmorBreakCount: 0,
    fractureTriggeredByWardBreakCount: 0,
    kineticArmorDamageReduced: 0,
    kineticArmorStacksRemoved: 0,
    kineticArmorBreaks: 0,
    occultWardDamageReduced: 0,
    occultWardStacksRemoved: 0,
    occultWardBreaks: 0,
    hadKineticArmorEnemy: false,
    hadOccultWardEnemy: false,
  };
}

export function extendBalanceSample(
  sample: BalanceCombatEncounterSample,
  extras?: Partial<CombatTelemetrySummary>,
): BalanceCombatEncounterSample {
  return {
    ...sample,
    playerClassId: extras?.playerClassId ?? sample.playerClassId,
    depth: extras?.depth ?? sample.depth,
    enemyCount: extras?.enemyCount ?? sample.enemyCount,
    startingPlayerHp: extras?.startingPlayerHp ?? sample.startingPlayerHp,
    endingPlayerHp: extras?.endingPlayerHp ?? sample.endingPlayerHp,
    playerHpLostPercent: extras?.playerHpLostPercent ?? sample.playerHpLostPercent,
    defense: extras?.defense ?? sample.defense,
  };
}

export function formatCombatTelemetrySummary(summary: CombatTelemetrySummary): string {
  const hpLine = summary.playerHpLostPercent != null
    ? `HP lost: ${Math.round(summary.playerHpLostPercent)}%`
    : `HP: ${summary.startingPlayerHp ?? '?'} → ${summary.endingPlayerHp ?? '?'}`;
  const lines = [
    'COMBAT TELEMETRY',
    `  Kind: ${summary.kind} // Class: ${summary.playerClassId ?? '?'} // Depth: ${summary.depth ?? '?'}`,
    `  Turns: ${summary.turnsTaken} // Enemies: ${summary.enemyCount ?? '?'}`,
    `  Dealt: ${summary.totalDamageDealtByPlayer} // Taken: ${summary.totalDamageTakenByPlayer} // Heal: ${summary.totalHealingDone ?? 0}`,
    `  ${hpLine} // Victory: ${summary.victory} // Died: ${summary.playerDied}`,
  ];
  if (summary.defense) {
    const d = summary.defense;
    lines.push(
      `  KA: −${d.kineticArmorDamageReduced} dmg, −${d.kineticArmorStacksRemoved} stacks, ${d.kineticArmorBreaks} breaks`,
      `  OW: −${d.occultWardDamageReduced} dmg, −${d.occultWardStacksRemoved} stacks, ${d.occultWardBreaks} breaks`,
      `  Fracture: ${d.fractureAppliedCount} (armor ${d.fractureTriggeredByArmorBreakCount} / ward ${d.fractureTriggeredByWardBreakCount})`,
    );
  }
  return lines.join('\n');
}
