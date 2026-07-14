import type { DepthIdentityState, TwistedOutcomeRecord, TwistedTemplateId } from '../types/depthIdentity';
import type { EnemyCombatProfile } from '../types/run';
import { normalizeDepthIdentityState } from './depthIdentityEngine';
import {
  DEPTH_ENEMY_VARIANT_META,
  DEPTH_2_VARIANT_KEYS,
  DEPTH_3_ELITE_VARIANT_KEYS,
  isDepth2VariantRosterId,
} from './depthEnemyVariantCatalog';
import { ENCOUNTER_KEY_TO_ROSTER } from './enemyCombatConfig';
import { DEPTH_3_EXCLUSIVE_ENEMY_KEYS } from '../types/encounterSpawn';
import { getTwistedTemplateDefinition } from './twistedTemplateCatalog';

export function appendTwistedOutcome(
  state: DepthIdentityState,
  entry: TwistedOutcomeRecord,
): DepthIdentityState {
  const next = normalizeDepthIdentityState(state);
  return {
    ...next,
    twistedOutcomes: [...next.twistedOutcomes, entry],
  };
}

export function addDepthIdentityOpProgress(
  state: DepthIdentityState,
  amount: number,
): DepthIdentityState {
  if (amount <= 0) return normalizeDepthIdentityState(state);
  const next = normalizeDepthIdentityState(state);
  return {
    ...next,
    depthIdentityOpProgressGained: next.depthIdentityOpProgressGained + amount,
  };
}

export function recordTwistedResolutionTelemetry(
  state: DepthIdentityState,
  templateId: TwistedTemplateId,
  choiceValue: string,
  operationProgress?: number,
): DepthIdentityState {
  const def = getTwistedTemplateDefinition(templateId);
  let next = appendTwistedOutcome(state, {
    templateId,
    choiceValue,
    summary: `${def.displayName} — ${choiceValue.replace(/_/g, ' ')}`,
  });
  if (operationProgress && operationProgress > 0) {
    next = addDepthIdentityOpProgress(next, operationProgress);
  }
  return next;
}

function designationForRoster(rosterId: string, fallback: string): string {
  for (const key of [...DEPTH_2_VARIANT_KEYS, ...DEPTH_3_ELITE_VARIANT_KEYS]) {
    const meta = DEPTH_ENEMY_VARIANT_META[key];
    if (meta.rosterId === rosterId) return meta.label;
  }
  return fallback;
}

function isDepth3ExclusiveRosterId(rosterId: string | undefined | null): boolean {
  if (!rosterId) return false;
  for (const key of DEPTH_3_EXCLUSIVE_ENEMY_KEYS) {
    if (ENCOUNTER_KEY_TO_ROSTER[key] === rosterId) return true;
  }
  return false;
}

/** Record Depth 2/3 special enemy kills from a slain squad. */
export function recordDepthEnemyDefeats(
  state: DepthIdentityState | null | undefined,
  slain: readonly Pick<EnemyCombatProfile, 'rosterId' | 'designation'>[],
): DepthIdentityState {
  const next = normalizeDepthIdentityState(state);
  const d2 = [...next.depth2VariantsDefeated];
  const d3 = [...next.depth3ExclusivesDefeated];

  for (const unit of slain) {
    const rosterId = unit.rosterId;
    if (!rosterId) continue;
    if (isDepth2VariantRosterId(rosterId)) {
      const label = designationForRoster(rosterId, unit.designation);
      if (!d2.includes(label)) d2.push(label);
      continue;
    }
    if (isDepth3ExclusiveRosterId(rosterId)) {
      const label = designationForRoster(rosterId, unit.designation);
      if (!d3.includes(label)) d3.push(label);
    }
  }

  return {
    ...next,
    depth2VariantsDefeated: d2,
    depth3ExclusivesDefeated: d3,
  };
}

export function recordCombatTwistedCleared(
  state: DepthIdentityState | null | undefined,
  templateId: TwistedTemplateId | null | undefined,
): DepthIdentityState {
  const next = normalizeDepthIdentityState(state);
  if (!templateId) return next;
  if (templateId !== 'MIRROR_COMBAT' && templateId !== 'APEX_SHADOW') return next;
  const seen = next.twistedTemplatesSeen.includes(templateId)
    ? next.twistedTemplatesSeen
    : [...next.twistedTemplatesSeen, templateId];
  const cleared = next.twistedTemplatesCleared.includes(templateId)
    ? next.twistedTemplatesCleared
    : [...next.twistedTemplatesCleared, templateId];
  const def = getTwistedTemplateDefinition(templateId);
  const outcomes = next.twistedOutcomes.some((o) => o.templateId === templateId)
    ? next.twistedOutcomes
    : [
      ...next.twistedOutcomes,
      {
        templateId,
        choiceValue: 'CLEARED_IN_COMBAT',
        summary: `${def.displayName} — cleared in combat`,
      },
    ];
  return {
    ...next,
    twistedTemplatesSeen: seen,
    twistedTemplatesCleared: cleared,
    twistedOutcomes: outcomes,
  };
}
