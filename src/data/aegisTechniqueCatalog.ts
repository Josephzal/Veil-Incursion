/**
 * Shared Aegis technique metadata (hub / validation).
 * Phase C: all twelve techniques have native combat resolvers under canonical IDs.
 */
import {
  AEGIS_AP_UTILITY_TECHNIQUES,
  AEGIS_BRAND_TECHNIQUES,
  ALL_AEGIS_TECHNIQUES,
  type AegisTechniqueCategory,
  type AegisTechniqueId,
} from '../types/aegisCombat';

export interface AegisTechniqueDefinition {
  id: AegisTechniqueId;
  label: string;
  description: string;
  category: AegisTechniqueCategory;
  /** Always true in Phase C — native resolvers exist for every technique. */
  combatResolverReady: boolean;
}

const BRAND = new Set<AegisTechniqueId>(AEGIS_BRAND_TECHNIQUES);
const UTILITY = new Set<AegisTechniqueId>(AEGIS_AP_UTILITY_TECHNIQUES);

export const AEGIS_TECHNIQUE_CATALOG: Record<AegisTechniqueId, AegisTechniqueDefinition> = {
  RUIN: {
    id: 'RUIN',
    label: '[ RUIN ]',
    description: 'Spend all Brands (min 1) — full-grid Fracture AoE and Kinetic shockwave.',
    category: 'BRAND',
    combatResolverReady: true,
  },
  VEIL_PIERCER: {
    id: 'VEIL_PIERCER',
    label: '[ VEIL-PIERCER ]',
    description: 'Spend 1 Brand — Occult pierce. On hit: +20% Reserve.',
    category: 'BRAND',
    combatResolverReady: true,
  },
  DEVASTATE: {
    id: 'DEVASTATE',
    label: '[ DEVASTATE ]',
    description: 'Spend 3 Brands — cash out a Fractured target: 4 Kinetic + True equal to its Fracture threshold (min 8).',
    category: 'BRAND',
    combatResolverReady: true,
  },
  FINAL_MERCY: {
    id: 'FINAL_MERCY',
    label: '[ FINAL MERCY ]',
    description: 'Spend 2 Brands — execute a foe at ≤25% HP (bosses: 36 True). Kill heals 10% max HP.',
    category: 'BRAND',
    combatResolverReady: true,
  },
  GRAVE_BIND: {
    id: 'GRAVE_BIND',
    label: '[ GRAVE BIND ]',
    description: 'Pull a backline foe to the front and apply Exposed.',
    category: 'AP_UTILITY',
    combatResolverReady: true,
  },
  NAIL_TO_GRID: {
    id: 'NAIL_TO_GRID',
    label: '[ NAIL TO GRID ]',
    description: 'Drain enemy AP and spread Doomed to adjacent hostiles.',
    category: 'AP_UTILITY',
    combatResolverReady: true,
  },
  SHADOW_STEP: {
    id: 'SHADOW_STEP',
    label: '[ SHADOW STEP ]',
    description: '1 AP mobility strike — Fracture pressure, evade buff, seize initiative.',
    category: 'AP_UTILITY',
    combatResolverReady: true,
  },
  REAVE: {
    id: 'REAVE',
    label: '[ REAVE ]',
    description: '2 AP column sweep — Kinetic damage, armor shatter or Bleed, Fracture.',
    category: 'AP_UTILITY',
    combatResolverReady: true,
  },
  ASHEN_MANTLE: {
    id: 'ASHEN_MANTLE',
    label: '[ ASHEN MANTLE ]',
    description: '50% damage reduction through the next enemy phase; attackers become Doomed.',
    category: 'AP_UTILITY',
    combatResolverReady: true,
  },
  RUNEBOUND_CARAPACE: {
    id: 'RUNEBOUND_CARAPACE',
    label: '[ RUNEBOUND CARAPACE ]',
    description: 'Arm a carapace — after the first blockable melee hit, reflect 12 True and 24 Fracture once.',
    category: 'AP_UTILITY',
    combatResolverReady: true,
  },
  DEMONS_LUNG: {
    id: 'DEMONS_LUNG',
    label: "[ DEMON'S LUNG ]",
    description: 'Spend 1 Brand — +30% Reserve, Overcharged, +1 AP next turn (3-turn cooldown).',
    category: 'BRAND',
    combatResolverReady: true,
  },
  CRIMSON_PACT: {
    id: 'CRIMSON_PACT',
    label: '[ CRIMSON PACT ]',
    description: 'Spend 1 Brand and 12% HP — two guaranteed-critical charges for authored attacks.',
    category: 'BRAND',
    combatResolverReady: true,
  },
};

export function isAegisTechniqueId(id: unknown): id is AegisTechniqueId {
  return typeof id === 'string'
    && (ALL_AEGIS_TECHNIQUES as readonly string[]).includes(id);
}

export function getAegisTechniqueCategory(id: AegisTechniqueId): AegisTechniqueCategory {
  if (BRAND.has(id)) return 'BRAND';
  if (UTILITY.has(id)) return 'AP_UTILITY';
  return 'AP_UTILITY';
}

export function isAegisBrandTechnique(id: AegisTechniqueId): boolean {
  return BRAND.has(id);
}

export function getAegisTechniqueDefinition(id: AegisTechniqueId): AegisTechniqueDefinition {
  return AEGIS_TECHNIQUE_CATALOG[id];
}

export function listAegisTechniques(): readonly AegisTechniqueId[] {
  return ALL_AEGIS_TECHNIQUES;
}
