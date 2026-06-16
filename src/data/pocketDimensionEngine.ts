import type { IncursionNode } from '../types/game';

export function createCollapseEntryNode(stepIndex: number): IncursionNode {
  const id = `collapse-entry-${stepIndex}`;
  return {
    id,
    encounterIndex: stepIndex,
    index: stepIndex,
    encounterType: 'COMBAT',
    type: 'ELITE_COMBAT',
    label: 'COLLAPSE RIFT // POCKET DIMENSION BREACH',
    isCompleted: false,
    sectorMeta: {
      spectral: {
        radialFrequency: 'Dimensional Shear // Uncapped Resonance Band',
        visualSpectrum: 'Violet Fracture // Collapse Threshold',
        occultIndex: 'Boss Cleared // Continuation Optional',
        threatProfile: 'EXTREME // RESONANCE UNBOUND BEYOND',
        threatBand: 'CRITICAL',
      },
      resonanceDelta: 0,
      isFocused: true,
      yieldMultiplier: 1,
      creditBonus: 0,
      combatTier: 'ELITE',
    },
  };
}

export function isCollapseForwardNode(node: IncursionNode): boolean {
  return node.id.startsWith('collapse-rift-') || node.id.startsWith('collapse-entry-');
}
