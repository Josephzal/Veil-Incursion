import type { IncursionNode, NarrativeEventNode } from '../types/game';

export const ECHO_FALLEN_RUNNER_NARRATIVE_ID = 'echo-fallen-runner';

export function buildEchoFallenRunnerNarrativeNode(
  encounterNode: IncursionNode,
): NarrativeEventNode {
  const label = encounterNode.contextModifiers?.echoSignalLabel ?? 'Fallen Runner Trace';
  return {
    id: ECHO_FALLEN_RUNNER_NARRATIVE_ID,
    matrixEventId: ECHO_FALLEN_RUNNER_NARRATIVE_ID,
    interactionMode: 'procedural',
    title: label.toUpperCase(),
    scenarioText:
      'A residual runner imprint hangs in the Veil — half corporeal, half telemetry. '
      + 'Cargo shadows drift around a collapsed breach seal. The imprint may still hold salvage, '
      + 'or it may lash out if disturbed.',
    choiceA: {
      label: '[ RESERVED ]',
      requirement: 'N/A',
      successText: '',
      failureText: '',
      locked: true,
      lockReason: 'Select a resolver option below.',
    },
    choiceB: {
      label: '[ B ] LOOT THE ECHO',
      requirement: 'OPEN RESOLVER',
      successText: '>> ECHO LOOTED — salvage routed to containment.',
      failureText: '>> ECHO LOOT FAILED — imprint destabilized.',
      effectPreview: { guaranteed: 'Echo-Glass / tags — ambush risk' },
    },
    choiceC: {
      label: '[ C ] STABILIZE THE ECHO',
      requirement: 'LEY-SLAG OFFERING',
      successText: '>> ECHO STABILIZED — imprint archived for Echo Recovery.',
      failureText: '>> STABILIZATION FAILED — insufficient materials.',
      effectPreview: { guaranteed: 'Operation progress if Echo Recovery active' },
    },
    choiceD: {
      label: '[ D ] LEAVE IT — RETURN TO SCANNER',
      requirement: 'RETURN TO SCANNER',
      successText: '>> ECHO LEFT UNDISTURBED — vector disengaged.',
      failureText: '>> ECHO LEFT UNDISTURBED — vector disengaged.',
      effectPreview: { guaranteed: 'No reward — no risk' },
    },
  };
}
