import { isEchoOverlayNodeTypeEligible } from './echoEncounterEngine';
import { echoKindResolvesImmediately, echoKindUsesNarrative } from './echoEncounterResolver';
import { ECHO_ELITE_CATALOG, getEchoEliteTemplate } from './echoEliteCatalog';
import { HOSTILE_ECHO_REWARD_PROFILE_IDS, HOSTILE_ECHO_REWARD_RESOURCE_IDS } from './echoRewardEngine';
import { resolveContributionRules } from './operationRulesEngine';
import { ALL_RESOURCE_ITEM_IDS } from './resourceRegistry';
import { resolveMaxEchoEncountersPerRun } from './worldStateHelpers';
import type { ResourceItemId } from '../types/resourceItem';
import type { ProceduralRunTree } from '../types/proceduralRunTree';

export interface EchoValidationIssue {
  severity: 'error' | 'warn';
  message: string;
}

export function validateEchoEncounterPipeline(
  tree?: ProceduralRunTree | null,
): EchoValidationIssue[] {
  const issues: EchoValidationIssue[] = [];

  const validResourceIds = new Set<ResourceItemId>(ALL_RESOURCE_ITEM_IDS);
  HOSTILE_ECHO_REWARD_RESOURCE_IDS.forEach((resourceId) => {
    if (!validResourceIds.has(resourceId)) {
      issues.push({
        severity: 'error',
        message: `Echo reward references unknown resource '${resourceId}'.`,
      });
    }
  });

  const echoRecoveryRules = resolveContributionRules('ECHO_RECOVERY');
  const hasEchoRecoveryPath = Object.values(echoRecoveryRules).some(
    (value) => typeof value === 'number' && value > 0,
  );
  if (!hasEchoRecoveryPath) {
    issues.push({
      severity: 'error',
      message: 'ECHO_RECOVERY operation has no contribution rules — echoes cannot advance it.',
    });
  }

  ECHO_ELITE_CATALOG.forEach((template) => {
    if (template.roster.length === 0) {
      issues.push({
        severity: 'error',
        message: `Hostile echo template ${template.id} has no combat roster.`,
      });
    }
    if (!getEchoEliteTemplate(template.id)) {
      issues.push({
        severity: 'error',
        message: `Hostile echo template ${template.id} failed catalog lookup.`,
      });
    }
    if (template.isClassEcho) {
      if (!template.sourceClass) {
        issues.push({
          severity: 'error',
          message: `Class echo template ${template.id} is missing sourceClass.`,
        });
      }
      if (!template.rewardProfileId) {
        issues.push({
          severity: 'error',
          message: `Class echo template ${template.id} is missing rewardProfileId.`,
        });
      } else if (!HOSTILE_ECHO_REWARD_PROFILE_IDS.includes(template.rewardProfileId)) {
        issues.push({
          severity: 'error',
          message: `Class echo template ${template.id} references unknown reward profile ${template.rewardProfileId}.`,
        });
      }
    }
  });

  if (tree?.modifierRollState) {
    const maxRun = resolveMaxEchoEncountersPerRun(false);
    if (tree.modifierRollState.echoSignalsUsed > maxRun) {
      issues.push({
        severity: 'error',
        message: `Echo signals used (${tree.modifierRollState.echoSignalsUsed}) exceeds run cap (${maxRun}).`,
      });
    }

    Object.entries(tree.modifierRollState.echoSignalsByDepth).forEach(([depth, count]) => {
      if (count > 1) {
        issues.push({
          severity: 'error',
          message: `Echo signals at depth ${depth} (${count}) exceeds per-depth cap.`,
        });
      }
    });

    Object.values(tree.nodes).forEach((node) => {
      if (node.echoOverlay && !isEchoOverlayNodeTypeEligible(node.type)) {
        issues.push({
          severity: 'error',
          message: `Echo overlay on unsupported node type ${node.type} (${node.id}).`,
        });
      }
      if (node.contextModifiers?.echoSignal && !node.contextModifiers.echoEncounterKind) {
        issues.push({
          severity: 'warn',
          message: `Node ${node.id} has echo signal without resolved encounter kind.`,
        });
      }
      const kind = node.contextModifiers?.echoEncounterKind;
      if (kind === 'HOSTILE_ECHO' && !node.contextModifiers?.echoTemplateId) {
        issues.push({
          severity: 'error',
          message: `Hostile echo on node ${node.id} has no combat template.`,
        });
      }
      if (kind && echoKindUsesNarrative(kind) && kind !== 'FALLEN_RUNNER_ECHO') {
        issues.push({
          severity: 'warn',
          message: `Echo kind ${kind} has no narrative resolver wired.`,
        });
      }
      if (kind && echoKindResolvesImmediately(kind) && kind !== 'ASSIST_ECHO'
        && kind !== 'CARGO_ECHO' && kind !== 'EXTRACTION_ECHO') {
        issues.push({
          severity: 'warn',
          message: `Echo kind ${kind} has no immediate resolver wired.`,
        });
      }
    });
  }

  return issues;
}
