import type { SectorGraph } from '../types/sector';

const ENTRY_ID = 'hub-entry';

/** Minimal graph for badge-screen exploration — terrain only, no encounter nodes. */
export const EXPLORATION_HUB_GRAPH: SectorGraph = {
  entryId: ENTRY_ID,
  sectorTier: 1,
  maxGraphDepth: 0,
  nodes: {
    [ENTRY_ID]: {
      id: ENTRY_ID,
      graphDepth: 0,
      encounterType: 'NARRATIVE_EVENT',
      type: 'NARRATIVE_EVENT',
      environmentType: 'SUBWAY_CHASM',
      childIds: [],
      parentId: null,
      label: 'METROPOLITAN HUB // SAFE CORRIDOR',
      sectorMeta: {
        spectral: {
          radialFrequency: '0.00 Hz',
          visualSpectrum: 'STABLE GRID',
          occultIndex: '0.00',
          threatProfile: 'CORRIDOR CLEAR',
          threatBand: 'LOW',
        },
        resonanceDelta: 0,
        isFocused: false,
        yieldMultiplier: 1,
        creditBonus: 0,
        combatTier: 'STANDARD',
      },
      isCompleted: true,
    },
  },
};
