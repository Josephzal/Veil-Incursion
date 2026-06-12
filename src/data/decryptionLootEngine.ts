import type { BlueprintId } from '../types/equipmentBlueprint';
import { BLUEPRINT_DEFINITIONS, CLASS_WEAPON_BLUEPRINTS } from '../types/equipmentBlueprint';
import type { ResourceBundle } from '../types/resourceItem';
import type { UnidentifiedTemplateId } from '../types/unidentifiedItem';

export type DecryptionOutcome =
  | { kind: 'RESOURCES'; bundle: ResourceBundle; logLine: string }
  | { kind: 'GEAR'; blueprintId: BlueprintId; logLine: string }
  | { kind: 'MASTERWORK'; blueprintId: BlueprintId; logLine: string }
  | { kind: 'CREDITS'; amount: number; logLine: string };

const COMMON_RESOURCE_BUNDLE: ResourceBundle = {
  items: [
    { id: 'ley-slag', quantity: 15 },
    { id: 'sanguine-ampoule', quantity: 5 },
  ],
};

const RARE_GEAR_BLUEPRINT: BlueprintId = 'aegis_claymore';

function createSeededRng(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return () => {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    return hash / 0xffffffff;
  };
}

function pickUnownedClassWeapon(ownedBlueprintIds: readonly string[]): BlueprintId | null {
  const candidates = CLASS_WEAPON_BLUEPRINTS.filter((id) => !ownedBlueprintIds.includes(id));
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function rollDecryptionLoot(
  templateId: UnidentifiedTemplateId,
  ownedBlueprintIds: readonly string[],
  seed?: string,
): DecryptionOutcome {
  const rng = createSeededRng(seed ?? `decrypt:${templateId}:${Date.now()}`);
  const roll = Math.floor(rng() * 100) + 1;

  if (roll <= 60) {
    return {
      kind: 'RESOURCES',
      bundle: COMMON_RESOURCE_BUNDLE,
      logLine: '>> DECRYPTION COMPLETE — Common salvage bundle extracted.',
    };
  }

  if (roll <= 90) {
    const blueprintId = ownedBlueprintIds.includes(RARE_GEAR_BLUEPRINT)
      ? 'riftshot_pulse_rifle'
      : RARE_GEAR_BLUEPRINT;
    return {
      kind: 'GEAR',
      blueprintId,
      logLine: `>> DECRYPTION COMPLETE — Rare gear: ${BLUEPRINT_DEFINITIONS[blueprintId].name}.`,
    };
  }

  const masterwork = pickUnownedClassWeapon(ownedBlueprintIds);
  if (!masterwork) {
    return {
      kind: 'CREDITS',
      amount: 5000,
      logLine: '>> DECRYPTION JACKPOT — All class weapons owned. Massive credit payout.',
    };
  }
  return {
    kind: 'MASTERWORK',
    blueprintId: masterwork,
    logLine: `>> DECRYPTION JACKPOT — Masterwork unlocked: ${BLUEPRINT_DEFINITIONS[masterwork].name}.`,
  };
}
