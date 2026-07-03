import type { EncounterSquadTier } from '../types/encounterSpawn';
import { THREAT_BUDGET_RANGES } from '../types/encounterSpawn';
import { buildEncounterDeck, buildEliteDeck } from './encounterDeckBuilder';
import { ENEMY_ROSTER } from './enemyRoster';
import {
  collectSquadMechanicTags,
  countHardDenialTags,
  passesHardCounterRules,
  squadCatalogValidationTier,
} from './encounterHardCounterEngine';
import { squadFitsThreatBudget, squadThreatCost } from './encounterThreatBudget';
import { proceduralNodeToIncursionNode } from './proceduralScannerBridge';
import { veilBiomeToLegacyMacroBiome } from './sectorBiomeBridge';
import type { SynergySquadSpec } from './synergyEncounterTypes';

function allDeckSquads(): SynergySquadSpec[] {
  return [...buildEncounterDeck(), ...buildEliteDeck()];
}

/** Phase 9 — threat budget table sanity. */
export function verifyThreatBudgetTable(): void {
  for (const depth of [1, 2, 3] as const) {
    for (const tier of ['NORMAL', 'ELITE'] as const) {
      const range = THREAT_BUDGET_RANGES[depth][tier];
      if (range.min > range.max) {
        throw new Error(`verifyThreatBudgetTable: invalid range D${depth} ${tier}`);
      }
      if (range.min < 1) {
        throw new Error(`verifyThreatBudgetTable: min below 1 D${depth} ${tier}`);
      }
    }
  }
}

function assertSquadHardCounter(
  squad: SynergySquadSpec,
  depth: 1 | 2 | 3,
  tier: EncounterSquadTier,
): void {
  const nodeTier = tier === 'ELITE' ? 'ELITE' : 'NORMAL';
  if (!passesHardCounterRules(squad, { depth, tier, nodeTier })) {
    const tags = collectSquadMechanicTags(squad);
    throw new Error(
      `verifyHardCounterDeck: ${squad.id} D${depth} ${tier} failed (tags=${tags.join(',')}, denial=${countHardDenialTags(tags)})`,
    );
  }
}

function assertSquadThreatBudget(
  squad: SynergySquadSpec,
  depth: 1 | 2 | 3,
  tier: EncounterSquadTier,
): void {
  const maxBudget = THREAT_BUDGET_RANGES[depth][tier].max;
  if (!squadFitsThreatBudget(squad, maxBudget, tier)) {
    throw new Error(
      `verifyThreatBudgetDeck: ${squad.id} D${depth} ${tier} cost=${squadThreatCost(squad)} exceeds max=${maxBudget}`,
    );
  }
}

/** Phase 9 — deck squads must pass hard-counter rules at their validation tier. */
export function verifyHardCounterDeck(): void {
  for (const squad of allDeckSquads()) {
    for (const depth of squad.allowedDepths) {
      const tier = squadCatalogValidationTier(squad);
      assertSquadHardCounter(squad, depth, tier);
    }
  }
}

/** Phase 9 — deck squads must fit max threat budget at their validation tier. */
export function verifyThreatBudgetDeck(): void {
  for (const squad of allDeckSquads()) {
    for (const depth of squad.allowedDepths) {
      const tier = squadCatalogValidationTier(squad);
      assertSquadThreatBudget(squad, depth, tier);
    }
  }
}

export function verifyEncounterSpawnValidation(): void {
  verifyThreatBudgetTable();
  verifyHardCounterDeck();
  verifyThreatBudgetDeck();
  verifyLegacySpawnCleanup();
  verifyScannerBiomePolish();
}

/** Polish — procedural scanner nodes stamp sector-locked Veil biome, not faction shims. */
export function verifyScannerBiomePolish(): void {
  const node = proceduralNodeToIncursionNode(
    {
      id: 'polish-test',
      type: 'COMBAT',
      depth: 1,
      children: [],
      faction: 'SOLARIS',
    },
    0,
    'NULL_ZONE',
  );
  const expected = veilBiomeToLegacyMacroBiome('NULL_ZONE');
  if (node.offeredMacroBiome !== expected) {
    throw new Error(
      `verifyScannerBiomePolish: expected ${expected}, got ${node.offeredMacroBiome ?? 'undefined'}`,
    );
  }
  if (!node.label.startsWith('NULL ZONE //')) {
    throw new Error(`verifyScannerBiomePolish: label missing Veil biome prefix (${node.label})`);
  }
}

/** Phase 10 — no faction-era spawn flags or deprecated roster fields remain. */
export function verifyLegacySpawnCleanup(): void {
  for (const entry of Object.values(ENEMY_ROSTER)) {
    if ('isCabalHuman' in entry && (entry as { isCabalHuman?: boolean }).isCabalHuman) {
      throw new Error(`verifyLegacySpawnCleanup: ${entry.id} still has isCabalHuman`);
    }
    if ('cabalClassLabel' in entry && (entry as { cabalClassLabel?: string }).cabalClassLabel) {
      throw new Error(`verifyLegacySpawnCleanup: ${entry.id} still has cabalClassLabel`);
    }
  }

  const deck = allDeckSquads();
  for (const squad of deck) {
    if (squad.id.startsWith('CABAL_') || squad.id.startsWith('CORRUPT_') || squad.id.startsWith('SQUAD_')) {
      throw new Error(`verifyLegacySpawnCleanup: legacy squad id ${squad.id}`);
    }
  }
}
