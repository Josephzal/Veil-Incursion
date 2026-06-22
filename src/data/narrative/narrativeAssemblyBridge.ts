import type { CargoRunState } from '../../types/cargoGrid';
import type {
  ClassType,
  FactionType,
  NarrativeChoiceOption,
  NarrativeEventNode,
} from '../../types/game';
import type { MacroBiomeFamily, ProceduralNarrativeAssembly, RunDepth } from '../../types/narrativeProcedural';
import type {
  Biome,
  CabalResolver,
  ClassResolver,
  GeneratedEncounter,
  ItemResolver,
  MechanicResolver,
  OptionAResolver,
  OptionBResolver,
  Tag,
} from '../../types/narrativeAssembly';
import {
  cabalToFaction,
  isOptionABruteForce,
  isOptionBCabalResolver,
  isOptionBClassResolver,
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
  USE_ASSEMBLY_V2,
} from './narrativeCatalog';
import {
  assembleDynamicResolverSet,
  formatCriticalHazard,
} from './narrativeDynamicAssembly';

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

function classRequirementLabel(classType: ClassType): string {
  return classType.replace(/_/g, ' ');
}

function itemRequirementLabel(itemId: string): string {
  return itemId.replace(/_/g, ' ').toUpperCase();
}

function optionBRequirementLabel(optionB: OptionBResolver): string {
  if (isOptionBClassResolver(optionB)) {
    return `[REQUIRES CLASS: ${classRequirementLabel(optionB.requirementValue)}]`;
  }
  return `[REQUIRES ${cabalRequirementLabel(optionB.requirementValue)} CABAL]`;
}

export function evaluateCabalResolverEligibility(
  resolver: CabalResolver,
  alignedFaction: FactionType | null,
  activeClass: ClassType = 'AEGIS',
): { locked: boolean; lockReason?: string } {
  if (resolver.requirementValue === 'Aegis_Vanguard') {
    if (activeClass !== 'AEGIS') {
      return { locked: true, lockReason: 'REQUIRES AEGIS VANGUARD CLASS' };
    }
    return { locked: false };
  }
  const requiredFaction = cabalToFaction(resolver.requirementValue);
  if (requiredFaction == null) {
    return {
      locked: true,
      lockReason: `REQUIRES ${cabalRequirementLabel(resolver.requirementValue)} CABAL`,
    };
  }
  if (requiredFaction !== alignedFaction) {
    return { locked: true, lockReason: `REQUIRES ${cabalRequirementLabel(resolver.requirementValue)} CABAL` };
  }
  return { locked: false };
}

export function evaluateClassResolverEligibility(
  resolver: ClassResolver,
  activeClass: ClassType,
): { locked: boolean; lockReason?: string } {
  if (resolver.requirementValue !== activeClass) {
    return {
      locked: true,
      lockReason: `REQUIRES CLASS: ${classRequirementLabel(resolver.requirementValue)}`,
    };
  }
  return { locked: false };
}

export function evaluateOptionBEligibility(
  optionB: OptionBResolver,
  eligibility: ProceduralEligibilityContext,
): { locked: boolean; lockReason?: string } {
  const activeClass = eligibility.activeClass ?? 'AEGIS';
  if (isOptionBClassResolver(optionB)) {
    return evaluateClassResolverEligibility(optionB, activeClass);
  }
  return evaluateCabalResolverEligibility(optionB, eligibility.alignedFaction, activeClass);
}

export function evaluateItemResolverEligibility(
  resolver: ItemResolver,
  cargo: CargoRunState,
): { locked: boolean; lockReason?: string } {
  const cargoItemId = jsonItemToCargoItemId(resolver.requirementValue);
  if (!cargoItemId) {
    return { locked: true, lockReason: `REQUIRES ITEM: ${itemRequirementLabel(resolver.requirementValue)}` };
  }
  if (!hasCargoItem(cargo, cargoItemId)) {
    return { locked: true, lockReason: `REQUIRES ITEM: ${itemRequirementLabel(resolver.requirementValue)}` };
  }
  return { locked: false };
}

function asMechanicResolver(optionA: OptionAResolver): MechanicResolver | null {
  return isOptionABruteForce(optionA) ? null : optionA;
}

function isV2Encounter(encounter: GeneratedEncounter): boolean {
  return USE_ASSEMBLY_V2 || encounter.resolverSet.assemblyMode === 'dynamic-v2';
}

function buildNodeFromEncounter(
  encounter: GeneratedEncounter,
  eligibility: ProceduralEligibilityContext,
): NarrativeEventNode {
  const { context, complication, resolverSet } = encounter;
  const v2 = isV2Encounter(encounter);
  const optionBGate = evaluateOptionBEligibility(resolverSet.optionB, eligibility);
  const itemGate = evaluateItemResolverEligibility(resolverSet.optionC, eligibility.cargo);
  const hazardPreview = v2
    ? formatCriticalHazard(complication.defaultPenalty)
    : complication.defaultPenalty.type === 'HP'
      ? `ON FAIL: -${complication.defaultPenalty.amount} HP`
      : `ON FAIL: +${complication.defaultPenalty.amount} RESONANCE`;

  const engineVersion = v2 ? 'assembly-v2' : 'assembly-v1';
  const mechanicA = asMechanicResolver(resolverSet.optionA);

  return {
    id: encounter.assemblyId,
    interactionMode: 'procedural',
    title: contextTitle(context.id, context.flavorText),
    scenarioText: encounter.scenarioText,
    hazardPreview,
    proceduralMeta: {
      engineVersion,
      resolverSetId: resolverSet.id,
      tensionMechanic: mechanicA?.tensionMechanic,
      defaultPenalty: complication.defaultPenalty,
      bonusReward: encounter.bonusReward,
    },
    choiceA: mechanicA == null
      ? buildChoiceOption(
        `[ A ] ${resolverSet.optionA.text}`,
        'GUARANTEED COST — BRUTE FORCE',
        `>> BRUTE FORCE — ${resolverSet.optionA.onSuccess}`,
        `>> BRUTE FORCE BLOCKED — RESOLVER UNAVAILABLE.`,
        resolverSet.optionA.onSuccess,
      )
      : buildChoiceOption(
        `[ A ] ${mechanicA.text}`,
        mechanicA.tensionMechanic.replace('Mechanic_', '').toUpperCase(),
        `>> MECHANIC SUCCESS — ${mechanicA.onSuccess}`,
        `>> MECHANIC FAILURE — ${mechanicA.onFailure}`,
        `${mechanicA.onSuccess} // ${hazardPreview}`,
      ),
    choiceB: buildChoiceOption(
      `[ B ] ${resolverSet.optionB.text}`,
      optionBRequirementLabel(resolverSet.optionB),
      isOptionBClassResolver(resolverSet.optionB)
        ? `>> CLASS BYPASS — ${resolverSet.optionB.onSuccess}`
        : `>> CABAL BYPASS — ${resolverSet.optionB.onSuccess}`,
      isOptionBClassResolver(resolverSet.optionB)
        ? '>> CLASS BYPASS BLOCKED — CLASS REQUIRED.'
        : '>> CABAL BYPASS BLOCKED — ALIGNMENT REQUIRED.',
      resolverSet.optionB.onSuccess,
      optionBGate.locked,
      optionBGate.lockReason,
    ),
    choiceC: buildChoiceOption(
      `[ C ] ${resolverSet.optionC.text}`,
      `[REQUIRES ITEM: ${itemRequirementLabel(resolverSet.optionC.requirementValue)}]`,
      `>> ITEM BYPASS — ${resolverSet.optionC.onSuccess}`,
      '>> ITEM BYPASS BLOCKED — CARGO ITEM REQUIRED.',
      resolverSet.optionC.onSuccess,
      itemGate.locked,
      itemGate.lockReason,
    ),
    choiceD: buildChoiceOption(
      `[ D ] ${resolverSet.optionD.text}`,
      'RETURN TO SCANNER',
      '>> ABORT CONFIRMED — ROUTING TERMINAL BACK TO LEY-LINE GRID.',
      '>> ABORT CONFIRMED — ROUTING TERMINAL BACK TO LEY-LINE GRID.',
      isOptionDRetreat(resolverSet.optionD) ? 'No reward. No penalty.' : resolverSet.optionD.onSuccess,
    ),
  };
}

export function buildAssemblyFromEncounter(
  encounter: GeneratedEncounter,
  macroFamily: MacroBiomeFamily,
  nodesCleared: number,
): ProceduralNarrativeAssembly {
  const v2 = isV2Encounter(encounter);
  const mechanicA = asMechanicResolver(encounter.resolverSet.optionA);
  return {
    assemblyId: encounter.assemblyId,
    macroFamily,
    depth: runDepthFromNodesCleared(nodesCleared),
    contextId: encounter.context.id,
    complicationId: encounter.complication.id,
    engineVersion: v2 ? 'assembly-v2' : 'assembly-v1',
    resolverSetId: encounter.resolverSet.id,
    resolverTemplateIds: encounter.dynamicSelection,
    biome: encounter.biome,
    tensionMechanic: mechanicA?.tensionMechanic,
    defaultPenalty: encounter.complication.defaultPenalty,
    resolverIds: {
      brute: encounter.complication.id,
      cabal: encounter.resolverSet.id,
      item: encounter.resolverSet.id,
      retreat: 'static-retreat',
    },
    bonusReward: encounter.bonusReward,
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

function resolveEncounterResolverSet(
  assembly: ProceduralNarrativeAssembly,
): GeneratedEncounter['resolverSet'] | undefined {
  if (assembly.engineVersion === 'assembly-v2') {
    const complication = getComplicationSeedById(assembly.complicationId);
    if (!complication || !assembly.resolverTemplateIds) return undefined;
    return assembleDynamicResolverSet(
      complication,
      assembly.resolverSetId ?? assembly.assemblyId,
      assembly.resolverTemplateIds,
    );
  }
  return assembly.resolverSetId ? getResolverSetById(assembly.resolverSetId) : undefined;
}

export function refreshAssemblyNarrativeLocks(
  node: NarrativeEventNode,
  assembly: ProceduralNarrativeAssembly,
  eligibility: ProceduralEligibilityContext,
): NarrativeEventNode {
  if (
    (assembly.engineVersion !== 'assembly-v1' && assembly.engineVersion !== 'assembly-v2')
    || node.interactionMode !== 'procedural'
  ) {
    return node;
  }
  const resolverSet = resolveEncounterResolverSet(assembly);
  if (!resolverSet) return node;

  const optionBGate = evaluateOptionBEligibility(resolverSet.optionB, eligibility);
  const itemGate = evaluateItemResolverEligibility(resolverSet.optionC, eligibility.cargo);

  return {
    ...node,
    choiceB: {
      ...node.choiceB,
      locked: optionBGate.locked,
      lockReason: optionBGate.lockReason,
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
  if (assembly.engineVersion !== 'assembly-v1' && assembly.engineVersion !== 'assembly-v2') return null;
  const context = getContextSeedById(assembly.contextId);
  const complication = getComplicationSeedById(assembly.complicationId);
  const resolverSet = resolveEncounterResolverSet(assembly);
  if (!context || !complication || !resolverSet || !assembly.biome) return null;
  return {
    assemblyId: assembly.assemblyId,
    biome: assembly.biome,
    context,
    complication,
    resolverSet,
    scenarioText: `${context.flavorText} ${complication.flavorText}`.trim(),
    bonusReward: assembly.bonusReward,
    dynamicSelection: assembly.resolverTemplateIds,
  };
}
