import { SECTOR_WORLD_TEMPLATES } from '../sectorWorldCatalog';
import { ANCHOR_REGISTRY } from '../anchorRegistry';
import { CONTRACT_TEMPLATE_SPECS } from '../contractTemplates';
import { CRAFTING_REGISTRY } from '../craftingRegistry';
import { buildRunItemCraftingRecipes } from '../runItemCraftingBridge';
import { ALL_KEEPSAKE_IDS } from '../expeditionKeepsakeRegistry';
import { ALL_RESOURCE_ITEM_IDS, RESOURCES_BY_CATEGORY } from '../resourceRegistry';
import { ALL_RUN_ITEM_IDS } from '../../types/runItem';
import type { SectorState, WorldStatePersistedState } from '../../types/worldState';
import { getNodesPerDistrict, getMaxRunGraphDepth } from './runPacingConfig';
import { formatCompositionContentReport } from '../encounterCompositionDebugEngine';

export interface ContentMatrixSummary {
  sectors: number;
  activeOperations: number;
  anchors: number;
  resourcesTotal: number;
  resourcesByCategory: Record<string, number>;
  recipes: number;
  runItemRecipes: number;
  keepsakes: number;
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
    keepsakes: ALL_KEEPSAKE_IDS.length,
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
    `Recipes: ${m.recipes} (+ ${m.runItemRecipes} run item schematics)`,
    `Expedition Relics: ${m.keepsakes}`,
    `Run Items: ${m.runItems}`,
    `Contract Templates: ${m.contractTemplates}`,
    `Run pacing: ${m.nodesPerDistrict} nodes/district × 3 = ${m.maxRunDepth} max depth`,
    `Board contracts queued: ${persisted.contractBoard?.contracts?.length ?? 0}`,
    '',
    formatCompositionContentReport(),
  ].join('\n');
}
