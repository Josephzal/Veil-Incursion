import type { ClassType, FactionType, IncursionNode, NarrativeEventNode } from '../types/game';
import type { ProceduralNarrativeAssembly } from '../types/narrativeProcedural';
import type { TensionMechanic } from '../types/narrativeAssembly';
import type { DevSandboxPreset } from '../types/devSandbox';
import { createDefaultCargoRunState } from '../types/cargoGrid';
import { stampEchoTemplateOnModifiers } from './echoRecoveryEngine';
import { getEchoEliteTemplate } from './echoEliteCatalog';
import {
  pickAssemblyNarrativeEncounter,
} from './narrative/narrativeAssemblyBridge';
import type { ProceduralEligibilityContext } from './narrative/narrativeProceduralEngine';
import { formatTensionMechanicLabel } from '../components/narrative/tension/tensionMechanicTypes';

const TENSION_BY_PRESET: Record<
  Extract<DevSandboxPreset, 'narrative-scavenge' | 'narrative-conceal' | 'narrative-sigil'>,
  TensionMechanic
> = {
  'narrative-scavenge': 'Mechanic_ScavengeBar',
  'narrative-conceal': 'Mechanic_ConcealSlider',
  'narrative-sigil': 'Mechanic_SigilTrace',
};

export function resolveDevSandboxTensionMechanic(
  preset: DevSandboxPreset,
): TensionMechanic | null {
  if (preset in TENSION_BY_PRESET) {
    return TENSION_BY_PRESET[preset as keyof typeof TENSION_BY_PRESET];
  }
  return null;
}

export function buildDevSandboxNarrativeEncounter(
  tensionMechanic: TensionMechanic,
  eligibility: ProceduralEligibilityContext,
): { node: NarrativeEventNode; assembly: ProceduralNarrativeAssembly } {
  const encounter = pickAssemblyNarrativeEncounter(
    {
      macroFamily: 'CITY_STREETS',
      nodesCleared: 4,
      seed: `dev-sandbox:${tensionMechanic}`,
      usedAssemblyIds: [],
    },
    eligibility,
  );
  const mechanicLabel = formatTensionMechanicLabel(tensionMechanic);
  const node: NarrativeEventNode = {
    ...encounter.node,
    scenarioText: [
      '>> DEV SANDBOX — PROCEDURAL NARRATIVE PREVIEW.',
      'Field telemetry confirms an unstable extraction corridor ahead.',
      `Option A routes through the ${mechanicLabel} tension protocol.`,
    ].join(' '),
    proceduralMeta: {
      ...encounter.node.proceduralMeta,
      engineVersion: encounter.node.proceduralMeta?.engineVersion ?? 'assembly-v2',
      tensionMechanic,
      defaultPenalty: encounter.node.proceduralMeta?.defaultPenalty ?? { type: 'HP', amount: 12 },
    },
    choiceA: {
      ...encounter.node.choiceA,
      label: `[ A ] ${mechanicLabel} PROTOCOL`,
      requirement: mechanicLabel,
    },
  };
  const assembly: ProceduralNarrativeAssembly = {
    ...encounter.assembly,
    tensionMechanic,
  };
  return { node, assembly };
}

export function buildDevSandboxCombatNode(type: 'STANDARD_COMBAT' | 'ELITE_COMBAT'): IncursionNode {
  return {
    id: `dev-sandbox-${type.toLowerCase()}`,
    encounterIndex: 4,
    index: 4,
    encounterType: 'COMBAT',
    type,
    label: type === 'ELITE_COMBAT' ? 'DEV ELITE HOSTILE CLUSTER' : 'DEV STANDARD HOSTILE CLUSTER',
    isCompleted: false,
  };
}

export function buildDevSandboxHostileEchoNode(
  templateId = 'ECHO_FALLEN_AEGIS',
): IncursionNode {
  const template = getEchoEliteTemplate(templateId);
  const modifiers = stampEchoTemplateOnModifiers(
    {
      depthStage: 'BREACH',
      nodePressureBand: 'MEDIUM',
      echoSignal: true,
      echoSignalLabel: 'ECHO SIGNAL',
    },
    2,
    `dev-hostile-echo:${templateId}`,
    false,
  );

  return {
    id: 'dev-sandbox-hostile-echo',
    encounterIndex: 4,
    index: 4,
    encounterType: 'COMBAT',
    type: 'STANDARD_COMBAT',
    label: `DEV HOSTILE ECHO // ${template?.displayName.toUpperCase() ?? templateId}`,
    isCompleted: false,
    contextModifiers: modifiers,
  };
}

export function buildDevSandboxEligibility(
  activeClass: ClassType,
  alignedFaction: FactionType | null,
): ProceduralEligibilityContext {
  return {
    alignedFaction,
    cargo: createDefaultCargoRunState(),
    activeClass,
  };
}
