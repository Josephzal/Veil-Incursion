import type {
  ContractBonusObjective,
  ContractExtractionKind,
  ContractObjectiveKind,
  GeneratedContract,
  SelectedContractState,
} from '../types/contract';
import type { ContractSourceKind } from '../types/contractProcedural';
import type { BreachGradeId } from '../types/progression';
import type { SectorId } from '../types/worldState';
import { SOURCE_REASON_LABELS } from '../data/contractTemplateVariants';
import { ALL_SECTOR_IDS } from '../data/sectorBiomeBridge';
import { canResourceSpawnInSector, getResourceDisplayName } from '../data/resourceRegistry';
import { contractMeetsBreachGrade, formatBreachGradeLabel } from '../data/breachGradeEngine';

const RESOURCE_OBJECTIVE_KINDS = new Set<ContractObjectiveKind>([
  'EXTRACT_STABLE_RESOURCE',
  'EXTRACT_SPONSOR_RESOURCE',
  'RECOVER_INTEL',
  'RECOVER_ECONOMY_INTEL',
  'EXTRACT_UNSTABLE_CARGO',
  'RECOVER_APEX_CARGO',
  'RECOVER_CONTRABAND',
]);

function isDeliveryObjective(kind: ContractObjectiveKind): boolean {
  return RESOURCE_OBJECTIVE_KINDS.has(kind);
}

export type ContractSectorCompatibility = 'RECOMMENDED' | 'VALID' | 'UNAVAILABLE' | 'NONE';

export function getContractSectorCompatibility(
  contract: GeneratedContract | null,
  sectorId: SectorId,
): ContractSectorCompatibility {
  if (!contract) return 'NONE';

  if (contract.objectiveKind === 'COMPLETE_EMERGENCY_RECALL'
    || contract.objectiveKind === 'DEFEAT_ELITE'
    || contract.objectiveKind === 'DEFEAT_DEPTH_BOSS'
    || contract.objectiveKind === 'REACH_DEPTH_AND_EXTRACT'
    || contract.objectiveKind === 'CLEAR_OPERATION_TARGET') {
    return contract.recommendedSectorIds.includes(sectorId) ? 'RECOMMENDED' : 'VALID';
  }

  const resourceIds = contract.targetResourceOptions?.length
    ? contract.targetResourceOptions
    : contract.targetResourceId
      ? [contract.targetResourceId]
      : [];

  if (resourceIds.length === 0) return 'VALID';

  const canComplete = resourceIds.some((resourceId) => canResourceSpawnInSector(resourceId, sectorId));
  if (!canComplete) return 'UNAVAILABLE';

  if (contract.recommendedSectorIds.includes(sectorId)) return 'RECOMMENDED';
  if (contract.validSectorIds.includes(sectorId)) return 'VALID';
  return 'UNAVAILABLE';
}

export function getSelectedContractForCompatibility(
  selected: SelectedContractState,
): GeneratedContract | null {
  return selected.kind === 'SPONSOR' ? selected.contract : null;
}

export function contractSectorWarning(
  compatibility: ContractSectorCompatibility,
): string | null {
  switch (compatibility) {
    case 'UNAVAILABLE':
      // Source of truth: extract objectives resolve FAILED when required targets
      // cannot spawn in-sector (see contractResolver.evaluateContractOutcome).
      return 'This sector cannot complete the selected contract. Deployment is allowed; extracting here will fail the contract unless abandoned.';
    case 'VALID':
      return 'Valid // not ideal for contract.';
    default:
      return null;
  }
}

/** Concise consequence for incompatible-sector deployment authorization. */
export function formatIncompatibleContractDeployConsequence(
  contract: GeneratedContract,
  sectorDisplayName: string,
): string {
  const sector = sectorDisplayName.replace(/^The\s+/i, '');
  return `Deploying to ${sector} will fail ${contract.title}.`;
}

/** Hard-gate deploy when selected Breach Grade is below the contract minimum. */
export function contractBreachGradeWarning(
  selectedGrade: BreachGradeId,
  minGrade: BreachGradeId | null | undefined,
): string | null {
  if (!minGrade) return null;
  if (contractMeetsBreachGrade(selectedGrade, minGrade)) return null;
  return `Contract requires ${formatBreachGradeLabel(minGrade, true)}+. Raise grade or abandon contract.`;
}

export function formatContractRewardSummary(contract: GeneratedContract): string {
  const parts = [`+${contract.reward.credits} CR`, `+${contract.reward.reputation} REP`];
  if (contract.reward.rareLootBonusPct) {
    parts.push(`+${contract.reward.rareLootBonusPct}% rare loot`);
  }
  return parts.join(' // ');
}

/** Compact payout line for the Veil Front dossier (no rare-loot footnotes). */
export function formatCompactContractPayout(contract: GeneratedContract): string {
  return `${contract.reward.credits} CR · ${contract.reward.reputation} REP`;
}

function sectorIdDisplayLabel(sectorId: SectorId): string {
  return sectorId
    .replace(/^THE_/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Concise one-line objective for dossier deployment context. */
export function formatCompactContractObjective(contract: GeneratedContract): string {
  const raw = contract.objectiveText?.trim() ?? '';
  if (raw.length > 0 && raw.length <= 78) return raw;

  if (contract.targetResourceId && contract.targetQuantity > 0) {
    const resourceName = contract.targetResourceId
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return `Recover and deliver ${contract.targetQuantity}× ${resourceName}`;
  }

  if (raw.length > 78) {
    const cut = raw.slice(0, 75).replace(/\s+\S*$/, '');
    return cut.length > 40 ? `${cut}…` : `${raw.slice(0, 75)}…`;
  }

  return contract.title;
}

/** Valid-sector eligibility line for incompatible dossier summary. */
export function formatCompactContractValidSectors(contract: GeneratedContract): string {
  const detail = formatContractSectorEligibilityDetailed(contract);
  return detail === 'Any sector' ? 'Valid sectors: Any sector' : `Valid sectors: ${detail}`;
}

function contractEligibleSectorIds(contract: GeneratedContract): readonly SectorId[] {
  return contract.validSectorIds.length > 0
    ? contract.validSectorIds
    : contract.recommendedSectorIds;
}

function isAnySectorEligible(contract: GeneratedContract): boolean {
  const ids = contractEligibleSectorIds(contract);
  if (ids.length === 0) return true;
  if (ids.length >= ALL_SECTOR_IDS.length) return true;
  const set = new Set(ids);
  return ALL_SECTOR_IDS.every((id) => set.has(id));
}

/** Compact feed eligibility: ANY SECTOR or N VALID SECTORS. */
export function formatContractSectorEligibilityCompact(contract: GeneratedContract): string {
  if (isAnySectorEligible(contract)) return 'ANY SECTOR';
  const count = contractEligibleSectorIds(contract).length;
  return `${count} VALID SECTOR${count === 1 ? '' : 'S'}`;
}

/** Dossier eligibility: "Any sector" or named list. */
export function formatContractSectorEligibilityDetailed(contract: GeneratedContract): string {
  if (isAnySectorEligible(contract)) return 'Any sector';
  const ids = contractEligibleSectorIds(contract);
  if (ids.length === 0) return 'Any sector';
  return ids.map(sectorIdDisplayLabel).join(' · ');
}

export function formatContractFulfillmentCompact(contract: GeneratedContract): string {
  return isDeliveryObjective(contract.objectiveKind) ? 'POST-RUN DELIVERY' : 'IN-RUN';
}

export function formatContractFulfillmentDetailed(contract: GeneratedContract): string {
  return isDeliveryObjective(contract.objectiveKind)
    ? 'Post-run sponsor handoff'
    : 'Completed during the run';
}

export function formatContractDepthCompact(contract: GeneratedContract): string | null {
  if (!contract.requiredDepth) return null;
  return `DEPTH ${contract.requiredDepth}+`;
}

/** Plain ledger depth value for the dossier. */
export function formatContractDepthLedger(contract: GeneratedContract): string | null {
  if (!contract.requiredDepth) return null;
  return `Depth ${contract.requiredDepth}`;
}

/** Cargo / target resource line for the operational ledger, when applicable. */
export function formatContractCargoLedger(contract: GeneratedContract): string | null {
  const resourceId = contract.targetResourceId ?? contract.targetResourceOptions?.[0];
  if (!resourceId) return null;
  return getResourceDisplayName(resourceId);
}

export type SpecialConditionField = {
  label: string;
  value: string;
};

function formatBonusObjectiveLabel(kind: ContractBonusObjective['kind']): string {
  switch (kind) {
    case 'SAFE_EXTRACTION':
      return 'REQUIREMENT';
    case 'EARLY_EXTRACTION':
      return 'EXTRACTION BONUS';
    case 'ELITE_KILL':
      return 'TRIGGER';
    case 'DEPTH_EXTRACT':
      return 'TRIGGER';
    case 'ANOMALY_CLEAR':
      return 'TRIGGER';
    default:
      return 'CONDITION';
  }
}

/**
 * Unconditional active-contract provisions (employer package perks).
 */
export function resolveContractProvisions(
  runBenefits: readonly string[],
): string[] {
  return runBenefits
    .filter((line) => line !== 'Standard sponsor terms')
    .slice(0, 3);
}

/**
 * Conditional special-condition fields from structured bonus objectives only.
 * Unconditional perks belong in resolveContractProvisions.
 */
export function resolveSpecialConditionFields(
  contract: GeneratedContract,
): { fields: SpecialConditionField[]; fallbackText: string | null } {
  const fields: SpecialConditionField[] = [];

  if (contract.bonusObjective) {
    fields.push({
      label: formatBonusObjectiveLabel(contract.bonusObjective.kind),
      value: contract.bonusObjective.text,
    });
  }

  return { fields, fallbackText: null };
}

/** @deprecated Prefer resolveContractProvisions + resolveSpecialConditionFields. */
export function resolveContractClauseSections(
  contract: GeneratedContract,
  runBenefits: readonly string[],
): {
  provisions: string[];
  specialConditions: SpecialConditionField[];
} {
  return {
    provisions: resolveContractProvisions(runBenefits),
    specialConditions: resolveSpecialConditionFields(contract).fields,
  };
}

/** Category line for feed/dossier headers: RESOURCE, DEPTH 1+, EXTRACTION, etc. */
export function formatContractCategoryLabel(contract: GeneratedContract): string {
  if (contract.requiredDepth) return `DEPTH ${contract.requiredDepth}+`;
  const job = formatContractJobType(contract.objectiveKind);
  return job === 'DEPTH' ? 'DEPTH CONTRACT' : job;
}

export function formatContractIssuerCategory(contract: GeneratedContract): string {
  return `${sponsorDisplayName(contract.sponsorId).toUpperCase()} // ${formatContractCategoryLabel(contract)}`;
}

/** Compact mechanical requirement fragment for feed rows (not narrative). */
export function formatContractRowRequirement(contract: GeneratedContract): string | null {
  switch (contract.objectiveKind) {
    case 'EXTRACT_STABLE_RESOURCE':
    case 'EXTRACT_SPONSOR_RESOURCE':
    case 'EXTRACT_UNSTABLE_CARGO':
    case 'RECOVER_APEX_CARGO':
    case 'RECOVER_CONTRABAND':
    case 'RECOVER_INTEL':
    case 'RECOVER_ECONOMY_INTEL': {
      const qty = Math.max(1, contract.targetQuantity || 1);
      const resourceId = contract.targetResourceId ?? contract.targetResourceOptions?.[0];
      if (!resourceId) return `RECOVER ${qty}`;
      return `RECOVER ${qty}× ${getResourceDisplayName(resourceId).toUpperCase()}`;
    }
    case 'DEFEAT_ELITE': {
      const n = Math.max(1, contract.requiredEliteKills ?? 1);
      return `DEFEAT ${n} ELITE${n > 1 ? 'S' : ''}`;
    }
    case 'DEFEAT_DEPTH_BOSS':
      return 'DEFEAT DEPTH BOSS';
    case 'COMPLETE_EMERGENCY_RECALL':
      return 'EMERGENCY RECALL';
    case 'REACH_DEPTH_AND_EXTRACT':
      return contract.requiredDepth
        ? `REACH DEPTH ${contract.requiredDepth}+`
        : 'REACH DEPTH';
    case 'CLEAR_OPERATION_TARGET': {
      const n = Math.max(1, contract.requiredOperationTargets ?? 1);
      return `CLEAR ${n} TARGET${n > 1 ? 'S' : ''}`;
    }
    default:
      return null;
  }
}

/** Single compact metadata line for contract feed comparison. */
export function formatContractRowMetaLine(contract: GeneratedContract): string {
  const parts = [
    formatContractRowRequirement(contract),
    formatContractSectorEligibilityCompact(contract),
    formatContractDepthCompact(contract),
    formatContractFulfillmentCompact(contract),
  ].filter(Boolean) as string[];
  // Avoid repeating depth if requirement already encodes it.
  const deduped = parts.filter((part, index) => {
    if (index === 0) return true;
    const req = parts[0] ?? '';
    if (part.startsWith('DEPTH ') && req.includes('DEPTH')) return false;
    return true;
  });
  return deduped.join(' · ');
}

/**
 * Plain-language mechanical completion requirement for the dossier Objective.
 * Uses structured contract fields; falls back to objectiveText only when needed.
 */
export function formatMechanicalObjective(contract: GeneratedContract): string {
  const depthSuffix = contract.requiredDepth
    ? ` at Depth ${contract.requiredDepth} or deeper`
    : '';

  switch (contract.objectiveKind) {
    case 'EXTRACT_STABLE_RESOURCE':
    case 'EXTRACT_SPONSOR_RESOURCE':
    case 'EXTRACT_UNSTABLE_CARGO':
    case 'RECOVER_APEX_CARGO':
    case 'RECOVER_CONTRABAND':
    case 'RECOVER_INTEL':
    case 'RECOVER_ECONOMY_INTEL': {
      const qty = Math.max(1, contract.targetQuantity || 1);
      const resourceId = contract.targetResourceId ?? contract.targetResourceOptions?.[0];
      const name = resourceId ? getResourceDisplayName(resourceId) : 'the required cargo';
      const deliver = isDeliveryObjective(contract.objectiveKind)
        ? ' and deliver it to the sponsor after the run'
        : '';
      return `Recover ${qty}× ${name}${depthSuffix}${deliver}.`;
    }
    case 'DEFEAT_ELITE': {
      const n = Math.max(1, contract.requiredEliteKills ?? 1);
      return `Defeat ${n} elite encounter${n > 1 ? 's' : ''}${depthSuffix}.`;
    }
    case 'DEFEAT_DEPTH_BOSS':
      return `Defeat the depth boss${depthSuffix || ' at the required depth'}.`;
    case 'COMPLETE_EMERGENCY_RECALL':
      return 'Complete an emergency recall extraction to fulfill this mandate.';
    case 'REACH_DEPTH_AND_EXTRACT':
      return contract.requiredDepth
        ? `Reach Depth ${contract.requiredDepth} or deeper and extract successfully.`
        : 'Reach the required depth and extract successfully.';
    case 'CLEAR_OPERATION_TARGET': {
      const n = Math.max(1, contract.requiredOperationTargets ?? 1);
      return `Clear ${n} operation target${n > 1 ? 's' : ''}${depthSuffix}.`;
    }
    default:
      break;
  }

  const raw = contract.objectiveText?.trim();
  return raw && raw.length > 0 ? raw : contract.title;
}

export function formatDeploymentContractStatus(
  compatibility: ContractSectorCompatibility,
): 'COMPATIBLE' | 'INCOMPATIBLE' | 'NEUTRAL' {
  if (compatibility === 'UNAVAILABLE') return 'INCOMPATIBLE';
  if (compatibility === 'RECOMMENDED' || compatibility === 'VALID') return 'COMPATIBLE';
  return 'NEUTRAL';
}

export function formatExtractionKindLabel(kind: ContractExtractionKind): string {
  switch (kind) {
    case 'SAFE_ANCHOR':
      return 'Safe Anchor Extraction';
    case 'EMERGENCY_RECALL':
      return 'Emergency Recall';
    case 'MASTER_LINK':
      return 'Master Extraction Link';
    default:
      return 'Standard Extraction';
  }
}

export function sponsorDisplayName(sponsorId: string): string {
  switch (sponsorId) {
    case 'TERRAN_GRID':
      return 'Terran Grid';
    case 'LEGION':
      return 'Legion';
    case 'SOLARIS':
      return 'Solaris';
    default:
      return sponsorId.replace(/_/g, ' ');
  }
}

export function formatContractContextTag(contract: GeneratedContract): string | null {
  const reason = contract.boundContext?.reason;
  if (!reason) return null;
  if (reason === 'OPERATION_ALIGNED') return 'Supports Active Operation';
  if (reason === 'ANCHOR_ALIGNED' && contract.boundContext?.anchorDisplayName) {
    return `Linked to ${contract.boundContext.anchorDisplayName}`;
  }
  return SOURCE_REASON_LABELS[reason] ?? null;
}

export function formatContractSourceReasonLabel(reason: ContractSourceKind | undefined): string | null {
  if (!reason) return null;
  return SOURCE_REASON_LABELS[reason] ?? reason.replace(/_/g, ' ');
}

/** Short in-world job-type label for a contract chip. */
export function formatContractJobType(kind: ContractObjectiveKind): string {
  switch (kind) {
    case 'EXTRACT_STABLE_RESOURCE':
    case 'EXTRACT_SPONSOR_RESOURCE':
      return 'RESOURCE';
    case 'RECOVER_INTEL':
    case 'RECOVER_ECONOMY_INTEL':
      return 'INTEL';
    case 'EXTRACT_UNSTABLE_CARGO':
      return 'UNSTABLE';
    case 'RECOVER_APEX_CARGO':
      return 'APEX CARGO';
    case 'RECOVER_CONTRABAND':
      return 'CONTRABAND';
    case 'DEFEAT_ELITE':
      return 'COMBAT';
    case 'DEFEAT_DEPTH_BOSS':
      return 'BOSS';
    case 'COMPLETE_EMERGENCY_RECALL':
      return 'EXTRACTION';
    case 'REACH_DEPTH_AND_EXTRACT':
      return 'DEPTH';
    case 'CLEAR_OPERATION_TARGET':
      return 'ANCHOR';
    default:
      return 'CONTRACT';
  }
}

/** Difficulty (1-5) mapped to a risk tier chip: white → yellow → orange → red. */
export function formatContractRiskTier(difficulty: number): { label: string; color: string } {
  if (difficulty <= 2) return { label: 'LOW RISK', color: '#94a3b8' };
  if (difficulty <= 3) return { label: 'MED RISK', color: '#cbd5e1' };
  if (difficulty <= 4) return { label: 'HIGH RISK', color: '#f87171' };
  return { label: 'EXTREME', color: '#ef4444' };
}
