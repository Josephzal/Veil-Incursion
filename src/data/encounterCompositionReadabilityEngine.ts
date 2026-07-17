import type {
  CompositionEnemyRole,
  EncounterCompositionPickMeta,
  EncounterCompositionTemplateId,
  EncounterRiskLabel,
  EncounterRewardTier,
  EncounterWarningCard,
} from '../types/encounterComposition';
import type { NodeContextModifiers } from '../types/worldState';
import type { EnemyCombatProfile } from '../types/run';
import {
  getEncounterCompositionTemplate,
} from './encounterCompositionTemplateCatalog';
import {
  getEnemyCompositionRole,
} from './enemyCompositionRoleCatalog';
import { ENCOUNTER_KEY_TO_ROSTER, type EncounterEnemyKey } from './enemyCombatConfig';
import { veilBiomeDisplayName } from './sectorBiomeBridge';

function rosterIdToEncounterKey(rosterId: string): EncounterEnemyKey | null {
  const entry = Object.entries(ENCOUNTER_KEY_TO_ROSTER).find(([, id]) => id === rosterId);
  return (entry?.[0] as EncounterEnemyKey | undefined) ?? null;
}

export function formatEncounterRiskLabel(label: EncounterRiskLabel): string {
  switch (label) {
    case 'LOW_RISK':
      return 'LOW RISK';
    case 'STANDARD':
      return 'STANDARD';
    case 'ELEVATED':
      return 'ELEVATED';
    case 'HIGH_RISK':
      return 'HIGH RISK';
    case 'ELITE':
      return 'ELITE';
    case 'APEX_WARNING':
      return 'APEX WARNING';
    default:
      return 'STANDARD';
  }
}

export function formatCompositionRoleLabel(role: CompositionEnemyRole): string {
  return role.replace(/_/g, ' ');
}

export function resolveEncounterRewardTier(args: {
  templateId?: EncounterCompositionTemplateId | null;
  depth: 1 | 2 | 3;
  isElite?: boolean;
  highRisk?: boolean;
  highValue?: boolean;
  anchorSignal?: boolean;
  echoSignal?: boolean;
  twistedTemplate?: string | null;
}): EncounterRewardTier {
  if (args.templateId) {
    const base = getEncounterCompositionTemplate(args.templateId).defaultRewardTier;
    if (args.depth === 3 && (args.highRisk || args.isElite || args.anchorSignal)) {
      if (base === 'HIGH_VALUE' || base === 'RARE') return args.highRisk ? 'APEX_CHANCE' : 'RARE';
    }
    return base;
  }
  if (args.depth === 3 && (args.highRisk || args.isElite)) return 'RARE';
  if (args.isElite || args.highRisk) return 'HIGH_VALUE';
  if (args.highValue || args.anchorSignal || args.echoSignal || args.twistedTemplate) {
    return 'IMPROVED';
  }
  if (args.depth === 1) return 'BASELINE';
  return 'IMPROVED';
}

export function resolveEncounterRiskLabel(args: {
  depth: 1 | 2 | 3;
  isElite?: boolean;
  highRisk?: boolean;
  highValue?: boolean;
  anchorSignal?: boolean;
  echoSignal?: boolean;
  hasModifier?: boolean;
  hasTwisted?: boolean;
  templateId?: EncounterCompositionTemplateId | null;
  rewardTier?: EncounterRewardTier | null;
}): EncounterRiskLabel {
  const template = args.templateId
    ? getEncounterCompositionTemplate(args.templateId)
    : null;

  if (
    args.depth === 3
    && (args.highRisk || template?.id === 'HIGH_RISK_CARGO_GUARD' || args.hasTwisted)
  ) {
    return 'APEX_WARNING';
  }
  if (args.isElite || template?.id === 'ELITE_NEST') return 'ELITE';
  if (args.highRisk || template?.id === 'HIGH_RISK_CARGO_GUARD') return 'HIGH_RISK';
  if (
    args.hasModifier
    || args.hasTwisted
    || args.anchorSignal
    || args.echoSignal
    || args.highValue
    || template?.requiresWarningCard
    || args.rewardTier === 'HIGH_VALUE'
    || args.rewardTier === 'RARE'
  ) {
    return 'ELEVATED';
  }
  if (args.depth === 1 && !args.isElite) return 'STANDARD';
  return 'STANDARD';
}

export function formatEncounterRewardPreview(
  tier: EncounterRewardTier,
  templateId?: EncounterCompositionTemplateId | null,
): string {
  if (templateId === 'ECHO_CONTAMINATED') {
    return 'Echo-Glass chance + Echo Recovery progress if relevant';
  }
  if (templateId === 'ANCHOR_PATROL') {
    return 'Anchor Assault progress + improved resource chance';
  }
  if (templateId === 'RESOURCE_GUARD') {
    return 'Improved stable resource cache';
  }
  if (templateId === 'ARTILLERY_KILLBOX') {
    return 'Elevated credits + sector tech/material chance';
  }
  if (templateId === 'HIGH_RISK_CARGO_GUARD') {
    return 'High chance of unstable / rare cargo';
  }
  if (templateId === 'ELITE_NEST') {
    return 'Credits + rare resource chance (boon if elite supports it)';
  }
  switch (tier) {
    case 'BASELINE':
      return 'Baseline credits + small common material chance';
    case 'IMPROVED':
      return 'Improved stable resource cache';
    case 'HIGH_VALUE':
      return 'High-value resource / credits cache';
    case 'RARE':
      return 'Rare cargo chance';
    case 'APEX_CHANCE':
      return 'Apex-tier cargo chance (marked high-risk)';
    default:
      return 'Standard combat salvage';
  }
}

export function rolesFromCombatProfiles(
  enemies: readonly Pick<EnemyCombatProfile, 'rosterId'>[],
): CompositionEnemyRole[] {
  const roles: CompositionEnemyRole[] = [];
  for (const enemy of enemies) {
    if (!enemy.rosterId) continue;
    const key = rosterIdToEncounterKey(enemy.rosterId);
    if (!key) continue;
    const primary = getEnemyCompositionRole(key)?.primaryRole;
    if (primary && !roles.includes(primary)) roles.push(primary);
  }
  return roles;
}

export function shouldShowEncounterWarningCard(args: {
  templateId?: EncounterCompositionTemplateId | null;
  isElite?: boolean;
  highRisk?: boolean;
  hasModifier?: boolean;
  hasTwisted?: boolean;
  anchorSignal?: boolean;
  depth: 1 | 2 | 3;
  riskLabel: EncounterRiskLabel;
}): boolean {
  // Elite combat enters immediately — no "Elite Contact" threat-brief popup.
  if (args.isElite || args.riskLabel === 'ELITE') return false;

  if (args.templateId) {
    const template = getEncounterCompositionTemplate(args.templateId);
    if (template.requiresWarningCard) return true;
  }
  if (args.hasModifier || args.hasTwisted) return true;
  if (args.highRisk) return true;
  if (args.anchorSignal && args.depth >= 2) return true;
  if (
    args.riskLabel === 'HIGH_RISK'
    || args.riskLabel === 'APEX_WARNING'
    || args.riskLabel === 'ELEVATED'
  ) {
    if (args.depth === 1 && !args.hasModifier && !args.highRisk) {
      return false;
    }
    return true;
  }
  return false;
}

export function buildEncounterWarningCard(args: {
  composition?: EncounterCompositionPickMeta | null;
  depth: 1 | 2 | 3;
  veilBiome?: import('../types/encounterSpawn').VeilBiome | null;
  mods?: NodeContextModifiers | null;
  isElite?: boolean;
  enemyRoles?: CompositionEnemyRole[];
  sectorDisplayName?: string | null;
  optionalBack?: boolean;
}): EncounterWarningCard {
  const mods = args.mods ?? null;
  const templateId = args.composition?.templateId
    ?? mods?.compositionTemplateId
    ?? null;
  const template = templateId ? getEncounterCompositionTemplate(templateId) : null;
  const rewardTier = args.composition?.rewardTier
    ?? mods?.compositionRewardTier
    ?? resolveEncounterRewardTier({
      templateId,
      depth: args.depth,
      isElite: args.isElite,
      highRisk: mods?.highRisk,
      highValue: mods?.highValueResource,
      anchorSignal: mods?.anchorSignal,
      echoSignal: mods?.echoSignal,
      twistedTemplate: mods?.twistedTemplate,
    });
  const riskLabel = mods?.compositionRiskLabel ?? resolveEncounterRiskLabel({
    depth: args.depth,
    isElite: args.isElite,
    highRisk: mods?.highRisk,
    highValue: mods?.highValueResource,
    anchorSignal: mods?.anchorSignal,
    echoSignal: mods?.echoSignal,
    hasModifier: Boolean(mods?.encounterModifier),
    hasTwisted: Boolean(mods?.twistedTemplate),
    templateId,
    rewardTier,
  });
  const roles = args.enemyRoles
    ?? args.composition?.rolesUsed
    ?? (mods?.compositionRolePreview ? [...mods.compositionRolePreview] : []);

  const overlays: string[] = [];
  if (mods?.anchorSignal) overlays.push('Anchor Signal');
  if (mods?.echoSignal) overlays.push(mods.echoSignalLabel ?? 'Echo Residue');
  if (mods?.highRisk) overlays.push('High-Risk Zone');
  if (mods?.highValueResource) overlays.push('High-Value Resource');
  if (mods?.operationTag) overlays.push(`Op // ${mods.operationTag.replace(/_/g, ' ')}`);

  return {
    templateId,
    encounterName: template?.name ?? (args.isElite ? 'Elite Contact' : 'Hostile Contact'),
    riskLabel,
    depth: args.depth,
    sectorLabel: args.sectorDisplayName
      ?? (args.veilBiome ? veilBiomeDisplayName(args.veilBiome) : null),
    modifierLabel: mods?.encounterModifierLabel
      ? `${mods.encounterModifierLabel}${mods.encounterModifierSummary ? ` — ${mods.encounterModifierSummary}` : ''}`
      : null,
    twistedLabel: mods?.twistedTemplateLabel
      ? `${mods.twistedTemplateLabel}${mods.twistedTemplateSummary ? ` — ${mods.twistedTemplateSummary}` : ''}`
      : null,
    overlays,
    enemyRoles: roles,
    rewardPreview: mods?.compositionRewardPreview
      ?? formatEncounterRewardPreview(rewardTier, templateId),
    operationRelevance: mods?.operationTag
      ? `${mods.operationTag.replace(/_/g, ' ')} relevance detected`
      : null,
    warningText: template?.warningSummary
      ?? mods?.compositionWarningSummary
      ?? 'Elevated threat profile — confirm breach.',
    optionalBack: args.optionalBack !== false,
  };
}

export function stampCompositionReadability(
  mods: NodeContextModifiers | null | undefined,
  args: {
    composition?: EncounterCompositionPickMeta | null;
    depth: 1 | 2 | 3;
    isElite?: boolean;
    enemyRoles?: CompositionEnemyRole[];
  },
): NodeContextModifiers | null {
  if (!mods) return null;
  const templateId = args.composition?.templateId ?? mods.compositionTemplateId ?? null;
  const rewardTier = args.composition?.rewardTier ?? resolveEncounterRewardTier({
    templateId,
    depth: args.depth,
    isElite: args.isElite,
    highRisk: mods.highRisk,
    highValue: mods.highValueResource,
    anchorSignal: mods.anchorSignal,
    echoSignal: mods.echoSignal,
    twistedTemplate: mods.twistedTemplate,
  });
  const riskLabel = resolveEncounterRiskLabel({
    depth: args.depth,
    isElite: args.isElite,
    highRisk: mods.highRisk,
    highValue: mods.highValueResource,
    anchorSignal: mods.anchorSignal,
    echoSignal: mods.echoSignal,
    hasModifier: Boolean(mods.encounterModifier),
    hasTwisted: Boolean(mods.twistedTemplate),
    templateId,
    rewardTier,
  });
  const roles = args.enemyRoles
    ?? args.composition?.rolesUsed
    ?? (mods.compositionRolePreview ? [...mods.compositionRolePreview] : []);
  const template = templateId ? getEncounterCompositionTemplate(templateId) : null;

  return {
    ...mods,
    compositionTemplateId: templateId ?? undefined,
    compositionRiskLabel: riskLabel,
    compositionRewardTier: rewardTier,
    compositionRolePreview: roles,
    compositionRewardPreview: formatEncounterRewardPreview(rewardTier, templateId),
    compositionWarningSummary: template?.warningSummary,
  };
}

export function formatScannerRiskCategorySuffix(risk?: EncounterRiskLabel | null): string {
  if (!risk) return '';
  return ` — ${formatEncounterRiskLabel(risk)}`;
}
