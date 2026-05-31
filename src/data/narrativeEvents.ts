import {
  CheckStatus,
  EnvironmentalModifiers,
  NarrativeEventNode,
} from '../types/game';

export const MOCK_NARRATIVE_NODES: NarrativeEventNode[] = [
  {
    id: 'breached-subsurface-grid',
    title: 'THE BREACHED SUBSURFACE GRID',
    scenarioText:
      'You descend into the St. Jude Hospital basement. Ley-line conduits pulse through cracked tile. ' +
      'A transformer vault sparks violet — the subsurface grid demands an electrical reroute before hostiles converge.',
    choiceA: {
      label: '[ A ] BYPASS OVERLOADED CIRCUIT BREAKERS',
      requirement: 'SIGNAL_CALIBRATION',
      successText:
        '>> CALIBRATION SUCCESS — Subsurface grid rerouted. Enemy phase shroud dispelled; telemetry clear.',
      failureText:
        '>> CALIBRATION FAILURE — Transformer detonation. Optic feed scorched. OPERATIVE BLINDED this engagement.',
    },
    choiceB: {
      label: '[ B ] FORCE MANUAL BREAKER SHUTDOWN',
      requirement: 'RAW_BRAND_WILLPOWER',
      successText:
        '>> WILLPOWER SUCCESS — Breakers seized. Grid stabilized without calibration matrix.',
      failureText:
        '>> WILLPOWER FAILURE — Arc flash. Hostile phase shroud intensifies across the basement grid.',
    },
  },
  {
    id: 'collapsed-structural-vent',
    title: 'THE COLLAPSED STRUCTURAL VENT',
    scenarioText:
      'A collapsed maintenance duct blocks the only path forward. Rusted rebar juts from a vent gate half-sealed by debris. ' +
      'Something moves in the dark beyond — you must traverse the gap before the anomaly closes in.',
    choiceA: {
      label: '[ A ] WIGGLE THROUGH RUSTY VENT GATE',
      requirement: 'SIGNAL_CALIBRATION',
      successText:
        '>> TRAVERSAL SUCCESS — Vent cleared. Structural integrity holds; no biological contamination detected.',
      failureText:
        '>> TRAVERSAL FAILURE — Rusty fence puncture. TETANUS GLITCH flagged. Stamina ceiling reduced to 50.',
    },
    choiceB: {
      label: '[ B ] BRUTE-FORCE THE COLLAPSED GRATE',
      requirement: 'RAW_BRAND_WILLPOWER',
      successText:
        '>> BRUTE SUCCESS — Grate torn free. Path secured at cost of structural noise.',
      failureText:
        '>> BRUTE FAILURE — Collapse triggers dust choke. Minor stamina bleed on entry.',
    },
  },
];

export function pickNarrativeForNode(nodeIndex: number): NarrativeEventNode {
  return MOCK_NARRATIVE_NODES[nodeIndex % MOCK_NARRATIVE_NODES.length];
}

export function primeNarrativeEnvironment(node: NarrativeEventNode): EnvironmentalModifiers {
  if (node.id === 'breached-subsurface-grid') {
    return {
      isEnemyPhaseShrouded: true,
      isPlayerBlinded: false,
      hasTetanusGlitch: false,
      startingStaminaPenalty: 0,
    };
  }
  return {
    isEnemyPhaseShrouded: false,
    isPlayerBlinded: false,
    hasTetanusGlitch: false,
    startingStaminaPenalty: 0,
  };
}

export function resolveNarrativeOutcome(
  node: NarrativeEventNode,
  choice: 'A' | 'B',
  status: CheckStatus,
  current: EnvironmentalModifiers,
): EnvironmentalModifiers {
  const next = { ...current };

  if (node.id === 'breached-subsurface-grid' && choice === 'A') {
    if (status === 'SUCCESS') {
      next.isEnemyPhaseShrouded = false;
    } else if (status === 'FAILURE') {
      next.isPlayerBlinded = true;
    }
    return next;
  }

  if (node.id === 'collapsed-structural-vent' && choice === 'A') {
    if (status === 'FAILURE') {
      next.hasTetanusGlitch = true;
      next.startingStaminaPenalty = 50;
    }
    return next;
  }

  if (node.id === 'breached-subsurface-grid' && choice === 'B') {
    if (status === 'FAILURE') {
      next.isEnemyPhaseShrouded = true;
    } else {
      next.isEnemyPhaseShrouded = false;
    }
    return next;
  }

  if (node.id === 'collapsed-structural-vent' && choice === 'B' && status === 'FAILURE') {
    next.startingStaminaPenalty = Math.max(next.startingStaminaPenalty, 20);
    return next;
  }

  return next;
}

export function narrativeOutcomeLogLine(
  node: NarrativeEventNode,
  choice: 'A' | 'B',
  status: CheckStatus,
): string {
  const choiceDef = choice === 'A' ? node.choiceA : node.choiceB;
  if (status === 'SUCCESS') return choiceDef.successText;
  if (status === 'FAILURE') return choiceDef.failureText;
  return '>> CHECK INCONCLUSIVE — PROCEEDING WITH CAUTION.';
}
