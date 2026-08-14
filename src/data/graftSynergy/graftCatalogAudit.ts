/** Read-only audit view over the universal single-axis graft registry. */
import type { ClassType } from '../../types/game';
import {
  UNIVERSAL_GRAFT_DEFINITIONS,
  validateUniversalGraftRegistry,
} from '../universalGraftRegistry';

export type GraftAuditClassification =
  | 'UNIVERSAL_AXIS_UPGRADE'
  | 'TRANSFORMATIVE_APPROVED'
  | 'MECHANICALLY_VALID_NICHE'
  | 'DESCRIPTION_RUNTIME_MISMATCH'
  | 'ADVERTISED_PARTIALLY_UNWIRED'
  | 'PURE_STAT_SURVIVOR'
  | 'LEGACY_DEPENDENCY'
  | 'UNSAFE_LOOP_RISK'
  | 'OBSOLETE_OR_UNREACHABLE';

export type GraftCatalogAuditEntry = {
  id: string;
  classId: ClassType;
  name: string;
  cost: number;
  /** @deprecated Universal upgrades have no cost tier. */
  tierBand: null;
  /** @deprecated Universal upgrades target actions directly. */
  socketType: 'STANDARD';
  compatibleRule: string;
  ownershipSource:
    | 'SANCTUARY_ACTION_UPGRADE'
    | 'SANCTUARY_RESIDUE_APPLICATION'
    | 'LEGACY_FROZEN_DEPLOYMENT';
  progressionRequirement: string;
  sponsorRequirement: null;
  runtimeExecutor: string;
  upside: string;
  downside: string;
  addTag: null;
  removeTags: readonly string[];
  modifyTagFrom: null;
  modifyTagTo: null;
  setAmmoCost: null;
  refundApOnCrit: false;
  dropLootOnKill: null;
  reduceMaxHp: null;
  descriptionRuntimeConsistent: boolean;
  mechanicallyComplete: boolean;
  genuineGraft: boolean;
  classification: GraftAuditClassification;
  notes: string;
};

export function buildGraftCatalogAudit(): GraftCatalogAuditEntry[] {
  const registryIssues = validateUniversalGraftRegistry();
  return UNIVERSAL_GRAFT_DEFINITIONS.map((definition) => ({
    id: definition.id,
    classId: definition.classId,
    name: definition.name,
    cost: 0,
    tierBand: null,
    socketType: 'STANDARD',
    compatibleRule: `${definition.classId}:${definition.canonicalActionId}`,
    ownershipSource: 'SANCTUARY_ACTION_UPGRADE',
    progressionRequirement: 'Available through the current run Sanctuary flow',
    sponsorRequirement: null,
    runtimeExecutor: 'universalGraftRegistry single-axis overlay',
    upside: definition.previewCopy,
    downside: 'Tags, events, targeting, and action identity remain unchanged',
    addTag: null,
    removeTags: [],
    modifyTagFrom: null,
    modifyTagTo: null,
    setAmmoCost: null,
    refundApOnCrit: false,
    dropLootOnKill: null,
    reduceMaxHp: null,
    descriptionRuntimeConsistent: registryIssues.length === 0,
    mechanicallyComplete: registryIssues.length === 0,
    genuineGraft: true,
    classification: 'UNIVERSAL_AXIS_UPGRADE',
    notes: `${definition.upgradeAxis}: ${definition.baseValue} → ${definition.upgradedValue}`,
  }));
}

export function listGraftCatalogAudit(): GraftCatalogAuditEntry[] {
  return buildGraftCatalogAudit();
}

export function assertUniqueGraftCatalogIds(): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const { id } of listGraftCatalogAudit()) {
    if (seen.has(id)) duplicates.push(id);
    seen.add(id);
  }
  return duplicates;
}
