/**
 * Combat Refactor Phase 3 — class combat identity audit + report.
 */

import type { ClassType } from '../../types/game';
import type { BalanceRunStats } from './balanceRunStats';
import { AEGIS_ABILITY_CATALOG } from '../aegisAbilities';
import { HEX_SHOT_ABILITY_CATALOG } from '../hexShotAbilities';
import { ENVOY_ABILITY_CATALOG } from '../envoyAbilities';
import { collectPlayerCounterTags } from '../enemyIntentCounterplayEngine';
import { HEX_AMMO_PROFILES } from '../hexShotAmmoProfiles';
import type { IntentCounterTag } from '../../types/enemyIntentMeta';
import { formatClassLoopTelemetrySummary, type ClassLoopTelemetry } from './classLoopTelemetryEngine';

export interface ClassCombatIdentityReport {
  classId: ClassType;
  hasUniqueCombatLoop: boolean;
  loopDescription: string;
  hasArmorAnswer: boolean;
  armorAnswerIds: string[];
  hasWardAnswer: boolean;
  wardAnswerIds: string[];
  hasFractureApplication: boolean;
  fractureApplicationIds: string[];
  hasFractureExploit: boolean;
  fractureExploitIds: string[];
  hasIntentCounterplay: boolean;
  intentCounterIds: string[];
  hasDefensiveAnswer: boolean;
  defensiveAnswerIds: string[];
  earlyDepth1SurvivalScore: number;
  averageFightLength: number;
  averageHpLostPercent: number;
  warnings: string[];
}

function abilityList(classId: ClassType): { id: string; tags: readonly string[] }[] {
  if (classId === 'AEGIS') {
    return Object.values(AEGIS_ABILITY_CATALOG).map((a) => ({ id: a.id, tags: a.tags }));
  }
  if (classId === 'HEX_SHOT') {
    return Object.values(HEX_SHOT_ABILITY_CATALOG).map((a) => ({ id: a.id, tags: a.tags }));
  }
  return Object.values(ENVOY_ABILITY_CATALOG).map((a) => ({ id: a.id, tags: a.tags }));
}

function idsWithCounter(
  classId: ClassType,
  needed: IntentCounterTag[],
): string[] {
  const out: string[] = [];
  for (const a of abilityList(classId)) {
    const tags = collectPlayerCounterTags(a.tags, { classId, abilityId: a.id });
    if (tags.some((t) => needed.includes(t))) out.push(a.id);
  }
  return out;
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

const LOOP_COPY: Record<ClassType, string> = {
  AEGIS: 'Read intent → Perfect Parry → Riposte READY → successful Strike +16 Kinetic.',
  HEX_SHOT: 'Read defenses/intent → load correct round → break armor/wards/interrupt → reload tempo → execution shot.',
  ENVOY: 'Prime catalyst → spell sequence → collapse wards/rituals → exploit Fracture → Catalytic/Cataclysm payoff.',
};

export function buildClassCombatIdentityReport(
  classId: ClassType,
  stats?: BalanceRunStats,
): ClassCombatIdentityReport {
  const armorAnswerIds = idsWithCounter(classId, ['ARMOR_BREAK', 'GUARD_BREAK']);
  // ARMOR_BREAK is enough; also include pierce via tag scan
  const pierceIds = abilityList(classId)
    .filter((a) => a.tags.includes('ARMOR_PIERCE'))
    .map((a) => a.id);
  const allArmor = [...new Set([...armorAnswerIds, ...pierceIds])];

  const wardAnswerIds = idsWithCounter(classId, ['WARD_BREAK']);
  const fractureAppIds = idsWithCounter(classId, ['FRACTURE', 'PARRY', 'INTERRUPT']);
  const fractureExploitIds = abilityList(classId)
    .filter((a) =>
      a.tags.includes('FRACTURE')
      || a.tags.includes('EXECUTION')
      || a.tags.includes('TRUE_DAMAGE')
      || (classId === 'AEGIS' && a.id === 'STRIKE')
      || (classId === 'HEX_SHOT' && (a.id === 'ASH_JACKET_SALVO' || a.id === 'REVENANTS_ECHO'))
      || (classId === 'ENVOY' && (a.id === 'VEIL_SPLINTER' || a.id === 'CATACLYSM_SIGIL'))
    )
    .map((a) => a.id);
  const intentCounterIds = idsWithCounter(classId, [
    'PARRY', 'INTERRUPT', 'BLIND', 'WARD_BREAK', 'ARMOR_BREAK', 'GUARD_BREAK', 'BLOCK',
  ]);
  const defensiveAnswerIds = idsWithCounter(classId, ['PARRY', 'BLOCK', 'DECOY', 'SHIELD']);

  const samples = (stats?.combats ?? []).filter((s) => s.playerClassId === classId);
  const avgTurns = avg(samples.map((s) => s.playerTurns));
  const avgHpLost = avg(samples.map((s) => s.playerHpLostPercent ?? 0));
  const early = samples.slice(0, 3);
  const earlySurvival = early.length
    ? avg(early.map((s) => (s.victory ? 100 - (s.playerHpLostPercent ?? 0) : 0)))
    : 70;

  const warnings: string[] = [];
  if (!allArmor.length) warnings.push('lacks armor answer');
  if (!wardAnswerIds.length && classId !== 'AEGIS') warnings.push('lacks ward answer');
  if (classId === 'AEGIS' && !wardAnswerIds.length) {
    // Aegis may lack pure WARD_BREAK — warn soft if no fracture path either
    if (!fractureAppIds.length) warnings.push('no ward or fracture pressure vs occult');
  }
  if (!fractureAppIds.length && !fractureExploitIds.length) warnings.push('lacks Fracture application/exploit');
  if (!intentCounterIds.length) warnings.push('lacks intent counterplay');
  if (!defensiveAnswerIds.length) warnings.push('lacks defensive answer');
  if (early.length >= 3 && earlySurvival < 50) warnings.push('early Depth 1 survival too low');
  if (avgTurns > 7) warnings.push('average fight length too long');

  // Hex profile coverage
  if (classId === 'HEX_SHOT') {
    const hasBreacher = HEX_AMMO_PROFILES.some((p) => p.id === 'BREACHER');
    const hasNull = HEX_AMMO_PROFILES.some((p) => p.id === 'NULL');
    const hasFlash = HEX_AMMO_PROFILES.some((p) => p.id === 'FLASH');
    if (!hasBreacher || !hasNull || !hasFlash) warnings.push('ammo profile set incomplete');
  }

  return {
    classId,
    hasUniqueCombatLoop: true,
    loopDescription: LOOP_COPY[classId],
    hasArmorAnswer: allArmor.length > 0,
    armorAnswerIds: allArmor,
    hasWardAnswer: wardAnswerIds.length > 0 || classId === 'AEGIS',
    wardAnswerIds,
    hasFractureApplication: fractureAppIds.length > 0,
    fractureApplicationIds: fractureAppIds,
    hasFractureExploit: fractureExploitIds.length > 0,
    fractureExploitIds,
    hasIntentCounterplay: intentCounterIds.length > 0,
    intentCounterIds,
    hasDefensiveAnswer: defensiveAnswerIds.length > 0,
    defensiveAnswerIds,
    earlyDepth1SurvivalScore: earlySurvival,
    averageFightLength: avgTurns,
    averageHpLostPercent: avgHpLost,
    warnings,
  };
}

export function formatClassCombatIdentityReport(
  stats?: BalanceRunStats,
  loopByClass?: Partial<Record<ClassType, ClassLoopTelemetry>>,
): string {
  const classes: ClassType[] = ['AEGIS', 'HEX_SHOT', 'ENVOY'];
  const lines = ['CLASS COMBAT IDENTITY REPORT (Phase 3)', ''];
  for (const id of classes) {
    const r = buildClassCombatIdentityReport(id, stats);
    lines.push(`══ ${id} ══`);
    lines.push(`  Loop: ${r.loopDescription}`);
    lines.push(`  Armor: ${r.hasArmorAnswer} [${r.armorAnswerIds.slice(0, 4).join(', ')}]`);
    lines.push(`  Wards: ${r.hasWardAnswer} [${r.wardAnswerIds.slice(0, 4).join(', ') || 'pressure via Fracture'}]`);
    lines.push(`  Fracture apply: ${r.hasFractureApplication} // exploit: ${r.hasFractureExploit}`);
    lines.push(`  Intent counters: ${r.intentCounterIds.slice(0, 5).join(', ') || '—'}`);
    lines.push(`  Defensive: ${r.defensiveAnswerIds.slice(0, 4).join(', ') || '—'}`);
    lines.push(`  Early survival score: ${r.earlyDepth1SurvivalScore} // avg turns: ${r.averageFightLength || '—'} // avg HP lost%: ${r.averageHpLostPercent || '—'}`);
    if (r.warnings.length) {
      lines.push(`  WARNINGS: ${r.warnings.join('; ')}`);
    } else {
      lines.push('  WARNINGS: none');
    }
    if (loopByClass?.[id]) {
      lines.push(formatClassLoopTelemetrySummary(id, loopByClass[id]!));
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function formatClassCombatReport(stats: BalanceRunStats): string {
  const lines = ['CLASS COMBAT REPORT (Phase 3)', ''];
  for (const id of ['AEGIS', 'HEX_SHOT', 'ENVOY'] as ClassType[]) {
    const samples = stats.combats.filter((s) => s.playerClassId === id);
    if (!samples.length) {
      lines.push(`${id}: (no samples)`);
      continue;
    }
    const wins = samples.filter((s) => s.victory).length;
    const avgTaken = avg(samples.map((s) => s.damageTaken));
    const avgDealt = avg(samples.map((s) => s.damageDealt));
    const avgTurns = avg(samples.map((s) => s.playerTurns));
    const counterAttempts = samples.reduce((n, s) => n + (s.intent?.classCounterAttempts ?? 0), 0);
    const counterSuccess = samples.reduce((n, s) => n + (s.intent?.classCounterSuccesses ?? 0), 0);
    const rate = counterAttempts > 0 ? Math.round((counterSuccess / counterAttempts) * 100) : null;
    lines.push(
      `${id}: n=${samples.length} win=${Math.round((wins / samples.length) * 100)}%`,
      `  avg taken ${avgTaken} // dealt ${avgDealt} // turns ${avgTurns}`,
      `  intent counter rate ${rate != null ? `${rate}%` : '—'}`,
    );
    const withLoop = samples.filter((s) => s.classLoop);
    if (withLoop.length) {
      const last = withLoop[withLoop.length - 1]!.classLoop!;
      lines.push(formatClassLoopTelemetrySummary(id, last));
    }
    lines.push('');
  }
  return lines.join('\n');
}
