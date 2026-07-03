import type { BossRuntimeProfile, EnvironmentalModifiers, IncursionNode } from '../types/game';
import type { EnemyCombatProfile } from '../types/run';
import type {
  AnchorStage,
  RunGenerationContext,
  VeilAnchorState,
  VeilAnchorType,
} from '../types/worldState';

export interface AnchorAssaultProgress {
  elitesDefeated: number;
  coreCleared: boolean;
}

export interface AnchorAssaultCombatContext {
  anchor: VeilAnchorState;
  stage: AnchorStage;
  isCoreEncounter: boolean;
  operationId: string;
}

export function createDefaultAnchorAssaultProgress(): AnchorAssaultProgress {
  return { elitesDefeated: 0, coreCleared: false };
}

export function resolveAnchorAssaultContext(
  node: IncursionNode | null | undefined,
  runContext: RunGenerationContext | null | undefined,
): AnchorAssaultCombatContext | null {
  if (!node?.contextModifiers?.anchorSignal) return null;
  if (!runContext?.activeAnchor?.isActive) return null;
  if (runContext.activeOperation.objectiveKind !== 'ANCHOR_ASSAULT') return null;

  const stage = node.contextModifiers.anchorStage ?? 'TRACE';
  const isCoreEncounter = stage === 'CORE' && node.type === 'BOSS_COMBAT';

  return {
    anchor: runContext.activeAnchor,
    stage,
    isCoreEncounter,
    operationId: runContext.activeOperation.id,
  };
}

const STAGE_HP_SCALE: Record<AnchorStage, number> = {
  TRACE: 1.1,
  BREACH: 1.22,
  CORE: 1.35,
};

const STAGE_DAMAGE_SCALE: Record<AnchorStage, number> = {
  TRACE: 1.05,
  BREACH: 1.12,
  CORE: 1.2,
};

const ANCHOR_TYPE_LOG: Record<VeilAnchorType, string> = {
  CHOIR_SPIRE: 'Resonant choir tissue bleeding through local geometry.',
  LEY_NEXUS: 'Ley flux conduits warping hostile spawn signatures.',
  NULL_MONOLITH: 'Null-field monolith saturating the engagement zone.',
  RIFT_ENGINE: 'Rift engine cycling — reality shear on hostile phase.',
  ASHEN_HEART: 'Ashen heart pulse — elite biomass overclocked.',
};

export function anchorAssaultEngageLogLines(ctx: AnchorAssaultCombatContext): string[] {
  const stageLabel = ctx.isCoreEncounter ? 'CORE' : ctx.stage;
  const lines = [
    `>> ANCHOR ASSAULT — ${ctx.anchor.displayName.toUpperCase()} // ${stageLabel}`,
    `>> ${ANCHOR_TYPE_LOG[ctx.anchor.type]}`,
  ];
  if (ctx.isCoreEncounter) {
    lines.push('>> PRIME ANCHOR CORE MANIFEST — operation objective within reach.');
  } else if (ctx.stage === 'BREACH') {
    lines.push('>> ANCHOR BREACH LAYER — hostile elite bound to veil tissue.');
  } else {
    lines.push('>> ANCHOR TRACE — localized reality drift on hostile cluster.');
  }
  return lines;
}

export function anchorAssaultClearLogLine(
  ctx: AnchorAssaultCombatContext,
  kind: 'ELITE' | 'CORE',
): string {
  if (kind === 'CORE') {
    return `>> ANCHOR CORE SUPPRESSED — ${ctx.anchor.displayName} neutralized.`;
  }
  return `>> ANCHOR ELITE NEUTRALIZED — ${ctx.stage} layer cleared on ${ctx.anchor.displayName}.`;
}

export function applyAnchorRealityToEnvironment(
  base: EnvironmentalModifiers,
  anchor: VeilAnchorState,
  stage: AnchorStage,
): EnvironmentalModifiers {
  const rules = anchor.realityRules;
  let env = { ...base };

  if (rules.anomalyBias >= 0.15 || stage !== 'TRACE') {
    env = {
      ...env,
      startingStaminaPenalty: Math.min(
        2,
        env.startingStaminaPenalty + Math.ceil(rules.anomalyBias * 4),
      ),
    };
  }

  if (rules.echoBias >= 0.2 || anchor.type === 'CHOIR_SPIRE') {
    env = { ...env, isEnemyPhaseShrouded: true };
  }

  if (anchor.type === 'RIFT_ENGINE' && stage !== 'TRACE') {
    env = { ...env, hasTetanusGlitch: true };
  }

  if (anchor.type === 'NULL_MONOLITH' && stage === 'CORE') {
    env = { ...env, isPlayerBlinded: true };
  }

  return env;
}

export function applyAnchorAssaultSpawnScaling(
  profiles: EnemyCombatProfile[],
  ctx: AnchorAssaultCombatContext,
): EnemyCombatProfile[] {
  const rules = ctx.anchor.realityRules;
  const hpMul = STAGE_HP_SCALE[ctx.stage] * (1 + rules.eliteBias * 0.35);
  const dmgMul = STAGE_DAMAGE_SCALE[ctx.stage] * (1 + rules.combatBias * 0.5);

  return profiles.map((profile) => {
    const maxHp = Math.max(1, Math.floor(profile.maxHp * hpMul));
    const currentHp = Math.min(maxHp, Math.max(1, Math.floor((profile.currentHp ?? profile.maxHp) * hpMul)));
    const baseDamage = Math.max(1, Math.floor(profile.baseDamage * dmgMul));
    const suffix = ctx.isCoreEncounter ? '' : ` // ANCHOR ${ctx.stage}`;

    return {
      ...profile,
      maxHp,
      currentHp,
      baseDamage,
      designation: profile.designation.includes('ANCHOR')
        ? profile.designation
        : `${profile.designation}${suffix}`,
    };
  });
}

export function applyAnchorCoreBossProfile(
  boss: BossRuntimeProfile,
  ctx: AnchorAssaultCombatContext,
): BossRuntimeProfile {
  const rules = ctx.anchor.realityRules;
  const hpScale = 1 + rules.eliteBias + rules.combatBias * 0.75;
  const maxHp = Math.max(1, Math.floor(boss.maxHp * hpScale));

  return {
    ...boss,
    name: `${ctx.anchor.displayName} — CORE`,
    maxHp,
    currentHp: maxHp,
    phases: [
      {
        phaseNumber: 1,
        phaseName: 'Anchor Shell',
        triggerHpThreshold: 51,
        intentModifier: `${ctx.anchor.type} tissue manifest`,
      },
      {
        phaseNumber: 2,
        phaseName: 'Core Rupture',
        triggerHpThreshold: 50,
        intentModifier: 'Veil anchor collapse discharge',
      },
    ],
  };
}

export function recordAnchorAssaultVictory(
  progress: AnchorAssaultProgress,
  node: IncursionNode,
  ctx: AnchorAssaultCombatContext,
): { progress: AnchorAssaultProgress; kind: 'ELITE' | 'CORE' | null } {
  if (ctx.isCoreEncounter && node.type === 'BOSS_COMBAT') {
    if (progress.coreCleared) {
      return { progress, kind: null };
    }
    return {
      progress: { ...progress, coreCleared: true },
      kind: 'CORE',
    };
  }

  if (node.type === 'ELITE_COMBAT') {
    return {
      progress: { ...progress, elitesDefeated: progress.elitesDefeated + 1 },
      kind: 'ELITE',
    };
  }

  return { progress, kind: null };
}
