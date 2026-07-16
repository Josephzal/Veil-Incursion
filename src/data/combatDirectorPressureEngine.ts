/**
 * Combat Refactor Phase 5 — encounter pressure scoring.
 */

import type {
  CombatDirectorContext,
  EncounterPressureLabel,
  EncounterPressureScore,
} from '../types/combatDirector';
import { EMPTY_ENCOUNTER_PRESSURE_SCORE } from '../types/combatDirector';
import { getIntentCatalogEntry } from './enemyIntentCatalog';

function clamp(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function labelFor(total: number): EncounterPressureLabel {
  if (total <= 30) return 'LOW';
  if (total <= 55) return 'MODERATE';
  if (total <= 75) return 'HIGH';
  return 'CRITICAL';
}

export function scoreEncounterPressure(
  ctx: CombatDirectorContext,
): EncounterPressureScore {
  const enemies = (ctx.enemies ?? []).filter((e) => (e.currentHp ?? 0) > 0 || (e.maxHp ?? 0) > 0);
  if (enemies.length === 0) return { ...EMPTY_ENCOUNTER_PRESSURE_SCORE };

  const enemyCount = enemies.length;
  const totalHp = enemies.reduce((s, e) => s + (e.maxHp || e.currentHp || 0), 0);
  const totalDmg = enemies.reduce((s, e) => s + (e.baseDamage || 0), 0);
  const armorStacks = enemies.reduce((s, e) => s + (e.kineticArmor ?? e.baseKineticArmor ?? 0), 0);
  const wardStacks = enemies.reduce((s, e) => s + (e.occultWards ?? e.baseOccultWards ?? 0), 0);

  let highIntents = 0;
  let criticalIntents = 0;
  for (const e of enemies) {
    const meta = getIntentCatalogEntry(e.intent);
    if (meta.severity === 'HIGH') highIntents += 1;
    if (meta.severity === 'CRITICAL') criticalIntents += 1;
  }

  const playerHpRatio = ctx.playerMaxHp > 0
    ? ctx.playerCurrentHp / ctx.playerMaxHp
    : 1;

  const damagePressure = clamp(totalDmg * 1.8 + (1 - playerHpRatio) * 25);
  const hpPressure = clamp(totalHp / Math.max(18, ctx.playerMaxHp) * 22);
  const enemyCountPressure = clamp((enemyCount - 1) * 14);
  const elitePressure = clamp(
    (ctx.isEliteEncounter ? 18 : 0)
    + (ctx.isBossEncounter ? 28 : 0)
    + (ctx.eliteModifier ? 10 : 0),
  );
  const armorPressure = clamp(armorStacks * 10);
  const wardPressure = clamp(wardStacks * 10);
  const fracturePressure = clamp(
    enemies.filter((e) => (e.fractureMax ?? 0) > 0 || (e.kineticArmor ?? 0) > 0 || (e.occultWards ?? 0) > 0).length * 6,
  );
  const intentPressure = clamp(highIntents * 12 + criticalIntents * 20);
  const criticalIntentPressure = clamp(criticalIntents * 28);
  const objectivePressure = clamp(
    (ctx.hasObjective ? 12 : 0)
    + (ctx.isDirtyExtraction ? 16 : 0)
    + (ctx.survivalTurnsRequired != null && ctx.survivalTurnsRequired <= 2 ? 10 : 0),
  );
  const timelinePressure = clamp(ctx.hasObjective && ctx.isDirtyExtraction ? 8 : ctx.hasObjective ? 4 : 0);
  const cargoPressure = clamp(
    (ctx.hasUnstableCargo ? 10 : 0) + (ctx.hasHighValueCargo ? 6 : 0),
  );
  const extractionPressure = clamp(ctx.isDirtyExtraction ? 18 : 0);
  const echoPressure = clamp(ctx.isEcho ? 14 : 0);
  const anchorPressure = clamp(ctx.isAnchor ? 14 : 0);
  const rivalPressure = clamp(
    enemies.some((e) => e.isRivalMerc) ? 12 : 0,
  );
  const unstablePressure = clamp(ctx.hasUnstableCargo ? 8 : 0);

  const complexityPressure = clamp(
    (armorStacks > 0 && wardStacks > 0 ? 12 : 0)
    + (ctx.hasObjective && (armorStacks > 0 || wardStacks > 0) ? 8 : 0)
    + (highIntents > 0 && (ctx.isEcho || ctx.isAnchor) ? 8 : 0)
    + (ctx.depth === 1 && criticalIntents > 0 ? 20 : 0),
  );

  const rewardScore = clamp(
    40
    + (ctx.isEliteEncounter ? 15 : 0)
    + (ctx.isBossEncounter ? 25 : 0)
    + (ctx.isHighRiskNode ? 12 : 0)
    + (ctx.isDirtyExtraction ? 10 : 0),
  );

  const depthBias = ctx.depth === 1 ? 0.85 : ctx.depth === 2 ? 1 : 1.05;

  const total = clamp(
    (
      damagePressure * 0.14
      + hpPressure * 0.1
      + enemyCountPressure * 0.08
      + elitePressure * 0.1
      + armorPressure * 0.08
      + wardPressure * 0.08
      + fracturePressure * 0.04
      + intentPressure * 0.1
      + criticalIntentPressure * 0.06
      + objectivePressure * 0.06
      + timelinePressure * 0.03
      + cargoPressure * 0.03
      + extractionPressure * 0.04
      + echoPressure * 0.03
      + anchorPressure * 0.03
      + rivalPressure * 0.02
      + unstablePressure * 0.02
      + complexityPressure * 0.08
    ) * depthBias,
  );

  return {
    total,
    damagePressure,
    hpPressure,
    enemyCountPressure,
    elitePressure,
    armorPressure,
    wardPressure,
    fracturePressure,
    intentPressure,
    criticalIntentPressure,
    objectivePressure,
    timelinePressure,
    cargoPressure,
    extractionPressure,
    echoPressure,
    anchorPressure,
    rivalPressure,
    unstablePressure,
    complexityPressure,
    rewardScore,
    label: labelFor(total),
  };
}

export function formatEncounterPressureScore(score: EncounterPressureScore): string {
  return [
    `PRESSURE ${score.total} (${score.label})`,
    `  dmg=${score.damagePressure} hp=${score.hpPressure} count=${score.enemyCountPressure} elite=${score.elitePressure}`,
    `  KA=${score.armorPressure} OW=${score.wardPressure} intent=${score.intentPressure} critIntent=${score.criticalIntentPressure}`,
    `  obj=${score.objectivePressure} cargo=${score.cargoPressure} extract=${score.extractionPressure}`,
    `  echo=${score.echoPressure} anchor=${score.anchorPressure} complexity=${score.complexityPressure}`,
  ].join('\n');
}
