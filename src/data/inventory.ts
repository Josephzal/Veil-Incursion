import { InventoryItem, PlayerInventoryState, WeaponModifiers } from '../types/game';
import { COMBAT_ACTION } from '../types/run';

export const ITEM_CATALOG: Record<string, Omit<InventoryItem, 'isEquipped'>> = {
  'dull-training-katana': {
    id: 'dull-training-katana',
    name: 'Dull Training Katana',
    description: 'Agency-issue practice blade. Reliable but unremarkable kinetic throughput.',
    rarity: 'STANDARD',
    type: 'WEAPON',
    modifiers: {},
  },
  'mono-molecular-cleaver': {
    id: 'mono-molecular-cleaver',
    name: 'Mono-Molecular Cleaver',
    description: 'Surgical-grade edge lattice. Devastating mass transfer at elevated stamina draw.',
    rarity: 'COBALT',
    type: 'WEAPON',
    modifiers: {
      baseDamageOverride: 16,
      staminaCostModifier: 10,
    },
  },
  'ghost-wire-nodachi': {
    id: 'ghost-wire-nodachi',
    name: 'Ghost-Wire Nodachi',
    description: 'Phase-threaded steel filament. Lightweight strikes bleed abyssal charge rapidly into the reservoir.',
    rarity: 'STABILIZED',
    type: 'WEAPON',
    modifiers: {
      staminaCostModifier: -5,
      abyssalGainModifier: 0.5,
    },
  },
};

const CACHE_WEAPON_DROPS = ['mono-molecular-cleaver', 'ghost-wire-nodachi'] as const;

export function createDefaultInventory(): PlayerInventoryState {
  return {
    items: [
      { ...ITEM_CATALOG['dull-training-katana'], isEquipped: true },
    ],
    materials: {
      riftIron: 0,
      voidFilament: 0,
    },
    unopenedCaches: {
      tier1Caches: 2,
      tier2Caches: 0,
    },
  };
}

export function mergeInventory(
  stored: Partial<PlayerInventoryState> | undefined,
): PlayerInventoryState {
  const defaults = createDefaultInventory();
  if (!stored) return defaults;

  const itemMap = new Map<string, InventoryItem>();
  for (const item of defaults.items) itemMap.set(item.id, item);
  for (const item of stored.items ?? []) itemMap.set(item.id, item);

  return {
    items: Array.from(itemMap.values()),
    materials: {
      riftIron: stored.materials?.riftIron ?? defaults.materials.riftIron,
      voidFilament: stored.materials?.voidFilament ?? defaults.materials.voidFilament,
    },
    unopenedCaches: {
      tier1Caches: stored.unopenedCaches?.tier1Caches ?? defaults.unopenedCaches.tier1Caches,
      tier2Caches: stored.unopenedCaches?.tier2Caches ?? defaults.unopenedCaches.tier2Caches,
    },
  };
}

export function getEquippedWeapon(items: InventoryItem[]): InventoryItem | null {
  return items.find((i) => i.type === 'WEAPON' && i.isEquipped) ?? null;
}

export interface ResolvedWeaponCombatStats {
  strikeDamage: number;
  strikeStaminaCost: number;
  exhaustedStrikeDamage: number;
  abyssalChargePerStrike: number;
  label: string;
  /**
   * Aegis-only: technique strike power for VEIL_PIERCER / REAVE.
   * Undefined for Hex Shot / Envoy. Not used by canonical Aegis weapon actions.
   */
  aegisTechniqueStrikePower?: number;
  /**
   * Aegis-only: ultimate strike power for REND_THE_VEIL / GRAVEFALL.
   * Undefined for Hex Shot / Envoy. Not used by canonical Aegis weapon actions or techniques.
   */
  aegisUltimateStrikePower?: number;
}

export function resolveWeaponCombatStats(
  modifiers: Partial<WeaponModifiers> = {},
  weaponName = 'Standard Blade',
): ResolvedWeaponCombatStats {
  const strikeDamage = modifiers.baseDamageOverride ?? COMBAT_ACTION.ABYSSAL_STRIKE_DAMAGE;
  const strikeStaminaCost =
    COMBAT_ACTION.ABYSSAL_STRIKE_STAMINA + (modifiers.staminaCostModifier ?? 0);
  const abyssalChargePerStrike = Math.round(
    COMBAT_ACTION.ABYSSAL_RESERVE_CHARGE * (1 + (modifiers.abyssalGainModifier ?? 0)),
  );

  return {
    strikeDamage,
    strikeStaminaCost,
    exhaustedStrikeDamage: COMBAT_ACTION.ABYSSAL_STRIKE_EXHAUSTED_DAMAGE,
    abyssalChargePerStrike,
    label: weaponName,
  };
}

export function formatItemStatLines(item: InventoryItem): string[] {
  const lines: string[] = [];
  const m = item.modifiers;
  if (m.baseDamageOverride != null) {
    lines.push(`+${m.baseDamageOverride - COMBAT_ACTION.ABYSSAL_STRIKE_DAMAGE} Strike Damage`);
  }
  if (m.staminaCostModifier != null && m.staminaCostModifier !== 0) {
    const sign = m.staminaCostModifier > 0 ? '+' : '';
    lines.push(`${sign}${m.staminaCostModifier} Stamina Cost per execution`);
  }
  if (m.abyssalGainModifier != null && m.abyssalGainModifier !== 0) {
    lines.push(`+${Math.round(m.abyssalGainModifier * 100)}% Abyssal Reserve charge rate`);
  }
  if (m.parryWindowModifier != null && m.parryWindowModifier !== 0) {
    lines.push(`${m.parryWindowModifier > 0 ? '+' : ''}${Math.round(m.parryWindowModifier * 100)}% Parry Window`);
  }
  if (lines.length === 0) lines.push('Standard agency baseline — no modifier overrides');
  return lines;
}

export interface CacheDecryptResult {
  credits: number;
  riftIron: number;
  newWeapon: InventoryItem | null;
  logLines: string[];
}

export function rollTier1CacheDecrypt(ownedItemIds: Set<string>): CacheDecryptResult {
  const credits = 100 + Math.floor(Math.random() * 201);
  const riftIron = 2 + Math.floor(Math.random() * 4);
  const logLines = [
    `>> +${credits} Cabal Credits secured.`,
    `>> +${riftIron} units Rift Iron alloy extracted.`,
  ];

  let newWeapon: InventoryItem | null = null;
  if (Math.random() < 0.2) {
    const candidates = CACHE_WEAPON_DROPS.filter((id) => !ownedItemIds.has(id));
    if (candidates.length > 0) {
      const dropId = candidates[Math.floor(Math.random() * candidates.length)];
      newWeapon = { ...ITEM_CATALOG[dropId], isEquipped: false };
      logLines.push(`>> WEAPON BLUEPRINT MANIFESTED: ${newWeapon.name} [${newWeapon.rarity}].`);
    } else {
      logLines.push('>> Duplicate weapon resonance detected — alloy reforged into +50 Cabal Credits.');
      return { credits: credits + 50, riftIron, newWeapon: null, logLines };
    }
  } else {
    logLines.push('>> No weapon blueprint in this cache fragment.');
  }

  return { credits, riftIron, newWeapon, logLines };
}

export const DECRYPT_PHASES = [
  'DECRYPTING CORE...',
  'SECURING TELEMETRY...',
  'EXTRACTING RESIDUE...',
] as const;
