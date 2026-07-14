import type { EncounterEnemyKey } from './enemyCombatConfig';
import type { EncounterSquadTier, VeilBiome } from '../types/encounterSpawn';
import type {
  EncounterCompositionTemplateId,
  EncounterRiskLabel,
  EncounterRewardTier,
} from '../types/encounterComposition';
import {
  enemyIsAbilityDisabler,
  enemyIsArtilleryThreat,
  enemyIsEchoSpecialOnly,
  enemyIsTrueDamageThreat,
  getEnemyCompositionRole,
} from './enemyCompositionRoleCatalog';
import { getEnemyDefinition, isDepth3ExclusiveEnemy } from './enemyDefinitions';
import { getEncounterCompositionTemplate } from './encounterCompositionTemplateCatalog';

export interface CompositionFairnessIssue {
  severity: 'error' | 'warn';
  code: string;
  message: string;
}

export interface CompositionFairnessContext {
  depth: 1 | 2 | 3;
  tier: EncounterSquadTier;
  veilBiome?: VeilBiome | null;
  highRisk?: boolean;
  templateId?: EncounterCompositionTemplateId | null;
  majorModifierCount?: number;
  rewardTier?: EncounterRewardTier | null;
  riskLabel?: EncounterRiskLabel | null;
}

export function validateCompositionFairness(
  keys: readonly EncounterEnemyKey[],
  ctx: CompositionFairnessContext,
): CompositionFairnessIssue[] {
  const issues: CompositionFairnessIssue[] = [];
  if (keys.length === 0) {
    issues.push({ severity: 'error', code: 'EMPTY', message: 'Encounter has no enemies.' });
    return issues;
  }

  const roles = keys.map((key) => getEnemyCompositionRole(key)?.primaryRole);
  const abilityDisablers = keys.filter(enemyIsAbilityDisabler);
  const artillery = keys.filter(enemyIsArtilleryThreat);
  const trueDamage = keys.filter(enemyIsTrueDamageThreat);
  const supports = roles.filter((role) => role === 'SUPPORT');
  const damageRoles = roles.filter(
    (role) =>
      role === 'BRUISER'
      || role === 'ASSASSIN'
      || role === 'ARTILLERY'
      || role === 'SWARM'
      || role === 'DISRUPTOR'
      || role === 'ANCHOR_LINKED',
  );

  const normalFight = ctx.tier === 'NORMAL' && !ctx.highRisk;

  if (normalFight && abilityDisablers.length > 1) {
    issues.push({
      severity: 'error',
      code: 'DISABLE_STACK',
      message: `Too many ability-disablers in normal fight: ${abilityDisablers.join(', ')}`,
    });
  }

  if (normalFight && artillery.length > 1) {
    issues.push({
      severity: 'error',
      code: 'ARTILLERY_STACK',
      message: `Too many artillery threats in normal fight: ${artillery.join(', ')}`,
    });
  }

  if (normalFight && trueDamage.length > 1) {
    issues.push({
      severity: 'error',
      code: 'TRUE_DAMAGE_STACK',
      message: `Too many true-damage threats in normal fight: ${trueDamage.join(', ')}`,
    });
  }

  if (supports.length === keys.length) {
    issues.push({
      severity: 'error',
      code: 'SUPPORT_ONLY',
      message: 'Support-only fights are not allowed.',
    });
  }

  if (damageRoles.length === 0) {
    issues.push({
      severity: 'error',
      code: 'NO_DAMAGE_PATH',
      message: 'Encounter has no reasonable damage threat path.',
    });
  }

  for (const key of keys) {
    if (ctx.depth === 1 && isDepth3ExclusiveEnemy(key)) {
      issues.push({
        severity: 'error',
        code: 'D3_ON_D1',
        message: `Depth 3 exclusive ${key} cannot appear on Depth 1.`,
      });
    }
    if (enemyIsEchoSpecialOnly(key)) {
      issues.push({
        severity: 'error',
        code: 'ECHO_ORIGIN',
        message: `Echo-special ${key} cannot spawn via normal composition.`,
      });
    }
    const def = getEnemyDefinition(key);
    if (
      (key === 'CONCRETE_GARGOYLE' || key === 'WEEPING_GARGOYLE')
      && ctx.veilBiome
      && ctx.veilBiome !== 'NULL_ZONE'
    ) {
      issues.push({
        severity: 'error',
        code: 'GARGOYLE_BIOME',
        message: `${key} is Null Zone only (got ${ctx.veilBiome}).`,
      });
    }
    if (def && ctx.veilBiome && def.origin === 'VEIL' && !def.biomeTags.includes(ctx.veilBiome)) {
      issues.push({
        severity: 'warn',
        code: 'BIOME_MISMATCH',
        message: `${key} not tagged for ${ctx.veilBiome}.`,
      });
    }
  }

  const modifierCount = ctx.majorModifierCount ?? 0;
  if (modifierCount > 1 && !(ctx.depth === 3 && (ctx.tier === 'ELITE' || ctx.highRisk))) {
    issues.push({
      severity: 'error',
      code: 'MODIFIER_STACK',
      message: `Too many major modifiers (${modifierCount}) for this node.`,
    });
  }

  if (
    (ctx.riskLabel === 'HIGH_RISK' || ctx.riskLabel === 'ELITE' || ctx.riskLabel === 'APEX_WARNING')
    && (ctx.rewardTier === 'BASELINE' || !ctx.rewardTier)
  ) {
    issues.push({
      severity: 'error',
      code: 'REWARD_MISMATCH',
      message: 'High-risk / elite encounter must not use baseline/empty reward profile.',
    });
  }

  if (ctx.templateId) {
    const template = getEncounterCompositionTemplate(ctx.templateId);
    if (!template.allowedDepths.includes(ctx.depth)) {
      issues.push({
        severity: 'error',
        code: 'TEMPLATE_DEPTH',
        message: `Template ${ctx.templateId} not allowed at Depth ${ctx.depth}.`,
      });
    }
  }

  return issues;
}

export function compositionPassesFairness(
  keys: readonly EncounterEnemyKey[],
  ctx: CompositionFairnessContext,
): boolean {
  return validateCompositionFairness(keys, ctx).every((issue) => issue.severity !== 'error');
}
