import type {
  DeepVeilLawId,
  DepthIdentityState,
  EncounterModifierId,
  TwistedTemplateId,
  VeilDistortionId,
} from '../types/depthIdentity';
import type { ActiveIncursionState } from '../types/game';
import type { RunGenerationContext } from '../types/worldState';
import {
  ALL_DEEP_VEIL_LAW_IDS,
  ALL_VEIL_DISTORTION_IDS,
  DEEP_VEIL_LAW_DEFINITIONS,
  VEIL_DISTORTION_DEFINITIONS,
  getDepthIdentityScanBias,
} from './depthIdentityCatalog';
import {
  ALL_ENCOUNTER_MODIFIER_IDS,
  ENCOUNTER_MODIFIER_DEFINITIONS,
  getEncounterModifierDefinition,
} from './encounterModifierCatalog';
import {
  ALL_TWISTED_TEMPLATE_IDS,
  TWISTED_TEMPLATE_DEFINITIONS,
  getTwistedTemplateDefinition,
} from './twistedTemplateCatalog';
import {
  getDebugForcedEncounterModifier,
  setDebugForcedEncounterModifier,
} from './encounterModifierEngine';
import {
  getDebugForcedTwistedTemplate,
  setDebugForcedTwistedTemplate,
} from './twistedTemplateEngine';
import {
  debugPrintDepthEnemyVariants,
  validateDepthEnemyVariants,
  verifyDepthEnemyVariants,
} from './depthEnemyVariantValidationEngine';
import {
  debugPrintScannerLabelCertainty,
  validateScannerLabelCertainty,
  verifyScannerLabelCertainty,
} from './scannerLabelCertaintyValidationEngine';
import {
  validatePhaseGHardRules,
  debugForceDepthEnemyVariant,
  debugPrintBiomeDepthPools,
  debugPrintSectorDepthFlavor,
  debugSimulateDepthIdentityGeneration,
  debugListMissingTwistedTemplates,
  debugValidatePhaseG,
  getDebugForcedDepthEnemyVariant,
  maybeInjectForcedDepthVariant,
  verifyPhaseGHardRules,
} from './depthIdentityPhaseGDebugEngine';
import {
  applyVeilDistortionToState,
  formatVeilDistortionDebugLine,
  setDebugForcedVeilDistortion,
} from './veilDistortionEngine';
import {
  applyDeepVeilLawToState,
  formatDeepVeilLawDebugLine,
  setDebugForcedDeepVeilLaw,
} from './deepVeilLawEngine';
import { describeActiveDepthIdentity, resolveActiveDepthIdentityScanBias } from './depthIdentityEngine';

export interface DepthIdentityValidationIssue {
  severity: 'error' | 'warn';
  message: string;
}

export function validateDepthIdentityCatalog(): DepthIdentityValidationIssue[] {
  const issues: DepthIdentityValidationIssue[] = [];

  ALL_VEIL_DISTORTION_IDS.forEach((id) => {
    const def = VEIL_DISTORTION_DEFINITIONS[id];
    if (!def.displayName.trim() || !def.fantasy.trim() || !def.effectSummary.trim()) {
      issues.push({ severity: 'error', message: `Distortion ${id} is missing display copy.` });
    }
    if (def.favoredBiomes.length === 0) {
      issues.push({ severity: 'warn', message: `Distortion ${id} has no favored biomes.` });
    }
    if (def.intensifiesToLaw && !DEEP_VEIL_LAW_DEFINITIONS[def.intensifiesToLaw]) {
      issues.push({
        severity: 'error',
        message: `Distortion ${id} intensifies to unknown law ${def.intensifiesToLaw}.`,
      });
    }
  });

  ALL_DEEP_VEIL_LAW_IDS.forEach((id) => {
    const def = DEEP_VEIL_LAW_DEFINITIONS[id];
    if (!def.displayName.trim() || !def.fantasy.trim() || !def.effectSummary.trim()) {
      issues.push({ severity: 'error', message: `Law ${id} is missing display copy.` });
    }
  });

  ALL_ENCOUNTER_MODIFIER_IDS.forEach((id) => {
    const def = ENCOUNTER_MODIFIER_DEFINITIONS[id];
    if (!def.displayName.trim() || !def.fantasy.trim() || !def.telegraph.trim()) {
      issues.push({ severity: 'error', message: `Encounter modifier ${id} is missing display copy.` });
    }
    if (def.allowedDepths.length === 0 || def.eligibleNodeTypes.length === 0) {
      issues.push({
        severity: 'error',
        message: `Encounter modifier ${id} has empty depth or node eligibility.`,
      });
    }
    if (id === 'CORE_SICK' && def.allowedDepths.some((depth) => depth < 3)) {
      issues.push({
        severity: 'error',
        message: 'CORE_SICK must remain Depth 3 exclusive.',
      });
    }
  });

  ALL_TWISTED_TEMPLATE_IDS.forEach((id) => {
    const def = TWISTED_TEMPLATE_DEFINITIONS[id];
    if (!def.displayName.trim() || !def.fantasy.trim() || !def.telegraph.trim()) {
      issues.push({ severity: 'error', message: `Twisted template ${id} is missing display copy.` });
    }
    if (def.allowedDepths.length === 0 || def.eligibleNodeTypes.length === 0) {
      issues.push({
        severity: 'error',
        message: `Twisted template ${id} has empty depth or node eligibility.`,
      });
    }
    if (def.requiresChoice && def.options.length === 0) {
      issues.push({
        severity: 'error',
        message: `Twisted template ${id} requiresChoice but has no options.`,
      });
    }
    if (
      (id === 'ANCHOR_CORE_BREACH' || id === 'APEX_SHADOW' || id === 'FINAL_ROUTE_FRACTURE')
      && def.maxPerRun !== 1
    ) {
      issues.push({
        severity: 'error',
        message: `${id} must remain max 1 per run.`,
      });
    }
    if (id === 'APEX_SHADOW' && def.eligibleNodeTypes.includes('GATEKEEPER')) {
      issues.push({
        severity: 'error',
        message: 'APEX_SHADOW must not attach to GATEKEEPER/boss nodes.',
      });
    }
  });

  return issues;
}

export function validateDepthIdentityState(
  state: DepthIdentityState | null | undefined,
  district: 1 | 2 | 3,
): DepthIdentityValidationIssue[] {
  const issues: DepthIdentityValidationIssue[] = [];
  if (!state) return issues;

  if (district === 1 && (state.activeVeilDistortion || state.activeDeepVeilLaw)) {
    issues.push({
      severity: 'warn',
      message: 'Depth 1 Threshold should not keep active Distortion/Law identity.',
    });
  }
  if (district === 2 && state.activeDeepVeilLaw && !state.activeVeilDistortion) {
    issues.push({
      severity: 'warn',
      message: 'Deep Veil Law is active before Depth 2 Distortion.',
    });
  }
  if (state.intensifiedFromDistortion && !state.activeDeepVeilLaw) {
    issues.push({
      severity: 'error',
      message: 'intensifiedFromDistortion is set without an active Deep Veil Law.',
    });
  }
  if (
    state.intensifiedFromDistortion
    && state.activeVeilDistortion
    && state.activeDeepVeilLaw
  ) {
    const expected = VEIL_DISTORTION_DEFINITIONS[state.activeVeilDistortion].intensifiesToLaw;
    if (expected && expected !== state.activeDeepVeilLaw) {
      issues.push({
        severity: 'warn',
        message: `Intensified law ${state.activeDeepVeilLaw} does not match Distortion mapping ${expected}.`,
      });
    }
  }

  const seen = new Set(state.encounterModifiersSeen ?? []);
  (state.encounterModifiersCleared ?? []).forEach((id) => {
    if (!seen.has(id)) {
      issues.push({
        severity: 'warn',
        message: `Cleared encounter modifier ${id} was never marked seen.`,
      });
    }
  });

  const twistedSeen = new Set(state.twistedTemplatesSeen ?? []);
  (state.twistedTemplatesCleared ?? []).forEach((id) => {
    if (!twistedSeen.has(id)) {
      issues.push({
        severity: 'warn',
        message: `Cleared twisted template ${id} was never marked seen.`,
      });
    }
  });

  return issues;
}

export function formatDepthIdentityValidationReport(
  issues: DepthIdentityValidationIssue[],
): string {
  if (issues.length === 0) return 'DEPTH IDENTITY — no validation issues.';
  return [
    'DEPTH IDENTITY VALIDATION',
    ...issues.map((issue) => `[${issue.severity.toUpperCase()}] ${issue.message}`),
  ].join('\n');
}

export function debugForceVeilDistortion(id: VeilDistortionId | null): void {
  setDebugForcedVeilDistortion(id);
}

export function debugForceDeepVeilLaw(id: DeepVeilLawId | null): void {
  setDebugForcedDeepVeilLaw(id);
}

export function debugForceEncounterModifier(id: EncounterModifierId | null): void {
  setDebugForcedEncounterModifier(id);
}

export function debugForceTwistedTemplate(id: TwistedTemplateId | null): void {
  setDebugForcedTwistedTemplate(id);
}

export function debugPreviewDepthIdentity(
  incursion: Pick<ActiveIncursionState, 'depthIdentity' | 'currentDistrict' | 'runGenerationContext'>,
): string {
  const state = incursion.depthIdentity;
  const lines = [
    'DEPTH IDENTITY PREVIEW',
    `district: ${incursion.currentDistrict}`,
    ...describeActiveDepthIdentity(state),
  ];
  if (state?.pendingReveal) {
    lines.push(`pending reveal: ${state.pendingReveal.title}`);
  }
  if (state?.pendingTwistedChoice) {
    lines.push(`pending twisted choice: ${state.pendingTwistedChoice.templateId}`);
  }
  const forcedMod = getDebugForcedEncounterModifier();
  if (forcedMod) {
    lines.push(`forced next encounter modifier: ${forcedMod}`);
  }
  const forcedTwist = getDebugForcedTwistedTemplate();
  if (forcedTwist) {
    lines.push(`forced next twisted template: ${forcedTwist}`);
  }
  const bias = resolveActiveDepthIdentityScanBias(state, incursion.currentDistrict as 1 | 2 | 3);
  lines.push(
    `scan bias // echo×${bias.echoSignalMultiplier.toFixed(2)} anchor×${bias.anchorSignalMultiplier.toFixed(2)} risk×${bias.highRiskMultiplier.toFixed(2)} degrade=${bias.scannerLabelDegradeChance.toFixed(2)}`,
  );
  if (incursion.runGenerationContext) {
    lines.push(`sector: ${incursion.runGenerationContext.sectorState.displayName}`);
    lines.push(`anchor: ${incursion.runGenerationContext.activeAnchor?.displayName ?? 'none'}`);
    lines.push(`operation: ${incursion.runGenerationContext.activeOperation.title}`);
  }
  return lines.join('\n');
}

export function debugApplyForcedDistortionToState(
  state: DepthIdentityState | null | undefined,
  id: VeilDistortionId,
): DepthIdentityState {
  return applyVeilDistortionToState(state, id);
}

export function debugApplyForcedLawToState(
  state: DepthIdentityState | null | undefined,
  id: DeepVeilLawId,
  intensified = false,
): DepthIdentityState {
  return applyDeepVeilLawToState(state, id, intensified);
}

export function debugPrintDistortionCatalog(): string {
  return ALL_VEIL_DISTORTION_IDS.map((id) => formatVeilDistortionDebugLine(id)).join('\n\n');
}

export function debugPrintLawCatalog(): string {
  return ALL_DEEP_VEIL_LAW_IDS.map((id) => formatDeepVeilLawDebugLine(id)).join('\n\n');
}

export function debugPrintEncounterModifierCatalog(): string {
  return ALL_ENCOUNTER_MODIFIER_IDS.map((id) => {
    const def = getEncounterModifierDefinition(id);
    return [
      `${def.id} — ${def.displayName}`,
      def.telegraph,
      `depths: ${def.allowedDepths.join(',')}`,
      `nodes: ${def.eligibleNodeTypes.join(',')}`,
    ].join('\n');
  }).join('\n\n');
}

export function debugPrintTwistedTemplateCatalog(): string {
  return ALL_TWISTED_TEMPLATE_IDS.map((id) => {
    const def = getTwistedTemplateDefinition(id);
    return [
      `${def.id} — ${def.displayName}`,
      def.telegraph,
      `depths: ${def.allowedDepths.join(',')}`,
      `nodes: ${def.eligibleNodeTypes.join(',')}`,
      `choice: ${def.requiresChoice ? 'yes' : 'no'}`,
    ].join('\n');
  }).join('\n\n');
}

export function debugPrintDepthEnemyVariantCatalog(): string {
  return debugPrintDepthEnemyVariants();
}

export function debugValidateDepthEnemyVariants(): string {
  try {
    verifyDepthEnemyVariants();
    return 'OK — Phase E depth enemy variants valid.';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export function debugPrintScannerLabelCertaintyCatalog(): string {
  return debugPrintScannerLabelCertainty();
}

export function debugValidateScannerLabelCertainty(): string {
  try {
    verifyScannerLabelCertainty();
    return 'OK — Phase F scanner label certainty valid.';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export {
  debugForceDepthEnemyVariant,
  debugPrintBiomeDepthPools,
  debugPrintSectorDepthFlavor,
  debugSimulateDepthIdentityGeneration,
  debugListMissingTwistedTemplates,
  debugValidatePhaseG,
  getDebugForcedDepthEnemyVariant,
  maybeInjectForcedDepthVariant,
  validatePhaseGHardRules,
  verifyPhaseGHardRules,
};
export function debugValidateDepthIdentity(
  incursion?: Pick<ActiveIncursionState, 'depthIdentity' | 'currentDistrict'> | null,
  _runContext?: RunGenerationContext | null,
): string {
  const issues = [
    ...validateDepthIdentityCatalog(),
    ...validateDepthEnemyVariants().map((issue) => ({
      severity: 'error' as const,
      message: `[${issue.code}] ${issue.message}`,
    })),
    ...validateScannerLabelCertainty().map((issue) => ({
      severity: 'error' as const,
      message: `[${issue.code}] ${issue.message}`,
    })),
    ...validatePhaseGHardRules().map((issue) => ({
      severity: 'error' as const,
      message: `[${issue.code}] ${issue.message}`,
    })),
    ...(incursion
      ? validateDepthIdentityState(
        incursion.depthIdentity,
        incursion.currentDistrict as 1 | 2 | 3,
      )
      : []),
  ];
  getDepthIdentityScanBias('MEMORY_CONTAMINATION', 'THE_VEIL_REMEMBERS');
  return formatDepthIdentityValidationReport(issues);
}
