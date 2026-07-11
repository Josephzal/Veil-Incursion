import type { SelectedContractState } from '../types/contract';
import type {
  ExpeditionKeepsakeDefinition,
  KeepsakeAttunement,
  KeepsakeDeployment,
  KeepsakeDeploymentChoiceSpec,
  KeepsakeId,
  KeepsakeMirrorCategory,
  KeepsakeRouteDoctrine,
  KeepsakeRuntime,
} from '../types/expeditionKeepsake';
import type { SectorState } from '../types/worldState';
import { getKeepsakeDefinition } from './expeditionKeepsakeRegistry';
import { appendKeepsakeDecision } from './keepsakeRunState';

export interface KeepsakeDeploymentWarning {
  severity: 'warn' | 'info';
  message: string;
}

const ATTUNEMENT_LABELS: Record<KeepsakeAttunement, string> = {
  HIGH_VALUE_RESOURCE: 'High-Value Resource',
  ECHO_RESIDUE: 'Echo Residue',
  ANCHOR_SIGNAL: 'Anchor Signal',
  EXTRACTION: 'Extraction',
  OPERATION_TARGET: 'Operation Target',
};

const DOCTRINE_LABELS: Record<KeepsakeRouteDoctrine, string> = {
  SAFE: 'Safe Route',
  GREED: 'Greed Route',
  HUNT: 'Hunt Route',
};

const MIRROR_LABELS: Record<KeepsakeMirrorCategory, string> = {
  CREDITS: 'Credits',
  SPONSOR_REP: 'Sponsor Reputation',
  OPERATION_PROGRESS: 'Operation Progress',
  RESOURCE_PAYOUT: 'Resource Payout',
};

export function formatKeepsakeAttunementLabel(value: KeepsakeAttunement): string {
  return ATTUNEMENT_LABELS[value];
}

export function formatKeepsakeRouteDoctrineLabel(value: KeepsakeRouteDoctrine): string {
  return DOCTRINE_LABELS[value];
}

export function formatKeepsakeMirrorCategoryLabel(value: KeepsakeMirrorCategory): string {
  return MIRROR_LABELS[value];
}

export function getKeepsakeDeploymentChoiceValue(
  deployment: KeepsakeDeployment,
  choice: KeepsakeDeploymentChoiceSpec,
): string | null {
  switch (choice.kind) {
    case 'attunement':
      return deployment.attunement;
    case 'route_doctrine':
      return deployment.routeDoctrine;
    case 'mirror_category':
      return deployment.mirrorCategory;
    default:
      return null;
  }
}

export function formatKeepsakeDeploymentOptionLabel(
  keepsakeId: KeepsakeId,
  deployment: KeepsakeDeployment,
): string | null {
  const def = getKeepsakeDefinition(keepsakeId);
  if (!def.deploymentChoice) return null;
  const value = getKeepsakeDeploymentChoiceValue(deployment, def.deploymentChoice);
  if (!value) return null;
  const option = def.deploymentChoice.options.find((entry) => entry.value === value);
  return option?.label ?? value.replace(/_/g, ' ');
}

export function isKeepsakeDeploymentConfigured(
  keepsakeId: KeepsakeId,
  deployment: KeepsakeDeployment,
): boolean {
  const def = getKeepsakeDefinition(keepsakeId);
  if (!def.deploymentChoice) return true;
  return getKeepsakeDeploymentChoiceValue(deployment, def.deploymentChoice) != null;
}

/** Context-aware deployment warnings shown when inspecting or equipping a relic. */
export function resolveKeepsakeDeploymentWarnings(
  keepsakeId: KeepsakeId,
  sector: SectorState,
  selectedContract: SelectedContractState,
): KeepsakeDeploymentWarning[] {
  const def = getKeepsakeDefinition(keepsakeId);
  const warnings: KeepsakeDeploymentWarning[] = [];

  if (def.deploymentWarning) {
    warnings.push({ severity: 'warn', message: def.deploymentWarning });
  }

  const hasSponsor = selectedContract.kind === 'SPONSOR';
  if ((keepsakeId === 'contract_seal' || keepsakeId === 'mirror_writ') && !hasSponsor) {
    warnings.push({
      severity: 'warn',
      message: 'No sponsor contract selected — sponsor-linked relic effects will not trigger this run.',
    });
  }

  if (keepsakeId === 'anchor_charm' && !sector.activeAnchor) {
    warnings.push({
      severity: 'warn',
      message: `No active Anchor in ${sector.displayName} — trail bonuses may be limited to scanner readability.`,
    });
  }

  if (keepsakeId === 'mourners_bell' && sector.echoActivity === 'LOW') {
    warnings.push({
      severity: 'warn',
      message: 'Echo activity is low in this sector — bell bias may have reduced impact.',
    });
  }

  if (keepsakeId === 'smugglers_wrap') {
    const contrabandFocus = sector.resourceFocus.some((focus) => focus.toUpperCase().includes('CONTRABAND'));
    if (!contrabandFocus && sector.rewardLevel < 2) {
      warnings.push({
        severity: 'info',
        message: 'Contraband opportunities may be sparse in this sector.',
      });
    }
  }

  if (keepsakeId === 'signal_compass' && sector.activeOperation.lifecycleStatus !== 'ACTIVE') {
    warnings.push({
      severity: 'info',
      message: 'Operation progress is locked — Operation Target attunement may not apply this run.',
    });
  }

  return warnings;
}

export function formatKeepsakeRoleLine(def: ExpeditionKeepsakeDefinition): string {
  return def.tags.slice(0, 4).join(' · ');
}

export function recordKeepsakeDeploymentDecisions(runtime: KeepsakeRuntime): KeepsakeRuntime {
  const def = getKeepsakeDefinition(runtime.keepsakeId);
  let next = runtime;

  if (runtime.deployment.attunement) {
    next = appendKeepsakeDecision(next, {
      key: 'attunement',
      label: 'Signal attunement',
      value: formatKeepsakeAttunementLabel(runtime.deployment.attunement),
    });
  }

  if (runtime.deployment.routeDoctrine) {
    next = appendKeepsakeDecision(next, {
      key: 'route_doctrine',
      label: 'Route doctrine',
      value: formatKeepsakeRouteDoctrineLabel(runtime.deployment.routeDoctrine),
    });
  }

  if (runtime.deployment.mirrorCategory) {
    next = appendKeepsakeDecision(next, {
      key: 'mirror_category',
      label: 'Mirrored category',
      value: formatKeepsakeMirrorCategoryLabel(runtime.deployment.mirrorCategory),
    });
  }

  if (def.deploymentChoice && !isKeepsakeDeploymentConfigured(runtime.keepsakeId, runtime.deployment)) {
    next = appendKeepsakeDecision(next, {
      key: 'deployment_unconfigured',
      label: 'Deployment',
      value: 'No pre-run configuration selected',
    });
  }

  return next;
}
