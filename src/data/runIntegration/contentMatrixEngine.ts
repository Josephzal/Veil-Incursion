import { SECTOR_WORLD_TEMPLATES } from '../sectorWorldCatalog';
import { ANCHOR_REGISTRY } from '../anchorRegistry';
import { CONTRACT_TEMPLATE_SPECS } from '../contractTemplates';
import { CRAFTING_REGISTRY } from '../craftingRegistry';
import { buildRunItemCraftingRecipes } from '../runItemCraftingBridge';
import { ENABLED_REQUISITION_IDS } from '../../types/expeditionRequisition';
import { ALL_RESOURCE_ITEM_IDS, RESOURCES_BY_CATEGORY } from '../resourceRegistry';
import { ALL_RUN_ITEM_IDS } from '../../types/runItem';
import type { SectorState, WorldStatePersistedState } from '../../types/worldState';
import { getNodesPerDistrict, getMaxRunGraphDepth } from './runPacingConfig';
import { formatCompositionContentReport } from '../encounterCompositionDebugEngine';
import { formatResourceEconomyReport } from '../resourceEconomyReportEngine';
import { formatBalanceConfigSummary } from '../balance';

export interface ContentMatrixSummary {
  sectors: number;
  activeOperations: number;
  anchors: number;
  resourcesTotal: number;
  resourcesByCategory: Record<string, number>;
  recipes: number;
  runItemRecipes: number;
  requisitions: number;
  runItems: number;
  contractTemplates: number;
  nodesPerDistrict: number;
  maxRunDepth: number;
}

export function buildContentMatrixSummary(
  sectors: SectorState[],
  persisted: WorldStatePersistedState,
): ContentMatrixSummary {
  const activeOps = sectors.filter((s) => s.activeOperation.lifecycleStatus === 'ACTIVE').length;
  const resourcesByCategory: Record<string, number> = {};
  Object.entries(RESOURCES_BY_CATEGORY).forEach(([category, ids]) => {
    resourcesByCategory[category] = ids.length;
  });

  return {
    sectors: SECTOR_WORLD_TEMPLATES.length,
    activeOperations: activeOps,
    anchors: Object.keys(ANCHOR_REGISTRY).length,
    resourcesTotal: ALL_RESOURCE_ITEM_IDS.length,
    resourcesByCategory,
    recipes: CRAFTING_REGISTRY.length,
    runItemRecipes: buildRunItemCraftingRecipes().length,
    requisitions: ENABLED_REQUISITION_IDS.length,
    runItems: ALL_RUN_ITEM_IDS.length,
    contractTemplates: CONTRACT_TEMPLATE_SPECS.length,
    nodesPerDistrict: getNodesPerDistrict(),
    maxRunDepth: getMaxRunGraphDepth(),
  };
}

export function formatContentMatrixReport(
  sectors: SectorState[],
  persisted: WorldStatePersistedState,
): string {
  const m = buildContentMatrixSummary(sectors, persisted);
  const categoryLines = Object.entries(m.resourcesByCategory)
    .map(([cat, count]) => `  - ${cat}: ${count}`)
    .join('\n');

  return [
    'CONTENT MATRIX',
    `Sectors: ${m.sectors}`,
    `Active Operations: ${m.activeOperations}/${m.sectors}`,
    `Anchors: ${m.anchors}`,
    `Resources: ${m.resourcesTotal} total`,
    categoryLines,
    `Recipes: ${m.recipes} (+ ${m.runItemRecipes} supply schematics)`,
    `Expedition Requisitions: ${m.requisitions}`,
    `Cargo Supplies: ${m.runItems}`,
    `Contract Templates: ${m.contractTemplates}`,
    `Run pacing: ${m.nodesPerDistrict} nodes/district × 3 = ${m.maxRunDepth} max depth`,
    `Board contracts queued: ${persisted.contractBoard?.contracts?.length ?? 0}`,
    '',
    formatCompositionContentReport(),
    '',
    formatResourceEconomyReport(),
    '',
    formatBalanceConfigSummary(),
  ].join('\n');
}
