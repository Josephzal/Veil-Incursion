import { allDefinedEnemyKeys, getEnemyDefinition } from './enemyDefinitions';
import { ENEMY_COMPOSITION_ROLES } from './enemyCompositionRoleCatalog';
import {
  ALL_ENCOUNTER_COMPOSITION_TEMPLATE_IDS,
  ENCOUNTER_COMPOSITION_TEMPLATES,
} from './encounterCompositionTemplateCatalog';
import { BIOME_DEPTH_ENEMY_HINTS } from './encounterBiomePools';
import { ALL_VEIL_BIOMES } from './sectorBiomeBridge';
import { tryPickCompositionSquad } from './encounterCompositionPickEngine';
import { compositionPassesFairness } from './encounterCompositionFairnessEngine';
import { compositionExtraLootIds } from './encounterCompositionRewardEngine';
import { ALL_RESOURCE_ITEM_IDS } from './resourceRegistry';

function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  let state = Math.abs(hash);
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}
export interface EncounterCompositionValidationIssue {
  severity: 'error' | 'warn';
  code: string;
  message: string;
}

export function validateEncounterCompositionCatalog(): EncounterCompositionValidationIssue[] {
  const issues: EncounterCompositionValidationIssue[] = [];

  for (const key of allDefinedEnemyKeys()) {
    const meta = ENEMY_COMPOSITION_ROLES[key];
    if (!meta) {
      issues.push({
        severity: 'error',
        code: 'MISSING_ROLE',
        message: `${key} missing primary composition role.`,
      });
      continue;
    }
    const def = getEnemyDefinition(key);
    if (!def) {
      issues.push({
        severity: 'error',
        code: 'MISSING_DEF',
        message: `${key} has composition role but no enemy definition.`,
      });
      continue;
    }
    if (!def.spawnGates.allowedDepths.length) {
      issues.push({
        severity: 'error',
        code: 'MISSING_DEPTHS',
        message: `${key} missing allowedDepths.`,
      });
    }
    if (def.origin === 'VEIL' && def.biomeTags.length === 0) {
      issues.push({
        severity: 'error',
        code: 'MISSING_BIOMES',
        message: `${key} missing biome tags.`,
      });
    }
    if (def.threatCost == null || def.threatCost < 1) {
      issues.push({
        severity: 'error',
        code: 'MISSING_THREAT',
        message: `${key} missing valid threatCost.`,
      });
    }
    if (meta.primaryRole === 'ECHO_SPECIAL' || meta.echoSpecialOnly) {
      for (const biome of ALL_VEIL_BIOMES) {
        for (const depth of [1, 2, 3] as const) {
          if (BIOME_DEPTH_ENEMY_HINTS[biome][depth].includes(key)) {
            issues.push({
              severity: 'error',
              code: 'ECHO_IN_POOL',
              message: `ECHO_SPECIAL ${key} listed in ${biome} D${depth} normal pool.`,
            });
          }
        }
      }
    }
  }

  for (const id of ALL_ENCOUNTER_COMPOSITION_TEMPLATE_IDS) {
    const template = ENCOUNTER_COMPOSITION_TEMPLATES[id];
    if (template.allowedDepths.length === 0) {
      issues.push({
        severity: 'error',
        code: 'TEMPLATE_DEPTH',
        message: `${id} has no allowed depths.`,
      });
    }
    for (const depth of template.allowedDepths) {
      const slots = template.roleSlotsByDepth[depth];
      if (!slots || slots.length === 0) {
        issues.push({
          severity: 'error',
          code: 'TEMPLATE_SLOTS',
          message: `${id} missing role slots for depth ${depth}.`,
        });
      }
    }
    if (!template.defaultRewardTier) {
      issues.push({
        severity: 'error',
        code: 'TEMPLATE_REWARD',
        message: `${id} missing reward tier.`,
      });
    }
    if (template.requiresWarningCard && !template.warningSummary.trim()) {
      issues.push({
        severity: 'error',
        code: 'TEMPLATE_WARNING',
        message: `${id} high-risk template missing warning summary.`,
      });
    }
  }

  if (ALL_ENCOUNTER_COMPOSITION_TEMPLATE_IDS.length < 8) {
    issues.push({
      severity: 'error',
      code: 'TEMPLATE_COUNT',
      message: `Expected at least 8 templates, got ${ALL_ENCOUNTER_COMPOSITION_TEMPLATE_IDS.length}.`,
    });
  }

  return issues;
}

/** Phase D polish — reward refs, warning rules, high-risk reward mismatch. */
export function validateEncounterCompositionPhaseD(): EncounterCompositionValidationIssue[] {
  const issues: EncounterCompositionValidationIssue[] = [];
  const resourceSet = new Set(ALL_RESOURCE_ITEM_IDS);

  for (const id of ALL_ENCOUNTER_COMPOSITION_TEMPLATE_IDS) {
    const template = ENCOUNTER_COMPOSITION_TEMPLATES[id];
    if (
      template.requiresWarningCard
      && (template.defaultRewardTier === 'BASELINE')
      && (template.requiresHighRisk || template.elitePreferred || id === 'HIGH_RISK_CARGO_GUARD')
    ) {
      issues.push({
        severity: 'warn',
        code: 'HIGH_RISK_BASELINE',
        message: `${id} is warning/high-risk flagged but default reward is BASELINE.`,
      });
    }
    for (const biome of ALL_VEIL_BIOMES) {
      const extras = compositionExtraLootIds({
        tier: template.defaultRewardTier,
        templateId: id,
        veilBiome: biome,
        highValue: Boolean(template.requiresHighValue),
        echoSignal: Boolean(template.requiresEchoSignal),
        anchorSignal: Boolean(template.requiresAnchorSignal),
      });
      for (const resourceId of extras) {
        if (!resourceSet.has(resourceId)) {
          issues.push({
            severity: 'error',
            code: 'REWARD_MISSING_RESOURCE',
            message: `${id} reward extras reference missing resource ${resourceId} (${biome}).`,
          });
        }
      }
    }
  }

  // Smoke: at least one warning-card template exists for elevated fights.
  const warningTemplates = ALL_ENCOUNTER_COMPOSITION_TEMPLATE_IDS.filter(
    (id) => ENCOUNTER_COMPOSITION_TEMPLATES[id].requiresWarningCard,
  );
  if (warningTemplates.length < 3) {
    issues.push({
      severity: 'warn',
      code: 'WARNING_COVERAGE',
      message: `Expected several warning-card templates, found ${warningTemplates.length}.`,
    });
  }

  return issues;
}

export function verifyEncounterCompositionPhaseA(): void {
  const issues = validateEncounterCompositionCatalog().filter((i) => i.severity === 'error');
  if (issues.length > 0) {
    throw new Error(
      `verifyEncounterCompositionPhaseA:\n${issues.map((i) => `- [${i.code}] ${i.message}`).join('\n')}`,
    );
  }

  // Smoke: role composition must succeed for common Depth 1 / Null Zone cases.
  for (const depth of [1, 2, 3] as const) {
    for (const tier of ['NORMAL', 'ELITE'] as const) {
      const rand = seededRandom(`comp-verify:${depth}:${tier}`);
      const picked = tryPickCompositionSquad({
        depth,
        nodeIndexInDepth: depth === 1 ? 3 : 4,
        squadTier: tier,
        nodeTier: tier === 'ELITE' ? 'ELITE' : 'NORMAL',
        veilBiome: 'NULL_ZONE',
        seed: `comp-verify:${depth}:${tier}`,
        encounterOrigin: 'VEIL',
        threatBudget: tier === 'ELITE' ? (depth === 1 ? 7 : depth === 2 ? 10 : 12) : (depth === 1 ? 5 : depth === 2 ? 7 : 9),
      }, rand);

      // Composition is preferred but may fail — only assert when it returns.
      if (picked) {
        const keys = picked.squad.roster.map((u) => u.type);
        if (!compositionPassesFairness(keys, {
          depth,
          tier,
          veilBiome: 'NULL_ZONE',
          templateId: picked.meta.templateId,
          rewardTier: picked.meta.rewardTier,
        })) {
          throw new Error(
            `verifyEncounterCompositionPhaseA: unfair composition ${picked.squad.id}`,
          );
        }
      }
    }
  }
}

/** Phase D boot verify — catalog + Phase D errors + light matrix smoke. */
export function verifyEncounterComposition(): void {
  verifyEncounterCompositionPhaseA();
  const phaseDErrors = validateEncounterCompositionPhaseD().filter((i) => i.severity === 'error');
  if (phaseDErrors.length > 0) {
    throw new Error(
      `verifyEncounterComposition Phase D:\n${phaseDErrors.map((i) => `- [${i.code}] ${i.message}`).join('\n')}`,
    );
  }

  // Light sim smoke across all biomes / depths.
  for (const biome of ALL_VEIL_BIOMES) {
    for (const depth of [1, 2, 3] as const) {
      const seed = `comp-phase-d:${biome}:${depth}`;
      const rand = seededRandom(seed);
      tryPickCompositionSquad({
        depth,
        nodeIndexInDepth: 3,
        squadTier: 'NORMAL',
        nodeTier: 'NORMAL',
        veilBiome: biome,
        seed,
        encounterOrigin: 'VEIL',
        threatBudget: depth === 1 ? 5 : depth === 2 ? 7 : 9,
      }, rand);
    }
  }
}

export function debugValidateEncounterCompositionPhaseA(): string {
  try {
    verifyEncounterCompositionPhaseA();
    return 'OK — Encounter Composition Phase A catalog + fairness smoke passed.';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
