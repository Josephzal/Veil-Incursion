import type { EnvironmentalModifiers, IncursionNode } from '../types/game';
import type { ClassType } from '../types/game';
import type { EchoEliteTemplate, EchoTier } from '../types/echoElite';
import type { EnemyCombatProfile } from '../types/run';
import type { DepthStage, NodeContextModifiers, RunGenerationContext } from '../types/worldState';
import type { DistrictId } from './districtPacing';
import { depthFromNodesCleared, getDistrictFromDepth } from './districtPacing';
import { resolveEchoEncounterAtEngagement } from './echoEncounterEngine';
import { MAX_LEGENDARY_ECHO_ENCOUNTERS_PER_RUN } from './worldStateHelpers';
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
  const kind = node?.contextModifiers?.echoEncounterKind;
  if (kind && kind !== 'HOSTILE_ECHO') return null;

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
  preferredClass?: ClassType,
): EchoEliteTemplate | null {
  const eligible = ECHO_ELITE_CATALOG.filter((entry) => {
    if (!entry.allowedDepths.includes(depthIndex)) return false;
    if (entry.allowedDepthStages && !entry.allowedDepthStages.includes(depthStage)) {
      return false;
    }
    if (entry.tier === 'LEGENDARY' && !allowLegendary) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  const rand = seededRandom(
    `echo-template:${templateSeed}:${depthIndex}:${depthStage}:${preferredClass ?? 'any'}`,
  );

  const classEligible = preferredClass
    ? eligible.filter((entry) => entry.isClassEcho && entry.sourceClass === preferredClass)
    : [];
  const classLegendary = classEligible.filter((entry) => entry.tier === 'LEGENDARY');
  const classStandard = classEligible.filter((entry) => entry.tier === 'STANDARD');
  const genericEligible = eligible.filter((entry) => !entry.isClassEcho);
  const genericLegendary = genericEligible.filter((entry) => entry.tier === 'LEGENDARY');
  const genericStandard = genericEligible.filter((entry) => entry.tier === 'STANDARD');

  if (allowLegendary && rand() < 0.22) {
    if (classLegendary.length > 0 && rand() < 0.6) {
      return classLegendary[Math.floor(rand() * classLegendary.length)] ?? null;
    }
    if (genericLegendary.length > 0) {
      return genericLegendary[Math.floor(rand() * genericLegendary.length)] ?? null;
    }
  }

  const preferClass = preferredClass && classStandard.length > 0 && rand() < 0.78;
  const pickPool = preferClass
    ? classStandard
    : genericStandard.length > 0
      ? genericStandard
      : classStandard.length > 0
        ? classStandard
        : eligible;

  return pickPool[Math.floor(rand() * pickPool.length)] ?? null;
}

const CLASS_FALLEN_LABELS: Record<ClassType, string> = {
  AEGIS: 'FALLEN AEGIS',
  HEX_SHOT: 'FALLEN HEX SHOT',
  ENVOY: 'FALLEN ENVOY',
};

export function echoRecoveryEngageLogLines(ctx: EchoRecoveryCombatContext): string[] {
  const tierLabel = ctx.tier === 'LEGENDARY'
    ? (ctx.template.isClassEcho ? 'CORRUPTED CLASS ECHO' : 'LEGENDARY ECHO')
    : ctx.template.isClassEcho && ctx.template.sourceClass
      ? CLASS_FALLEN_LABELS[ctx.template.sourceClass]
      : 'ECHO RESIDUE';
  const lines = [
    `>> ${tierLabel} — ${ctx.template.displayName.toUpperCase()}`,
    `>> ${ctx.template.engageLogLine}`,
  ];
  if (ctx.template.loadoutSummary) {
    lines.push(`>> IMPRINT — ${ctx.template.loadoutSummary}`);
  }
  if (ctx.isEchoRecoveryOp) {
    lines.push('>> ECHO RECOVERY OPERATION — residue capture authorized.');
  }
  return lines;
}

export function echoRecoveryClearLogLine(ctx: EchoRecoveryCombatContext): string {
  if (ctx.template.isClassEcho && ctx.template.sourceClass) {
    const classLabel = CLASS_FALLEN_LABELS[ctx.template.sourceClass];
    return `>> ${classLabel} NEUTRALIZED — ${ctx.template.displayName} archived.`;
  }
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
  const depthIndex = getDistrictFromDepth(depthFromNodesCleared(nodeIndex)) as 1 | 2 | 3;
  let hpScale = template.hpScale ?? (template.tier === 'LEGENDARY' ? 1.3 : 1.12);
  let dmgScale = template.damageScale ?? (template.tier === 'LEGENDARY' ? 1.12 : 1.06);

  if (template.isClassEcho) {
    if (depthIndex === 1) {
      hpScale *= 0.88;
      dmgScale *= 0.9;
    } else if (depthIndex === 3 && template.tier === 'STANDARD') {
      hpScale *= 1.1;
      dmgScale *= 1.06;
    }
  }

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
  const rollState = {
    echoSignalsUsed: 0,
    legendaryEchoUsed: 0,
    echoSignalsByDepth: {},
  };
  const withSignal = {
    ...modifiers,
    echoSignal: true,
    echoSignalLabel: modifiers.echoSignalLabel ?? 'ECHO SIGNAL',
  };
  if (!allowLegendary) {
    rollState.legendaryEchoUsed = MAX_LEGENDARY_ECHO_ENCOUNTERS_PER_RUN;
  }
  return resolveEchoEncounterAtEngagement(
    withSignal,
    depthIndex,
    'COMBAT',
    null,
    templateSeed,
    rollState,
  );
}
