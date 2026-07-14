import type {
  CompositionEnemyRole,
  EncounterCompositionTemplateId,
  EncounterRewardTier,
  EncounterRiskLabel,
} from '../types/encounterComposition';
import { ALL_COMPOSITION_ENEMY_ROLES } from '../types/encounterComposition';
import type { VeilBiome } from '../types/encounterSpawn';
import { ALL_VEIL_BIOMES } from './sectorBiomeBridge';
import {
  ALL_ENCOUNTER_COMPOSITION_TEMPLATE_IDS,
  ENCOUNTER_COMPOSITION_TEMPLATES,
  getEncounterCompositionTemplate,
} from './encounterCompositionTemplateCatalog';
import { countEnemiesByCompositionRole } from './enemyCompositionRoleCatalog';
import {
  getDebugForcedCompositionTemplate,
  setDebugForcedCompositionTemplate,
  tryPickCompositionSquad,
} from './encounterCompositionPickEngine';
import { compositionPassesFairness } from './encounterCompositionFairnessEngine';
import {
  debugValidateEncounterCompositionPhaseA,
  validateEncounterCompositionCatalog,
  validateEncounterCompositionPhaseD,
  verifyEncounterComposition,
} from './encounterCompositionValidationEngine';
import {
  buildEncounterWarningCard,
  formatEncounterRewardPreview,
  formatEncounterRiskLabel,
  resolveEncounterRiskLabel,
  shouldShowEncounterWarningCard,
} from './encounterCompositionReadabilityEngine';
import { compositionExtraLootIds } from './encounterCompositionRewardEngine';
import { ALL_RESOURCE_ITEM_IDS } from './resourceRegistry';
import { ALL_ENCOUNTER_MODIFIER_IDS } from './encounterModifierCatalog';
import { ALL_TWISTED_TEMPLATE_IDS } from './twistedTemplateCatalog';
import { DEPTH_2_VARIANT_KEYS, DEPTH_3_ELITE_VARIANT_KEYS } from './depthEnemyVariantCatalog';
import { allDefinedEnemyKeys } from './enemyDefinitions';
import { STRANGE_SCANNER_LABELS } from './scannerLabelCertaintyCatalog';

function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  let state = Math.abs(hash) || 1;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

export function debugForceCompositionTemplate(id: EncounterCompositionTemplateId | null): string {
  setDebugForcedCompositionTemplate(id);
  if (!id) return 'Cleared forced composition template.';
  return `Next composition pick forced to ${id} (when depth allows).`;
}

export function debugGetForcedCompositionTemplate(): EncounterCompositionTemplateId | null {
  return getDebugForcedCompositionTemplate();
}

export function debugPrintCompositionTemplates(): string {
  const lines = ALL_ENCOUNTER_COMPOSITION_TEMPLATE_IDS.map((id) => {
    const t = ENCOUNTER_COMPOSITION_TEMPLATES[id];
    return `- ${id} // ${t.name} // D${t.allowedDepths.join(',')} // ${t.defaultRewardTier}${t.requiresWarningCard ? ' // WARN' : ''}`;
  });
  return ['COMPOSITION TEMPLATES', ...lines].join('\n');
}

export function debugPrintCompositionRoles(): string {
  const counts = countEnemiesByCompositionRole();
  const lines = ALL_COMPOSITION_ENEMY_ROLES.map((role) => `- ${role}: ${counts[role] ?? 0}`);
  return ['ENEMY COMPOSITION ROLES', ...lines].join('\n');
}

export function formatCompositionContentReport(): string {
  const roleCounts = countEnemiesByCompositionRole();
  const roleLines = ALL_COMPOSITION_ENEMY_ROLES.map(
    (role) => `  ${role}: ${roleCounts[role] ?? 0}`,
  );
  const issues = [
    ...validateEncounterCompositionCatalog(),
    ...validateEncounterCompositionPhaseD(),
  ];
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warns = issues.filter((i) => i.severity === 'warn').length;
  const rewardTiers = new Set(
    ALL_ENCOUNTER_COMPOSITION_TEMPLATE_IDS.map((id) => ENCOUNTER_COMPOSITION_TEMPLATES[id].defaultRewardTier),
  );

  return [
    'ENCOUNTER COMPOSITION CONTENT MATRIX',
    `Total enemies (defined): ${allDefinedEnemyKeys().length}`,
    'Enemy Roles:',
    ...roleLines,
    `Encounter Templates: ${ALL_ENCOUNTER_COMPOSITION_TEMPLATE_IDS.length} active`,
    `Reward profiles represented: ${[...rewardTiers].join(', ')}`,
    `Encounter modifiers: ${ALL_ENCOUNTER_MODIFIER_IDS.length}`,
    `Twisted templates: ${ALL_TWISTED_TEMPLATE_IDS.length}`,
    `Depth 2 variants: ${DEPTH_2_VARIANT_KEYS.length}`,
    `Depth 3 exclusives / elites: ${DEPTH_3_ELITE_VARIANT_KEYS.length}`,
    `Strange scanner labels: ${Object.values(STRANGE_SCANNER_LABELS).reduce((n, list) => n + list.length, 0)}`,
    `Validation: ${errors} critical error(s) // ${warns} warning(s)`,
  ].join('\n');
}

export function debugSimulateCompositionMatrix(args?: {
  encountersPerCell?: number;
  biomes?: readonly VeilBiome[];
}): string {
  const perCell = args?.encountersPerCell ?? 20;
  const biomes = args?.biomes ?? ALL_VEIL_BIOMES.slice(0, 5);
  const templateHits: Partial<Record<EncounterCompositionTemplateId, number>> = {};
  const rewardHits: Partial<Record<EncounterRewardTier, number>> = {};
  const roleHits: Partial<Record<CompositionEnemyRole, number>> = {};
  let attempted = 0;
  let succeeded = 0;
  let unfair = 0;
  let invalidLoot = 0;

  for (const biome of biomes) {
    for (const depth of [1, 2, 3] as const) {
      for (const tier of ['NORMAL', 'ELITE'] as const) {
        for (let i = 0; i < perCell; i += 1) {
          attempted += 1;
          const seed = `comp-sim:${biome}:${depth}:${tier}:${i}`;
          const rand = seededRandom(seed);
          const picked = tryPickCompositionSquad({
            depth,
            nodeIndexInDepth: depth === 1 ? 3 : 4,
            squadTier: tier,
            nodeTier: tier === 'ELITE' ? 'ELITE' : 'NORMAL',
            veilBiome: biome,
            seed,
            encounterOrigin: 'VEIL',
            threatBudget: tier === 'ELITE'
              ? (depth === 1 ? 7 : depth === 2 ? 10 : 12)
              : (depth === 1 ? 5 : depth === 2 ? 7 : 9),
            highRisk: i % 5 === 0,
            highValue: i % 7 === 0,
            anchorSignal: i % 9 === 0,
            echoSignal: i % 11 === 0,
          }, rand);
          if (!picked) continue;
          succeeded += 1;
          templateHits[picked.meta.templateId] = (templateHits[picked.meta.templateId] ?? 0) + 1;
          rewardHits[picked.meta.rewardTier] = (rewardHits[picked.meta.rewardTier] ?? 0) + 1;
          for (const role of picked.meta.rolesUsed) {
            roleHits[role] = (roleHits[role] ?? 0) + 1;
          }
          const keys = picked.squad.roster.map((u) => u.type);
          if (!compositionPassesFairness(keys, {
            depth,
            tier,
            veilBiome: biome,
            templateId: picked.meta.templateId,
            rewardTier: picked.meta.rewardTier,
          })) {
            unfair += 1;
          }
          const extras = compositionExtraLootIds({
            tier: picked.meta.rewardTier,
            templateId: picked.meta.templateId,
            veilBiome: biome,
            highValue: i % 7 === 0,
            echoSignal: i % 11 === 0,
            anchorSignal: i % 9 === 0,
          });
          if (extras.some((id) => !ALL_RESOURCE_ITEM_IDS.includes(id))) {
            invalidLoot += 1;
          }
        }
      }
    }
  }

  const templateLines = Object.entries(templateHits)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([id, n]) => `  ${id}: ${n}`);
  const rewardLines = Object.entries(rewardHits)
    .map(([id, n]) => `  ${id}: ${n}`);
  const roleLines = Object.entries(roleHits)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([id, n]) => `  ${id}: ${n}`);

  return [
    'COMPOSITION SIM MATRIX',
    `Biomes: ${biomes.join(', ')}`,
    `Attempts: ${attempted} // composition hits: ${succeeded} (${Math.round((succeeded / Math.max(1, attempted)) * 100)}%)`,
    `Unfair among hits: ${unfair} // invalid loot refs: ${invalidLoot}`,
    'Templates:',
    ...(templateLines.length ? templateLines : ['  (none)']),
    'Reward tiers:',
    ...(rewardLines.length ? rewardLines : ['  (none)']),
    'Roles used:',
    ...(roleLines.length ? roleLines : ['  (none)']),
  ].join('\n');
}

export function debugSimulateCompositionSectorRun(veilBiome: VeilBiome = 'NULL_ZONE'): string {
  const templateHits: Partial<Record<EncounterCompositionTemplateId, number>> = {};
  const rewardHits: Partial<Record<EncounterRewardTier, number>> = {};
  let picks = 0;
  let misses = 0;
  const nodesPerDepth = 5;

  for (const depth of [1, 2, 3] as const) {
    for (let n = 0; n < nodesPerDepth; n += 1) {
      const seed = `comp-run:${veilBiome}:${depth}:${n}`;
      const rand = seededRandom(seed);
      const isElite = n === nodesPerDepth - 1;
      const picked = tryPickCompositionSquad({
        depth,
        nodeIndexInDepth: n + 1,
        squadTier: isElite ? 'ELITE' : 'NORMAL',
        nodeTier: isElite ? 'ELITE' : 'NORMAL',
        veilBiome,
        seed,
        encounterOrigin: 'VEIL',
        threatBudget: isElite
          ? (depth === 1 ? 7 : depth === 2 ? 10 : 12)
          : (depth === 1 ? 5 : depth === 2 ? 7 : 9),
        highRisk: depth >= 2 && n >= 3,
        highValue: n === 2,
        anchorSignal: depth === 2 && n === 1,
        echoSignal: depth === 3 && n === 2,
        foreshadowBias: depth === 3 && n === nodesPerDepth - 2,
      }, rand);
      if (!picked) {
        misses += 1;
        continue;
      }
      picks += 1;
      templateHits[picked.meta.templateId] = (templateHits[picked.meta.templateId] ?? 0) + 1;
      rewardHits[picked.meta.rewardTier] = (rewardHits[picked.meta.rewardTier] ?? 0) + 1;
    }
  }

  return [
    `COMPOSITION FULL-RUN SIM — ${veilBiome}`,
    `Nodes: ${nodesPerDepth * 3} // composition: ${picks} // deck-fallback: ${misses}`,
    'Templates:',
    ...Object.entries(templateHits).map(([id, n]) => `  ${id}: ${n}`),
    'Rewards:',
    ...Object.entries(rewardHits).map(([id, n]) => `  ${id}: ${n}`),
  ].join('\n');
}

export function debugPreviewCompositionWarningCard(): string {
  const templateId: EncounterCompositionTemplateId = 'ARTILLERY_KILLBOX';
  const template = getEncounterCompositionTemplate(templateId);
  const riskLabel: EncounterRiskLabel = resolveEncounterRiskLabel({
    depth: 2,
    isElite: true,
    highRisk: true,
    templateId,
    rewardTier: template.defaultRewardTier,
  });
  const show = shouldShowEncounterWarningCard({
    templateId,
    isElite: true,
    highRisk: true,
    depth: 2,
    riskLabel,
  });
  const card = buildEncounterWarningCard({
    composition: {
      templateId,
      rolesUsed: ['ARTILLERY', 'BRUISER'],
      rewardTier: template.defaultRewardTier,
    },
    depth: 2,
    veilBiome: 'SLAG_WORKS',
    mods: {
      depthStage: 'DEEP_VEIL',
      nodePressureBand: 'HIGH',
      highRisk: true,
      compositionTemplateId: templateId,
      compositionRiskLabel: riskLabel,
      compositionRewardTier: template.defaultRewardTier,
      compositionRewardPreview: formatEncounterRewardPreview(template.defaultRewardTier, templateId),
      compositionWarningSummary: template.warningSummary,
    },
    isElite: true,
    enemyRoles: ['ARTILLERY', 'BRUISER'],
    sectorDisplayName: 'Slag Works',
    optionalBack: true,
  });
  return [
    'WARNING CARD PREVIEW',
    `show=${show}`,
    `name=${card.encounterName}`,
    `risk=${formatEncounterRiskLabel(card.riskLabel)}`,
    `roles=${card.enemyRoles.join(', ')}`,
    `reward=${card.rewardPreview}`,
    `text=${card.warningText}`,
  ].join('\n');
}

export function debugValidateEncounterComposition(): string {
  try {
    verifyEncounterComposition();
    return [
      debugValidateEncounterCompositionPhaseA(),
      'OK — Encounter Composition Phase D validation + sim smoke passed.',
      formatCompositionContentReport(),
    ].join('\n\n');
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
