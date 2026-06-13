import type { CargoRunState } from '../../types/cargoGrid';
import type { FactionType, NarrativeChoiceOption, NarrativeEventNode } from '../../types/game';
import type { MacroBiomeFamily, ProceduralNarrativeAssembly, RunDepth } from '../../types/narrativeProcedural';
import type {
  Biome,
  CabalResolver,
  GeneratedEncounter,
  ItemResolver,
  NarrativePenalty,
  OptionDResolver,
  Tag,
} from '../../types/narrativeAssembly';
import {
  cabalToFaction,
  isOptionDBruteForce,
  isOptionDRetreat,
  jsonItemToCargoItemId,
  macroFamilyToBiome,
} from '../../types/narrativeAssembly';
import { getDistrictFromDepth, depthFromNodesCleared } from '../districtPacing';
import { hasCargoItem } from '../cargoGridEngine';
import type { ProceduralEligibilityContext } from './narrativeProceduralEngine';
import { generateEncounter, type NarrativePlayerState } from './NarrativeEngine';
import {
  getComplicationSeedById,
  getContextSeedById,
  getResolverSetById,
} from './narrativeCatalog';

export interface PickAssemblyEncounterParams {
  macroFamily: MacroBiomeFamily;
  nodesCleared: number;
  seed: string;
  usedAssemblyIds: readonly string[];
  requiredContextTags?: readonly string[];
}

function runDepthFromNodesCleared(nodesCleared: number): RunDepth {
  return getDistrictFromDepth(depthFromNodesCleared(nodesCleared));
}

function contextTitle(contextId: string, flavorText: string): string {
  const snippet = flavorText.split('.')[0]?.trim().toUpperCase() ?? contextId;
  if (snippet.length <= 44) return snippet;
  return `${snippet.slice(0, 44)}…`;
}

function formatPenaltyPreview(penalty: NarrativePenalty): string {
  if (penalty.type === 'HP') return `ON FAIL: -${penalty.amount} HP`;
  return `ON FAIL: +${penalty.amount} RESONANCE`;
}

function buildChoiceOption(
  label: string,
  requirement: string,
  successText: string,
  failureText: string,
  effectPreview: string,
  locked = false,
  lockReason?: string,
): NarrativeChoiceOption {
  return {
    label,
    requirement,
    successText,
    failureText,
    effectPreview: { guaranteed: effectPreview },
    locked,
    lockReason,
  };
}

function cabalRequirementLabel(cabal: CabalResolver['requirementValue']): string {
  return cabal.replace(/_/g, ' ').toUpperCase();
}

function itemRequirementLabel(itemId: string): string {
  return itemId.replace(/_/g, ' ').toUpperCase();
}

export function evaluateCabalResolverEligibility(
  resolver: CabalResolver,
  alignedFaction: FactionType | null,
): { locked: boolean; lockReason?: string } {
  const requiredFaction = cabalToFaction(resolver.requirementValue);
  if (requiredFaction == null) {
    return { locked: true, lockReason: 'REQUIRES CABAL ALIGNMENT' };
  }
  if (requiredFaction !== alignedFaction) {
    return { locked: true, lockReason: `REQUIRES ${cabalRequirementLabel(resolver.requirementValue)} CABAL` };
  }
  return { locked: false };
}

export function evaluateItemResolverEligibility(
  resolver: ItemResolver,
  cargo: CargoRunState,
): { locked: boolean; lockReason?: string } {
  const cargoItemId = jsonItemToCargoItemId(resolver.requirementValue);
  if (!cargoItemId) {
    return { locked: true, lockReason: `ITEM NOT IN CATALOG: ${itemRequirementLabel(resolver.requirementValue)}` };
  }
  if (!hasCargoItem(cargo, cargoItemId)) {
    return { locked: true, lockReason: `REQUIRES ITEM: ${itemRequirementLabel(resolver.requirementValue)}` };
  }
  return { locked: false };
}

function optionDRequirement(optionD: OptionDResolver): string {
  if (isOptionDRetreat(optionD)) return 'RETURN TO MAP';
  if (isOptionDBruteForce(optionD)) return 'GUARANTEED COST — NO MINI-GAME';
  return 'RESOLVER';
}

function buildNodeFromEncounter(
  encounter: GeneratedEncounter,
  eligibility: ProceduralEligibilityContext,
): NarrativeEventNode {
  const { context, complication, resolverSet } = encounter;
  const penaltyPreview = formatPenaltyPreview(complication.defaultPenalty);
  const cabalGate = evaluateCabalResolverEligibility(resolverSet.optionB, eligibility.alignedFaction);
  const itemGate = evaluateItemResolverEligibility(resolverSet.optionC, eligibility.cargo);

  return {
    id: encounter.assemblyId,
    interactionMode: 'procedural',
    title: contextTitle(context.id, context.flavorText),
    scenarioText: encounter.scenarioText,
    hazardPreview: penaltyPreview,
    proceduralMeta: {
      engineVersion: 'assembly-v1',
      resolverSetId: resolverSet.id,
      tensionMechanic: resolverSet.optionA.tensionMechanic,
      defaultPenalty: complication.defaultPenalty,
    },
    choiceA: buildChoiceOption(
      `[ A ] ${resolverSet.optionA.text}`,
      resolverSet.optionA.tensionMechanic.replace('Mechanic_', '').toUpperCase(),
      `>> MECHANIC SUCCESS — ${resolverSet.optionA.onSuccess}`,
      `>> MECHANIC FAILURE — ${resolverSet.optionA.onFailure}`,
      `${resolverSet.optionA.onSuccess} // ${penaltyPreview}`,
    ),
    choiceB: buildChoiceOption(
      `[ B ] ${resolverSet.optionB.text}`,
      cabalRequirementLabel(resolverSet.optionB.requirementValue),
      `>> CABAL BYPASS — ${resolverSet.optionB.onSuccess}`,
      '>> CABAL BYPASS BLOCKED — ALIGNMENT REQUIRED.',
      resolverSet.optionB.onSuccess,
      cabalGate.locked,
      cabalGate.lockReason,
    ),
    choiceC: buildChoiceOption(
      `[ C ] ${resolverSet.optionC.text}`,
      itemRequirementLabel(resolverSet.optionC.requirementValue),
      `>> ITEM BYPASS — ${resolverSet.optionC.onSuccess}`,
      '>> ITEM BYPASS BLOCKED — CARGO ITEM REQUIRED.',
      resolverSet.optionC.onSuccess,
      itemGate.locked,
      itemGate.lockReason,
    ),
    choiceD: buildChoiceOption(
      `[ D ] ${resolverSet.optionD.text}`,
      optionDRequirement(resolverSet.optionD),
      isOptionDRetreat(resolverSet.optionD)
        ? '>> ABORT CONFIRMED — ROUTING TERMINAL BACK TO LEY-LINE GRID.'
        : `>> BRUTE RESOLVER — ${resolverSet.optionD.onSuccess}`,
      isOptionDRetreat(resolverSet.optionD)
        ? '>> ABORT CONFIRMED — ROUTING TERMINAL BACK TO LEY-LINE GRID.'
        : `>> BRUTE RESOLVER — ${resolverSet.optionD.onSuccess}`,
      resolverSet.optionD.onSuccess,
    ),
  };
}

export function buildAssemblyFromEncounter(
  encounter: GeneratedEncounter,
  macroFamily: MacroBiomeFamily,
  nodesCleared: number,
): ProceduralNarrativeAssembly {
  return {
    assemblyId: encounter.assemblyId,
    macroFamily,
    depth: runDepthFromNodesCleared(nodesCleared),
    contextId: encounter.context.id,
    complicationId: encounter.complication.id,
    engineVersion: 'assembly-v1',
    resolverSetId: encounter.resolverSet.id,
    biome: encounter.biome,
    tensionMechanic: encounter.resolverSet.optionA.tensionMechanic,
    defaultPenalty: encounter.complication.defaultPenalty,
    resolverIds: {
      brute: encounter.complication.id,
      cabal: encounter.resolverSet.id,
      item: encounter.resolverSet.id,
      retreat: 'static-retreat',
    },
  };
}

export function pickAssemblyNarrativeEncounter(
  params: PickAssemblyEncounterParams,
  eligibility: ProceduralEligibilityContext,
): { assembly: ProceduralNarrativeAssembly; node: NarrativeEventNode } {
  const biome: Biome = macroFamilyToBiome(params.macroFamily) ?? 'city_streets';
  const playerState: NarrativePlayerState = {
    seed: params.seed,
    usedAssemblyIds: params.usedAssemblyIds,
    requiredContextTags: params.requiredContextTags as Tag[] | undefined,
  };
  const encounter = generateEncounter(biome, playerState);
  const assembly = buildAssemblyFromEncounter(encounter, params.macroFamily, params.nodesCleared);
  const node = buildNodeFromEncounter(encounter, eligibility);
  return { assembly, node };
}

export function refreshAssemblyNarrativeLocks(
  node: NarrativeEventNode,
  assembly: ProceduralNarrativeAssembly,
  eligibility: ProceduralEligibilityContext,
): NarrativeEventNode {
  if (assembly.engineVersion !== 'assembly-v1' || node.interactionMode !== 'procedural') {
    return node;
  }
  const resolverSet = assembly.resolverSetId
    ? getResolverSetById(assembly.resolverSetId)
    : undefined;
  if (!resolverSet) return node;

  const cabalGate = evaluateCabalResolverEligibility(resolverSet.optionB, eligibility.alignedFaction);
  const itemGate = evaluateItemResolverEligibility(resolverSet.optionC, eligibility.cargo);

  return {
    ...node,
    choiceB: {
      ...node.choiceB,
      locked: cabalGate.locked,
      lockReason: cabalGate.lockReason,
    },
    choiceC: node.choiceC
      ? {
          ...node.choiceC,
          locked: itemGate.locked,
          lockReason: itemGate.lockReason,
        }
      : undefined,
  };
}

export function lookupAssemblyEncounterParts(assembly: ProceduralNarrativeAssembly): GeneratedEncounter | null {
  if (assembly.engineVersion !== 'assembly-v1') return null;
  const context = getContextSeedById(assembly.contextId);
  const complication = getComplicationSeedById(assembly.complicationId);
  const resolverSet = assembly.resolverSetId
    ? getResolverSetById(assembly.resolverSetId)
    : undefined;
  if (!context || !complication || !resolverSet || !assembly.biome) return null;
  return {
    assemblyId: assembly.assemblyId,
    biome: assembly.biome,
    context,
    complication,
    resolverSet,
    scenarioText: `${context.flavorText} ${complication.flavorText}`.trim(),
  };
}
