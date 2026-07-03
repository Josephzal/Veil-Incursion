import type { EncounterNodeTier, EncounterSquadTier, MechanicTag } from '../types/encounterSpawn';
import { getEnemyDefinition } from './enemyDefinitions';
import type { SynergySquadSpec } from './synergyEncounterTypes';

export interface HardCounterContext {
  depth: 1 | 2 | 3;
  tier: EncounterSquadTier;
  nodeTier: EncounterNodeTier;
}

const HARD_DENIAL_TAGS: readonly MechanicTag[] = [
  'TRUE_DAMAGE',
  'STAMINA_DRAIN',
  'SCALING_TIMER',
  'BACKLINE_TIMER',
  'UNREACHABLE_BACKLINE',
  'HARD_DENIAL',
];

/** Deck templates reserved for elite-tier procedural picks. */
export const ELITE_ONLY_TEMPLATE_KINDS = new Set([
  'ELITE_SYNERGY',
  'ALPHA_THREAT',
]);

export function collectSquadMechanicTags(squad: SynergySquadSpec): MechanicTag[] {
  const tags = new Set<MechanicTag>();
  for (const unit of squad.roster) {
    const def = getEnemyDefinition(unit.type);
    for (const tag of def?.mechanicTags ?? []) {
      tags.add(tag);
    }
  }
  return [...tags];
}

export function countHardDenialTags(tags: readonly MechanicTag[]): number {
  return tags.filter((tag) => HARD_DENIAL_TAGS.includes(tag)).length;
}

export function passesHardCounterRules(
  squad: SynergySquadSpec,
  ctx: HardCounterContext,
): boolean {
  const tags = collectSquadMechanicTags(squad);
  const hardDenialCount = countHardDenialTags(tags);

  if (ctx.tier === 'NORMAL' && hardDenialCount > 1) return false;
  if (ctx.tier === 'ELITE' && hardDenialCount > 2) return false;
  if (ctx.depth === 1 && ctx.tier === 'NORMAL' && tags.includes('TRUE_DAMAGE')) {
    return false;
  }
  if (tags.includes('MUST_DEFEND') && tags.includes('CANNOT_DEFEND')) {
    return false;
  }
  return true;
}

/** Validation tier used when auditing a squad in the deck catalog. */
export function squadCatalogValidationTier(squad: SynergySquadSpec): EncounterSquadTier {
  if (squad.templateKind && ELITE_ONLY_TEMPLATE_KINDS.has(squad.templateKind)) {
    return 'ELITE';
  }
  return 'NORMAL';
}

/** Whether a squad may be picked for the current procedural tier roll. */
export function squadEligibleForPickTier(
  squad: SynergySquadSpec,
  squadTier: EncounterSquadTier,
): boolean {
  if (squadTier === 'NORMAL' && squad.templateKind && ELITE_ONLY_TEMPLATE_KINDS.has(squad.templateKind)) {
    return false;
  }
  return true;
}
