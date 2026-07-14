import type { VeilBiome } from '../types/encounterSpawn';

export interface SectorDepthVisualTheme {
  /** Short scanner / UI theme label. */
  label: string;
  /** One-line flavor for encounter intro, debrief, and debug. */
  flavor: string;
}

/** Biome × depth visual/flavor metadata (art-optional; presentation only). */
export const SECTOR_DEPTH_VISUAL_THEMES: Record<
  VeilBiome,
  Record<1 | 2 | 3, SectorDepthVisualTheme>
> = {
  NULL_ZONE: {
    1: {
      label: 'Ruined Grid',
      flavor: 'Recognizable ruined city streets.',
    },
    2: {
      label: 'Bent Architecture',
      flavor: 'Buildings bend inward, windows glow, streets repeat.',
    },
    3: {
      label: 'Impossible Layers',
      flavor: 'City geometry floats in impossible layers; street signs speak; horizon gone.',
    },
  },
  ABYSSAL_SINK: {
    1: {
      label: 'Submerged Approaches',
      flavor: 'Flooded approaches and moss-choked tunnels still map to known routes.',
    },
    2: {
      label: 'Breathing Depths',
      flavor: 'Water levels pulse like breath; submerged streets remember wrong names.',
    },
    3: {
      label: 'Null Ocean',
      flavor: 'There is no surface — only pressure, memory, and a hungry dark.',
    },
  },
  ASHEN_WASTE: {
    1: {
      label: 'Burned Backroads',
      flavor: 'Rural backroads, burned fields, and roadside threats.',
    },
    2: {
      label: 'Looping Roads',
      flavor: 'Roads loop; power lines hang like nooses; false extraction routes appear.',
    },
    3: {
      label: 'Predatory Road',
      flavor: 'The road is a predator; extraction routes fracture under ash-stained sky.',
    },
  },
  SLAG_WORKS: {
    1: {
      label: 'Transit Industry',
      flavor: 'Transit yards, rail arteries, and machinery that still understands work.',
    },
    2: {
      label: 'Living Machinery',
      flavor: 'Rails twist upward; tunnels breathe; slag forms humanoid shapes.',
    },
    3: {
      label: 'Ritual Works',
      flavor: 'Machinery becomes ritual; industrial hazards fuse with Anchor Core pressure.',
    },
  },
  BLACKLINE_TERMINUS: {
    1: {
      label: 'Containment Perimeter',
      flavor: 'Military compounds and labs with containment failures at the edges.',
    },
    2: {
      label: 'Repeating Lockdown',
      flavor: 'Containment rooms repeat; warning lights pulse like heartbeat; dead systems reactivate.',
    },
    3: {
      label: 'Null Compound',
      flavor: 'Security theater collapses into Veil geometry; locks open into other locks.',
    },
  },
};

export function getSectorDepthVisualTheme(
  biome: VeilBiome,
  depth: 1 | 2 | 3,
): SectorDepthVisualTheme {
  return SECTOR_DEPTH_VISUAL_THEMES[biome][depth];
}

export function formatSectorDepthFlavorLine(
  biome: VeilBiome,
  depth: 1 | 2 | 3,
): string {
  const theme = getSectorDepthVisualTheme(biome, depth);
  return `D${depth} ${theme.label} — ${theme.flavor}`;
}

export function allSectorDepthThemeEntries(): Array<{
  biome: VeilBiome;
  depth: 1 | 2 | 3;
  theme: SectorDepthVisualTheme;
}> {
  const biomes = Object.keys(SECTOR_DEPTH_VISUAL_THEMES) as VeilBiome[];
  return biomes.flatMap((biome) =>
    ([1, 2, 3] as const).map((depth) => ({
      biome,
      depth,
      theme: SECTOR_DEPTH_VISUAL_THEMES[biome][depth],
    })),
  );
}
