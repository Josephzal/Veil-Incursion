import type { EncounterEnemyKey } from './enemyCombatConfig';
import type {
  EncounterOrigin,
  EncounterNodeTier,
  EncounterSquadTier,
  VeilBiome,
} from '../types/encounterSpawn';
import type {
  CompositionEnemyRole,
  EncounterCompositionPickMeta,
  EncounterCompositionTemplate,
  EncounterCompositionTemplateId,
} from '../types/encounterComposition';
import type { OperationObjectiveKind } from '../types/worldState';
import type { EncounterGridPos, EncounterUnitSpec, SynergySquadSpec } from './synergyEncounterTypes';
import { BIOME_DEPTH_ENEMY_HINTS } from './encounterBiomePools';
import { veilBiomeToSynergyBiomes } from './sectorBiomeBridge';
import {
  enemyIsEchoSpecialOnly,
  enemyMatchesCompositionRole,
  getEnemyCompositionRole,
  listRivalMercCompositionKeys,
} from './enemyCompositionRoleCatalog';
import {
  ALL_ENCOUNTER_COMPOSITION_TEMPLATE_IDS,
  ENCOUNTER_COMPOSITION_TEMPLATES,
  getEncounterCompositionTemplate,
} from './encounterCompositionTemplateCatalog';
import { compositionPassesFairness } from './encounterCompositionFairnessEngine';
import { enemyPassesSpawnGates, type SpawnGateContext } from './encounterSpawnGateEngine';
import { getEnemyDefinition, getEnemyOrigin } from './enemyDefinitions';
import { passesHardCounterRules } from './encounterHardCounterEngine';
import { squadFitsThreatBudget, squadThreatCost } from './encounterThreatBudget';
import { DEPTH_2_VARIANT_KEYS } from './depthEnemyVariantCatalog';

let debugForcedCompositionTemplate: EncounterCompositionTemplateId | null = null;

export function setDebugForcedCompositionTemplate(
  id: EncounterCompositionTemplateId | null,
): void {
  debugForcedCompositionTemplate = id;
}

export function getDebugForcedCompositionTemplate(): EncounterCompositionTemplateId | null {
  return debugForcedCompositionTemplate;
}

export interface CompositionPickContext {
  depth: 1 | 2 | 3;
  nodeIndexInDepth: number;
  squadTier: EncounterSquadTier;
  nodeTier: EncounterNodeTier;
  veilBiome: VeilBiome | null | undefined;
  seed: string;
  encounterOrigin: EncounterOrigin;
  threatBudget: number;
  highValue?: boolean;
  highRisk?: boolean;
  anchorSignal?: boolean;
  echoSignal?: boolean;
  operationKind?: OperationObjectiveKind | null;
  /** Prefer foreshadowing late in chapter. */
  foreshadowBias?: boolean;
}

export interface CompositionPickResult {
  squad: SynergySquadSpec;
  meta: EncounterCompositionPickMeta;
}

const FRONT_POS: EncounterGridPos[] = ['FRONT_LEFT', 'FRONT_RIGHT', 'FRONT_CENTER'];
const BACK_POS: EncounterGridPos[] = ['BACK_LEFT', 'BACK_RIGHT', 'BACK_CENTER'];

function prefersBackline(role: CompositionEnemyRole): boolean {
  return role === 'ARTILLERY' || role === 'SUPPORT' || role === 'DISRUPTOR';
}

function assignPositions(keys: EncounterEnemyKey[]): EncounterUnitSpec[] {
  const used = new Set<EncounterGridPos>();
  const nextFront = (): EncounterGridPos => {
    const free = FRONT_POS.find((pos) => !used.has(pos));
    return free ?? 'FRONT_LEFT';
  };
  const nextBack = (): EncounterGridPos => {
    const free = BACK_POS.find((pos) => !used.has(pos));
    return free ?? 'BACK_LEFT';
  };

  return keys.map((type) => {
    const primary = getEnemyCompositionRole(type)?.primaryRole ?? 'BRUISER';
    let pos = prefersBackline(primary) ? nextBack() : nextFront();
    if (used.has(pos)) {
      pos = nextFront();
    }
    used.add(pos);
    return { type, pos };
  });
}

function buildCandidatePool(ctx: CompositionPickContext): EncounterEnemyKey[] {
  const biome = ctx.veilBiome ?? 'NULL_ZONE';
  const veilPool = [...BIOME_DEPTH_ENEMY_HINTS[biome][ctx.depth]];
  const rivals = listRivalMercCompositionKeys();

  let pool: EncounterEnemyKey[];
  if (ctx.encounterOrigin === 'RIVAL_MERC') {
    pool = [...rivals];
  } else {
    pool = [...veilPool];
  }

  if (ctx.anchorSignal || ctx.nodeTier === 'ANCHOR') {
    if (!pool.includes('ANCHOR_HUSK')) pool.push('ANCHOR_HUSK');
  }

  const gateCtx: SpawnGateContext = {
    depth: ctx.depth,
    nodeIndexInDepth: ctx.nodeIndexInDepth,
    nodeTier: ctx.nodeTier,
    veilBiome: ctx.veilBiome ?? undefined,
  };

  return pool.filter((key) => {
    if (enemyIsEchoSpecialOnly(key)) return false;
    // Anchor Husk is inject/composition gated by Anchor Signal; allow when overlay present.
    if (
      key === 'ANCHOR_HUSK'
      && (ctx.anchorSignal || ctx.nodeTier === 'ANCHOR')
    ) {
      const huskGate: SpawnGateContext = {
        ...gateCtx,
        nodeTier: 'ANCHOR',
      };
      return enemyPassesSpawnGates(key, huskGate);
    }
    return enemyPassesSpawnGates(key, gateCtx);
  });
}

function templateEligible(
  template: EncounterCompositionTemplate,
  ctx: CompositionPickContext,
): boolean {
  if (!template.allowedDepths.includes(ctx.depth)) return false;
  if (template.allowedBiomes && ctx.veilBiome && !template.allowedBiomes.includes(ctx.veilBiome)) {
    return false;
  }
  if (template.requiresAnchorSignal && !ctx.anchorSignal && ctx.nodeTier !== 'ANCHOR') {
    return false;
  }
  if (template.requiresEchoSignal && !ctx.echoSignal) return false;
  if (template.requiresHighValue && !ctx.highValue) return false;
  if (template.requiresHighRisk && !ctx.highRisk) return false;
  if (template.elitePreferred && ctx.squadTier !== 'ELITE' && !ctx.highRisk) {
    // Still allow with reduced weight via picker; mark ineligible only if neither.
    // Soft gate: keep eligible so D1 elite nodes can roll it.
  }
  if (
    template.compatibleOperations
    && ctx.operationKind
    && template.compatibleOperations.length > 0
    && !template.compatibleOperations.includes(ctx.operationKind)
    && (template.requiresAnchorSignal || template.requiresEchoSignal)
  ) {
    // Overlay-required templates stay overlay-gated; op mismatch alone doesn't block.
  }
  return true;
}

function weightForTemplate(
  template: EncounterCompositionTemplate,
  ctx: CompositionPickContext,
): number {
  let weight = template.weight;
  if (template.elitePreferred && ctx.squadTier === 'ELITE') weight += 24;
  if (template.requiresHighValue && ctx.highValue) weight += 30;
  if (template.requiresHighRisk && ctx.highRisk) weight += 30;
  if (template.requiresAnchorSignal && (ctx.anchorSignal || ctx.nodeTier === 'ANCHOR')) {
    weight += 36;
  }
  if (template.requiresEchoSignal && ctx.echoSignal) weight += 36;
  if (template.id === 'BOSS_FORESHADOWING' && ctx.foreshadowBias) weight += 18;
  if (template.id === 'SIMPLE_PATROL' && ctx.depth === 1 && ctx.squadTier === 'NORMAL') {
    weight += 12;
  }
  if (template.elitePreferred && ctx.squadTier !== 'ELITE') weight = Math.max(1, Math.floor(weight * 0.25));
  if (template.requiresHighValue && !ctx.highValue) weight = 0;
  if (template.requiresHighRisk && !ctx.highRisk) weight = 0;
  if (template.requiresAnchorSignal && !ctx.anchorSignal && ctx.nodeTier !== 'ANCHOR') weight = 0;
  if (template.requiresEchoSignal && !ctx.echoSignal) weight = 0;
  return weight;
}

export function selectCompositionTemplate(
  ctx: CompositionPickContext,
  rand: () => number,
): EncounterCompositionTemplateId | null {
  if (debugForcedCompositionTemplate) {
    const forced = getEncounterCompositionTemplate(debugForcedCompositionTemplate);
    if (forced.allowedDepths.includes(ctx.depth)) return forced.id;
  }

  const weighted: Array<{ id: EncounterCompositionTemplateId; weight: number }> = [];
  for (const id of ALL_ENCOUNTER_COMPOSITION_TEMPLATE_IDS) {
    const template = ENCOUNTER_COMPOSITION_TEMPLATES[id];
    if (!templateEligible(template, ctx)) continue;
    const weight = weightForTemplate(template, ctx);
    if (weight <= 0) continue;
    weighted.push({ id, weight });
  }

  // Always keep a fallback soft template if overlays wiped everything.
  if (weighted.length === 0) {
    if (ctx.depth <= 2) return 'SIMPLE_PATROL';
    return 'SWARM_PRESSURE';
  }

  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rand() * total;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.id;
  }
  return weighted[weighted.length - 1]?.id ?? null;
}

function pickEnemyForRoles(
  roles: readonly CompositionEnemyRole[],
  pool: readonly EncounterEnemyKey[],
  used: ReadonlySet<EncounterEnemyKey>,
  rand: () => number,
  options: { preferVariant?: boolean; allowDuplicateSwarm?: boolean },
): EncounterEnemyKey | null {
  let candidates = pool.filter((key) => {
    if (used.has(key) && !options.allowDuplicateSwarm) return false;
    if (used.has(key) && options.allowDuplicateSwarm) {
      const role = getEnemyCompositionRole(key)?.primaryRole;
      if (role !== 'SWARM') return false;
    }
    return roles.some((role) => enemyMatchesCompositionRole(key, role));
  });

  if (options.preferVariant) {
    const variants = candidates.filter((key) =>
      (DEPTH_2_VARIANT_KEYS as readonly string[]).includes(key),
    );
    if (variants.length > 0) candidates = variants;
  }

  if (candidates.length === 0) return null;
  // Prefer lower threat within role for smoother budgets.
  candidates = [...candidates].sort(
    (a, b) => (getEnemyDefinition(a)?.threatCost ?? 2) - (getEnemyDefinition(b)?.threatCost ?? 2),
  );
  const idx = Math.floor(rand() * Math.min(candidates.length, 4));
  return candidates[idx] ?? candidates[0] ?? null;
}

export function fillCompositionTemplate(
  templateId: EncounterCompositionTemplateId,
  ctx: CompositionPickContext,
  rand: () => number,
): CompositionPickResult | null {
  const template = getEncounterCompositionTemplate(templateId);
  const slots = template.roleSlotsByDepth[ctx.depth];
  if (!slots || slots.length === 0) return null;

  const maxEnemies = template.maxEnemiesByDepth[ctx.depth] ?? 3;
  const pool = buildCandidatePool(ctx);
  if (pool.length === 0) return null;

  const picked: EncounterEnemyKey[] = [];
  const used = new Set<EncounterEnemyKey>();
  const rolesUsed: CompositionEnemyRole[] = [];

  for (const slot of slots) {
    const count = slot.count ?? 1;
    for (let i = 0; i < count; i += 1) {
      if (picked.length >= maxEnemies) break;
      const key = pickEnemyForRoles(slot.roles, pool, used, rand, {
        preferVariant: slot.preferVariant === true && ctx.depth >= 2,
        allowDuplicateSwarm: slot.roles.includes('SWARM'),
      });
      if (!key) {
        if (slot.required) return null;
        continue;
      }
      picked.push(key);
      used.add(key);
      const primary = getEnemyCompositionRole(key)?.primaryRole;
      if (primary) rolesUsed.push(primary);
    }
  }

  if (picked.length === 0) return null;

  const expectedOrigin = ctx.encounterOrigin;
  const mixedOriginPick = picked.some((key) => getEnemyOrigin(key) !== expectedOrigin);
  if (mixedOriginPick) return null;

  const fairnessOk = compositionPassesFairness(picked, {
    depth: ctx.depth,
    tier: ctx.squadTier,
    veilBiome: ctx.veilBiome,
    highRisk: ctx.highRisk,
    templateId,
    rewardTier: template.defaultRewardTier,
  });
  if (!fairnessOk) return null;

  const roster = assignPositions(picked);
  const synergyBiomes = ctx.veilBiome
    ? veilBiomeToSynergyBiomes(ctx.veilBiome)
    : (['CITY_STREETS'] as const);

  const squad: SynergySquadSpec = {
    id: `comp:${templateId}:${picked.join('+')}`,
    allowedDepths: [ctx.depth],
    allowedBiomes: [...synergyBiomes],
    roster,
    veilBiome: ctx.veilBiome ?? undefined,
    templateKind: templateId,
    encounterSquadOrigin: ctx.encounterOrigin === 'RIVAL_MERC' ? 'RIVAL_MERC' : 'VEIL',
  };

  if (!passesHardCounterRules(squad, {
    depth: ctx.depth,
    tier: ctx.squadTier,
    nodeTier: ctx.nodeTier,
  })) {
    return null;
  }

  if (!squadFitsThreatBudget(squad, ctx.threatBudget, ctx.squadTier)) {
    // Drop optional trailing units once if over budget.
    if (roster.length > 1) {
      const trimmed: SynergySquadSpec = {
        ...squad,
        roster: roster.slice(0, Math.max(1, roster.length - 1)),
        id: `${squad.id}:trim`,
      };
      if (
        squadFitsThreatBudget(trimmed, ctx.threatBudget, ctx.squadTier)
        && compositionPassesFairness(
          trimmed.roster.map((u) => u.type),
          {
            depth: ctx.depth,
            tier: ctx.squadTier,
            veilBiome: ctx.veilBiome,
            highRisk: ctx.highRisk,
            templateId,
            rewardTier: template.defaultRewardTier,
          },
        )
      ) {
        return {
          squad: trimmed,
          meta: {
            templateId,
            rolesUsed: trimmed.roster.map(
              (u) => getEnemyCompositionRole(u.type)?.primaryRole ?? 'BRUISER',
            ),
            rewardTier: template.defaultRewardTier,
          },
        };
      }
    }
    // Soft allow if still close (within +2 of budget) — deck fallback otherwise.
    if (squadThreatCost(squad) > ctx.threatBudget + 2) return null;
  }

  return {
    squad,
    meta: {
      templateId,
      rolesUsed,
      rewardTier: template.defaultRewardTier,
    },
  };
}

/**
 * Try role-template composition. Returns null to allow deck-pipeline fallback.
 */
export function tryPickCompositionSquad(
  ctx: CompositionPickContext,
  rand: () => number,
): CompositionPickResult | null {
  const attempts = 4;
  for (let i = 0; i < attempts; i += 1) {
    const templateId = selectCompositionTemplate(ctx, rand);
    if (!templateId) return null;
    const filled = fillCompositionTemplate(templateId, ctx, rand);
    if (filled) return filled;
  }
  return null;
}
