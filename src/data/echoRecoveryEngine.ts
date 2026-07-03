import type { EnvironmentalModifiers, IncursionNode } from '../types/game';
import type { EchoEliteTemplate, EchoTier } from '../types/echoElite';
import type { EnemyCombatProfile } from '../types/run';
import type { DepthStage, NodeContextModifiers, RunGenerationContext } from '../types/worldState';
import type { DistrictId } from './districtPacing';
import { getDepthStage } from './worldStateHelpers';
import { ECHO_ELITE_CATALOG, getEchoEliteTemplate } from './echoEliteCatalog';
import { ENEMY_ROSTER, spawnRosterUnit } from './enemyRoster';
import { rosterToSpawnSlots } from './rosterSpawnSlots';
import { applyDiagonalStaggerToProfiles } from './combatGridPlacement';
import { seededRandom } from './encounterGenerator';

export interface EchoRecoveryProgress {
  echoesDefeated: number;
  legendaryDefeated: number;
}

export interface EchoRecoveryCombatContext {
  template: EchoEliteTemplate;
  tier: EchoTier;
  operationId: string;
  isEchoRecoveryOp: boolean;
}

export function createDefaultEchoRecoveryProgress(): EchoRecoveryProgress {
  return { echoesDefeated: 0, legendaryDefeated: 0 };
}

export function resolveEchoRecoveryContext(
  node: IncursionNode | null | undefined,
  runContext: RunGenerationContext | null | undefined,
): EchoRecoveryCombatContext | null {
  const templateId = node?.contextModifiers?.echoTemplateId;
  if (!node?.contextModifiers?.echoSignal || !templateId) return null;

  const template = getEchoEliteTemplate(templateId);
  if (!template) return null;

  return {
    template,
    tier: node.contextModifiers.echoTier ?? template.tier,
    operationId: runContext?.activeOperation.id ?? template.id,
    isEchoRecoveryOp: runContext?.activeOperation.objectiveKind === 'ECHO_RECOVERY',
  };
}

export function pickEchoTemplateForNode(
  depthIndex: 1 | 2 | 3,
  depthStage: DepthStage,
  templateSeed: string,
  allowLegendary: boolean,
): EchoEliteTemplate | null {
  const pool = ECHO_ELITE_CATALOG.filter((entry) => {
    if (!entry.allowedDepths.includes(depthIndex)) return false;
    if (entry.allowedDepthStages && !entry.allowedDepthStages.includes(depthStage)) {
      return false;
    }
    if (entry.tier === 'LEGENDARY' && !allowLegendary) return false;
    return true;
  });

  if (pool.length === 0) return null;

  const rand = seededRandom(`echo-template:${templateSeed}:${depthIndex}:${depthStage}`);
  const standardPool = pool.filter((entry) => entry.tier === 'STANDARD');
  const legendaryPool = pool.filter((entry) => entry.tier === 'LEGENDARY');

  if (allowLegendary && legendaryPool.length > 0 && rand() < 0.22) {
    return legendaryPool[Math.floor(rand() * legendaryPool.length)] ?? null;
  }

  const pickPool = standardPool.length > 0 ? standardPool : pool;
  return pickPool[Math.floor(rand() * pickPool.length)] ?? null;
}

export function echoRecoveryEngageLogLines(ctx: EchoRecoveryCombatContext): string[] {
  const tierLabel = ctx.tier === 'LEGENDARY' ? 'LEGENDARY ECHO' : 'ECHO RESIDUE';
  return [
    `>> ${tierLabel} — ${ctx.template.displayName.toUpperCase()}`,
    `>> ${ctx.template.engageLogLine}`,
    ...(ctx.isEchoRecoveryOp
      ? ['>> ECHO RECOVERY OPERATION — residue capture authorized.']
      : []),
  ];
}

export function echoRecoveryClearLogLine(ctx: EchoRecoveryCombatContext): string {
  const tierLabel = ctx.tier === 'LEGENDARY' ? 'Legendary echo' : 'Echo residue';
  return `>> ${tierLabel.toUpperCase()} NEUTRALIZED — ${ctx.template.displayName} archived.`;
}

export function applyEchoResidueToEnvironment(
  base: EnvironmentalModifiers,
  template: EchoEliteTemplate,
): EnvironmentalModifiers {
  let env = { ...base, isEnemyPhaseShrouded: true };

  if (template.tier === 'LEGENDARY') {
    env = {
      ...env,
      startingStaminaPenalty: Math.min(2, env.startingStaminaPenalty + 1),
    };
  }

  if (template.eliteModifier === 'LETHAL_RETALIATION') {
    env = { ...env, lethalRetaliationDamage: 6 };
  }

  return env;
}

export function spawnEchoEliteSquad(
  template: EchoEliteTemplate,
  nodeIndex: number,
  district: DistrictId,
  resonancePercent: number,
): EnemyCombatProfile[] {
  const slots = rosterToSpawnSlots(template.roster);
  const hpScale = template.hpScale ?? (template.tier === 'LEGENDARY' ? 1.3 : 1.12);
  const dmgScale = template.damageScale ?? (template.tier === 'LEGENDARY' ? 1.12 : 1.06);

  const profiles = slots.map(({ rosterId, slot, isAlpha }, index) => {
    const profile = spawnRosterUnit(ENEMY_ROSTER[rosterId], nodeIndex, {
      resonancePercent,
      forcedElite: true,
      district,
      isAlpha,
    });
    const maxHp = Math.max(1, Math.floor(profile.maxHp * hpScale));
    const baseDamage = Math.max(1, Math.floor(profile.baseDamage * dmgScale));
    const designation = slots.length > 1
      ? `${template.designation} // ${index + 1}`
      : template.designation;

    return {
      ...profile,
      gridSlot: slot,
      designation,
      maxHp,
      currentHp: maxHp,
      baseDamage,
    };
  });

  return applyDiagonalStaggerToProfiles(profiles);
}

export function recordEchoRecoveryVictory(
  progress: EchoRecoveryProgress,
  node: IncursionNode,
  ctx: EchoRecoveryCombatContext,
): { progress: EchoRecoveryProgress; recorded: boolean } {
  if (!node.contextModifiers?.echoSignal) {
    return { progress, recorded: false };
  }

  const next: EchoRecoveryProgress = {
    echoesDefeated: progress.echoesDefeated + 1,
    legendaryDefeated: progress.legendaryDefeated + (ctx.tier === 'LEGENDARY' ? 1 : 0),
  };

  return { progress: next, recorded: true };
}

export function stampEchoTemplateOnModifiers(
  modifiers: NodeContextModifiers,
  depthIndex: 1 | 2 | 3,
  templateSeed: string,
  allowLegendary: boolean,
): NodeContextModifiers {
  const depthStage = getDepthStage(depthIndex);
  const template = pickEchoTemplateForNode(depthIndex, depthStage, templateSeed, allowLegendary);
  if (!template) return modifiers;

  return {
    ...modifiers,
    echoSignal: true,
    echoTemplateId: template.id,
    echoTier: template.tier,
  };
}
