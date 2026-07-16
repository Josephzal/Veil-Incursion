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
  Extract<
    DevSandboxPreset,
    | 'narrative-scavenge'
    | 'narrative-conceal'
    | 'narrative-sigil'
    | 'narrative-cipher'
    | 'narrative-ley'
    | 'narrative-signal'
    | 'narrative-tumbler'
  >,
  TensionMechanic
> = {
  'narrative-scavenge': 'Mechanic_ScavengeBar',
  'narrative-conceal': 'Mechanic_ConcealSlider',
  'narrative-sigil': 'Mechanic_SigilTrace',
  'narrative-cipher': 'Mechanic_CipherRite',
  'narrative-ley': 'Mechanic_LeyCircuitBreach',
  'narrative-signal': 'Mechanic_SignalAlignment',
  'narrative-tumbler': 'Mechanic_SigilTumbler',
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
  const scenarioByMechanic: Record<TensionMechanic, string> = {
    Mechanic_CipherRite:
      'DEPRECATED in-game — DevTest only. Hostile VEIL-OS terminal: scan the memory dump and select the true cipher fragment before the lock reseals.',
    Mechanic_LeyCircuitBreach:
      'Corrupted ritual circuit board. Rotate ley-conduits to route the signal from the Source Sigil to the Exit Seal — and force it to arrive in the required Grid/Veil polarity before the Trace burns through.',
    Mechanic_ConcealSlider:
      'Watched cache under a hostile patrol sweep. Keep your signal inside the moving blind zone. Hostile sweeps compress the window. DAMP SIGNAL steadies your trace.',
    Mechanic_SigilTrace:
      'Occult sigil sequence with forbidden beats. Repeat the living pattern — skip the VOID pulses.',
    Mechanic_SignalAlignment:
      'DEPRECATED in-game — DevTest only. Hostile Veil lock: slot limited glyph keys into each ring to route signal into the core.',
    Mechanic_SigilTumbler:
      'Sealed occult-tech ward. Steer the wardpick to the hidden resonance angle, hold tension, and set all four glyph tumblers on the beat before Stability drains.',
    Mechanic_ScavengeBar:
      'Legacy instability protocol compatibility check. Deprecated loot tension — DevTest only.',
  };
  const node: NarrativeEventNode = {
    ...encounter.node,
    scenarioText: [
      '>> DEV SANDBOX — NARRATIVE TENSION PREVIEW.',
      scenarioByMechanic[tensionMechanic] ?? 'Field telemetry confirms an unstable extraction corridor ahead.',
      `Option A routes through the ${mechanicLabel} tension protocol.`,
    ].join(' '),
    proceduralMeta: {
      ...encounter.node.proceduralMeta,
      engineVersion: encounter.node.proceduralMeta?.engineVersion ?? 'assembly-v2',
      tensionMechanic,
      defaultPenalty: encounter.node.proceduralMeta?.defaultPenalty ?? { type: 'HP', amount: 12 },
      tensionDepth: 2,
      tensionDifficulty: 'MEDIUM',
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
