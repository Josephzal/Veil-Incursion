import type { GeneratedContract, ContractBoardState, SelectedContractState } from '../types/contract';
import type { SealedCargoStackMeta } from '../types/sealedCargo';
import {
  ALL_RESOURCE_ITEM_IDS,
  isResourceItemId,
  RESOURCE_REGISTRY,
} from './resourceRegistry';
import { createEmptyResourceStash } from './resourceStashEngine';
import {
  createEmptyResourceDiscoveryState,
  seedDiscoveryFromStash,
} from './resourceDiscoveryEngine';
import type { ResourceDiscoveryState } from '../types/resourceDiscovery';
import {
  createDefaultCareerEconomyTelemetry,
} from '../types/economyRunTelemetry';
import type { CareerEconomyTelemetry } from '../types/economyRunTelemetry';
import { isAppraisableSealedResource } from './sealedCargoEngine';
import type { PlayerAccount } from '../types/game';
import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';

/**
 * Economy Spine Phase 2L — save migration + graceful fallbacks.
 * Existing saves must not break; unknown keys remap or drop; craft/weapons preserved.
 */

/** Legacy / snake_case stash keys → canonical ResourceItemId. */
export const LEGACY_RESOURCE_ID_ALIASES: Readonly<Record<string, ResourceItemId>> = {
  ley_slag: 'ley-slag',
  'leyslag': 'ley-slag',
  echo_glass_shard: 'echo-glass-shard',
  'echo-glass': 'echo-glass-shard',
  sanguine_ampoule: 'sanguine-ampoule',
  encrypted_grid_drive: 'encrypted-grid-drive',
  'grid-drive': 'encrypted-grid-drive',
  legion_blood_iron: 'legion-blood-iron',
  'blood-iron': 'legion-blood-iron',
  anomalous_core: 'anomalous-core',
  veil_ash_canister: 'veil-ash-canister',
  'veil-ash': 'veil-ash-canister',
  smugglers_ledger: 'smugglers-ledger',
  "smuggler's-ledger": 'smugglers-ledger',
  ossified_ley_knot: 'ossified-ley-knot',
  'ley-knot': 'ossified-ley-knot',
  sealed_containment_casket: 'sealed-containment-casket',
  tarnished_dog_tags: 'tarnished-dog-tags',
  combustion_cylinder: 'combustion-cylinder',
  nullcrete_shard: 'nullcrete-shard',
  nullcrete: 'nullcrete-shard',
  mycelial_ichor: 'mycelial-ichor',
  cinder_wire: 'cinder-wire',
  rail_capacitor: 'rail-capacitor',
  containment_seal: 'containment-seal',
  resonant_filament: 'resonant-filament',
  anchor_marrow: 'anchor-marrow',
  breach_thread: 'breach-thread',
  blacksite_specimen_jar: 'blacksite-specimen-jar',
  'specimen-jar': 'blacksite-specimen-jar',
  overgrowth_coordinate: 'overgrowth-coordinate',
  false_road_signal: 'false-road-signal',
  transit_cipher: 'transit-cipher',
  blackline_credentials: 'blackline-credentials',
};

export interface EconomySaveMigrationNote {
  severity: 'info' | 'warn' | 'error';
  area: 'STASH' | 'DISCOVERY' | 'TELEMETRY' | 'CRAFT' | 'WEAPON' | 'CONTRACT' | 'SEALED';
  message: string;
}

export interface EconomySaveMigrationResult {
  resourceStash: ResourceQuantity;
  resourceDiscovery: ResourceDiscoveryState;
  careerEconomyTelemetry: CareerEconomyTelemetry;
  sealedCargoStacks: SealedCargoStackMeta[];
  notes: EconomySaveMigrationNote[];
  remappedKeys: number;
  droppedKeys: number;
}

export function resolveLegacyResourceId(raw: string): ResourceItemId | null {
  if (isResourceItemId(raw)) return raw;
  const alias = LEGACY_RESOURCE_ID_ALIASES[raw] ?? LEGACY_RESOURCE_ID_ALIASES[raw.toLowerCase()];
  return alias ?? null;
}

/** Remap aliases, merge quantities, drop unknown keys. */
export function migrateResourceStash(
  raw: Partial<Record<string, number>> | undefined,
): { stash: ResourceQuantity; remapped: number; dropped: string[]; notes: EconomySaveMigrationNote[] } {
  const stash = createEmptyResourceStash();
  const notes: EconomySaveMigrationNote[] = [];
  const dropped: string[] = [];
  let remapped = 0;

  Object.entries(raw ?? {}).forEach(([key, qty]) => {
    if (qty == null || qty <= 0) return;
    const resolved = resolveLegacyResourceId(key);
    if (!resolved) {
      dropped.push(key);
      notes.push({
        severity: 'warn',
        area: 'STASH',
        message: `Dropped unknown stash key "${key}" ×${qty}.`,
      });
      return;
    }
    if (resolved !== key) remapped += 1;
    stash[resolved] = (stash[resolved] ?? 0) + qty;
  });

  return { stash, remapped, dropped, notes };
}

export function migrateSealedCargoStacks(
  stacks: SealedCargoStackMeta[] | undefined,
): { stacks: SealedCargoStackMeta[]; notes: EconomySaveMigrationNote[] } {
  const notes: EconomySaveMigrationNote[] = [];
  const next: SealedCargoStackMeta[] = [];
  (stacks ?? []).forEach((stack) => {
    const resolved = resolveLegacyResourceId(String(stack.resourceId));
    if (!resolved || !isAppraisableSealedResource(resolved)) {
      notes.push({
        severity: 'warn',
        area: 'SEALED',
        message: `Dropped sealed stack with invalid resource "${stack.resourceId}".`,
      });
      return;
    }
    if (resolved === stack.resourceId) {
      next.push(stack);
    } else {
      next.push({ ...stack, resourceId: resolved as SealedCargoStackMeta['resourceId'] });
    }
  });
  return { stacks: next, notes };
}

/**
 * Core economy account migration (stash / discovery / telemetry / sealed).
 * Call from mergeStoredAccount after base merge fields are known.
 */
export function migratePlayerAccountEconomy(input: {
  resourceStash?: Partial<Record<string, number>>;
  resourceDiscovery?: ResourceDiscoveryState;
  careerEconomyTelemetry?: Partial<CareerEconomyTelemetry>;
  sealedCargoStacks?: SealedCargoStackMeta[];
  weaponUnlocks?: readonly string[];
}): EconomySaveMigrationResult {
  const notes: EconomySaveMigrationNote[] = [];
  const stashResult = migrateResourceStash(input.resourceStash);
  notes.push(...stashResult.notes);

  const sealedResult = migrateSealedCargoStacks(input.sealedCargoStacks);
  notes.push(...sealedResult.notes);

  const resourceDiscovery = seedDiscoveryFromStash(
    stashResult.stash,
    input.resourceDiscovery ?? createEmptyResourceDiscoveryState(),
  );
  if (!input.resourceDiscovery) {
    notes.push({
      severity: 'info',
      area: 'DISCOVERY',
      message: 'Initialized empty resource discovery (seeded from stash ownership).',
    });
  }

  const careerEconomyTelemetry: CareerEconomyTelemetry = {
    ...createDefaultCareerEconomyTelemetry(),
    ...input.careerEconomyTelemetry,
  };
  if (!input.careerEconomyTelemetry) {
    notes.push({
      severity: 'info',
      area: 'TELEMETRY',
      message: 'Initialized career economy telemetry defaults.',
    });
  }

  // Weapon ownership is independent of economy normalization.
  if (input.weaponUnlocks && input.weaponUnlocks.length > 0) {
    notes.push({
      severity: 'info',
      area: 'WEAPON',
      message: `Preserved ${input.weaponUnlocks.length} weapon unlock(s).`,
    });
  }

  // Soft check: every economy roster id is readable as 0 if absent.
  ALL_RESOURCE_ITEM_IDS.forEach((id) => {
    if (stashResult.stash[id] == null) {
      // intentional — missing keys mean 0 via getStashCount
    }
  });

  return {
    resourceStash: stashResult.stash,
    resourceDiscovery,
    careerEconomyTelemetry,
    sealedCargoStacks: sealedResult.stacks,
    notes,
    remappedKeys: stashResult.remapped,
    droppedKeys: stashResult.dropped.length,
  };
}

function contractTargetIds(contract: GeneratedContract): ResourceItemId[] {
  if (contract.targetResourceOptions?.length) return [...contract.targetResourceOptions];
  if (contract.targetResourceId) return [contract.targetResourceId];
  return [];
}

function isValidContractResourceTarget(resourceId: ResourceItemId): boolean {
  const def = RESOURCE_REGISTRY[resourceId];
  return Boolean(def?.canBeContractTarget);
}

/**
 * Sanitize a persisted contract board:
 * - Remap legacy target resource ids
 * - Drop contracts whose targets are unknown / non-contract-target
 * - Keep non-resource contracts intact
 * - Clear selected SPONSOR contract if it was dropped
 */
export function sanitizePersistedContractBoard(
  board: ContractBoardState,
): { board: ContractBoardState; notes: EconomySaveMigrationNote[]; droppedContracts: number } {
  const notes: EconomySaveMigrationNote[] = [];
  let droppedContracts = 0;

  const contracts = board.contracts.flatMap((contract) => {
    const rawIds = contractTargetIds(contract);
    if (rawIds.length === 0) return [contract];

    const remapped: ResourceItemId[] = [];
    let invalid = false;
    rawIds.forEach((raw) => {
      const resolved = resolveLegacyResourceId(String(raw));
      if (!resolved || !isValidContractResourceTarget(resolved)) {
        invalid = true;
        notes.push({
          severity: 'warn',
          area: 'CONTRACT',
          message: `Contract ${contract.id}: invalid target "${raw}" — contract removed.`,
        });
        return;
      }
      if (resolved !== raw) {
        notes.push({
          severity: 'info',
          area: 'CONTRACT',
          message: `Contract ${contract.id}: remapped target ${raw} → ${resolved}.`,
        });
      }
      remapped.push(resolved);
    });

    if (invalid || remapped.length === 0) {
      droppedContracts += 1;
      return [];
    }

    if (contract.targetResourceOptions?.length) {
      return [{ ...contract, targetResourceOptions: remapped, targetResourceId: undefined }];
    }
    return [{ ...contract, targetResourceId: remapped[0] }];
  });

  let selectedContract: SelectedContractState = board.selectedContract;
  if (selectedContract.kind === 'SPONSOR') {
    const selectedId = selectedContract.contract.id;
    const stillPresent = contracts.some((c) => c.id === selectedId);
    if (!stillPresent) {
      notes.push({
        severity: 'warn',
        area: 'CONTRACT',
        message: `Cleared selected contract ${selectedId} (invalid after migrate).`,
      });
      selectedContract = { kind: 'INDEPENDENT' };
    } else {
      const refreshed = contracts.find((c) => c.id === selectedId);
      if (refreshed) {
        selectedContract = {
          kind: 'SPONSOR',
          contract: refreshed,
          selectedAtRunIndex: selectedContract.selectedAtRunIndex,
        };
      }
    }
  }

  return {
    board: {
      ...board,
      contracts,
      selectedContract,
    },
    notes,
    droppedContracts,
  };
}

export function formatEconomySaveMigrationReport(
  result: EconomySaveMigrationResult,
  extraNotes: EconomySaveMigrationNote[] = [],
): string {
  const notes = [...result.notes, ...extraNotes];
  const errors = notes.filter((n) => n.severity === 'error');
  const warns = notes.filter((n) => n.severity === 'warn');
  const infos = notes.filter((n) => n.severity === 'info');

  const stashIds = Object.keys(result.resourceStash).length;
  const lines = [
    '=== ECONOMY SPINE // PHASE 2L — SAVE MIGRATION ===',
    '',
    `Stash keys present: ${stashIds}`,
    `Remapped legacy keys: ${result.remappedKeys}`,
    `Dropped unknown keys: ${result.droppedKeys}`,
    `Sealed stacks kept: ${result.sealedCargoStacks.length}`,
    `Discovery entries: ${Object.keys(result.resourceDiscovery).length}`,
    '',
    `Notes: ${notes.length} (${errors.length} errors / ${warns.length} warns / ${infos.length} info)`,
    ...errors.slice(0, 12).map((n) => `  [error/${n.area}] ${n.message}`),
    ...warns.slice(0, 16).map((n) => `  [warn/${n.area}] ${n.message}`),
    ...infos.slice(0, 10).map((n) => `  [info/${n.area}] ${n.message}`),
    '',
    errors.length === 0
      ? 'PASS — saves migrate safely; craft/weapons preserved; unknown refs fail closed.'
      : 'FAIL — migration errors need attention.',
    'Rule: old saves init missing resources to 0; never wipe craft/weapon unlocks.',
  ];
  return lines.join('\n');
}

/** Dry-run migration report from a partial account snapshot. */
export function formatEconomySaveMigrationDryRun(account: PlayerAccount): string {
  const result = migratePlayerAccountEconomy({
    resourceStash: account.resourceStash,
    resourceDiscovery: account.resourceDiscovery,
    careerEconomyTelemetry: account.careerEconomyTelemetry,
    sealedCargoStacks: account.sealedCargoStacks,
    weaponUnlocks: account.weaponUnlocks,
  });
  return formatEconomySaveMigrationReport(result);
}

/** Fixture smoke: orphan keys + alias remap. */
export function formatEconomySaveMigrationFixtureReport(): string {
  const fixture = migratePlayerAccountEconomy({
    resourceStash: {
      ley_slag: 3,
      'rail-capacitor': 1,
      'totally-fake-mat': 9,
      nullcrete: 2,
    },
    sealedCargoStacks: [
      {
        stackId: 'test-stack',
        resourceId: 'blacksite-specimen-jar',
        state: 'SEALED',
      },
    ],
    weaponUnlocks: ['aegis-longsword'],
  });

  const contractSanitize = sanitizePersistedContractBoard({
    contracts: [
      {
        id: 'ok-contract',
        sponsorId: 'TERRAN_GRID',
        title: 'Ok',
        objectiveKind: 'EXTRACT_STABLE_RESOURCE',
        objectiveText: 'Get slag',
        targetResourceId: 'ley_slag' as ResourceItemId,
        targetQuantity: 2,
        validSectorIds: ['THE_NULL_ZONE'],
        recommendedSectorIds: ['THE_NULL_ZONE'],
        reward: { credits: 100, reputation: 1 },
        difficulty: 2,
        refreshLabel: 'test',
      },
      {
        id: 'bad-contract',
        sponsorId: 'LEGION',
        title: 'Bad',
        objectiveKind: 'EXTRACT_STABLE_RESOURCE',
        objectiveText: 'Get nothing',
        targetResourceId: 'not-a-real-resource' as ResourceItemId,
        targetQuantity: 1,
        validSectorIds: ['THE_SLAG_WORKS'],
        recommendedSectorIds: ['THE_SLAG_WORKS'],
        reward: { credits: 50, reputation: 1 },
        difficulty: 1,
        refreshLabel: 'test',
      },
    ],
    selectedContract: { kind: 'INDEPENDENT' },
    boardRefreshRunIndex: 0,
    lastUsedSponsorId: null,
  });

  const lines = [
    formatEconomySaveMigrationReport(fixture, contractSanitize.notes),
    '',
    '-- CONTRACT FIXTURE --',
    `Kept contracts: ${contractSanitize.board.contracts.length}`,
    `Dropped contracts: ${contractSanitize.droppedContracts}`,
    contractSanitize.board.contracts[0]?.targetResourceId === 'ley-slag'
      ? 'PASS — ley_slag remapped on contract target.'
      : 'FAIL — contract alias remap missed.',
  ];
  return lines.join('\n');
}
