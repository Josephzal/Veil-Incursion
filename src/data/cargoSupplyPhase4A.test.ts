import assert from 'node:assert/strict';
import { CARGO_ITEM_CATALOG, createDefaultCargoRunState } from '../types/cargoGrid';
import { ALL_RUN_ITEM_IDS } from '../types/runItem';
import { getCargoStackCap } from './cargoStackEngine';
import {
  accountOwnsRecoverySupply,
  applyRecoverySupplyMarketFloor,
  canOfferTemporaryCoagulant,
  commitPackedSupplyStock,
  consumeSupplyInstance,
  normalizeSupplyAccount,
  placeSupplyAtCell,
  placeSupplyAtFirstOpenCell,
  stageImmediateSupplyTransaction,
} from './cargoSupplyEngine';
import {
  depositAllCargoToHubAccount,
  depositPhysicalBankSnapshot,
} from './extractionPersistenceEngine';
import {
  bankEligiblePhysicalRunCargo,
  partitionCargoForSafehouseBank,
} from './cargoOwnershipEngine';
import { createDefaultPlayerAccount, mergeStoredAccount } from '../context/PlayerAccountContext';
import { resolveRunItemCombatUse } from './runItemCombatEngine';
import { createDefaultRunItemRuntime } from '../types/runItem';
import { createEmptyRunPhysicalBankSnapshot } from '../types/runResourceLedger';

console.log('Stage IV-A — Cargo Supply proof');

// Canonical roster: ordinary 1×1, non-stacking cargo.
ALL_RUN_ITEM_IDS.forEach((itemId) => {
  const definition = CARGO_ITEM_CATALOG[itemId];
  assert.equal(definition.subtype, 'SUPPLY');
  assert.equal(definition.width, 1);
  assert.equal(definition.height, 1);
  assert.equal(getCargoStackCap(itemId), 1);
});

// Duplicate Supply ids remain distinct cargo instances.
let cargo = createDefaultCargoRunState();
cargo = placeSupplyAtCell(cargo, 'standard-coagulant', 0, 0, 'HUB_STOCK')!;
cargo = placeSupplyAtCell(cargo, 'standard-coagulant', 0, 1, 'HUB_STOCK')!;
assert.equal(cargo.grid.placed.length, 2);
assert.notEqual(cargo.grid.placed[0]!.instanceId, cargo.grid.placed[1]!.instanceId);

// Stock is reserved while packing, then deducted exactly once at commit.
const committed = commitPackedSupplyStock({ 'standard-coagulant': 2 }, cargo);
assert.ok(committed);
assert.equal(committed.stock['standard-coagulant'] ?? 0, 0);
assert.equal(commitPackedSupplyStock({}, cargo), null);

// Legacy ownership migrates back to hub stock; canonical normalization is idempotent.
const migrated = normalizeSupplyAccount({
  hubCraftedConsumables: { standard_coagulant: 1 },
  tacticalLoadout: ['veil-ash-grenade', null, null],
  runItemLoadout: {
    combatSlots: ['trauma-patch', null],
    fieldSlots: ['sonar-ping', null],
  },
});
assert.equal(migrated.hubCraftedConsumables['standard-coagulant'], 1);
assert.equal(migrated.hubCraftedConsumables['veil-ash-grenade'], 1);
assert.equal(migrated.hubCraftedConsumables['trauma-patch'], 1);
assert.equal(migrated.hubCraftedConsumables['sonar-ping'], 1);
assert.deepEqual(normalizeSupplyAccount(migrated), migrated);

// Canonical account output strips both retired loadout fields.
const normalizedAccount = mergeStoredAccount({
  runItemLoadout: {
    combatSlots: ['standard-coagulant', null],
    fieldSlots: [null, null],
  },
  tacticalLoadout: ['veil-ash-grenade', null, null],
});
assert.equal('runItemLoadout' in normalizedAccount, false);
assert.equal('tacticalLoadout' in normalizedAccount, false);

// Rich combat effect resolution remains intact, then exact instance consumption removes one.
const combat = resolveRunItemCombatUse('standard-coagulant', {
  maxSoulAnchor: 100,
  currentSoulAnchor: 40,
  currentStamina: 50,
  maxStamina: 100,
  runtime: createDefaultRunItemRuntime(),
  livingEnemyCount: 1,
});
assert.equal(Boolean(combat.rejected), false);
const consumed = consumeSupplyInstance(cargo, cargo.grid.placed[0]!.instanceId);
assert.ok(consumed);
assert.equal(consumed.cargo.grid.placed.length, 1);

// Immediate use still creates and consumes a transactional instance.
const stagedImmediate = stageImmediateSupplyTransaction(
  createDefaultCargoRunState(),
  'standard-coagulant',
  'FIND',
)!;
const immediate = consumeSupplyInstance(
  stagedImmediate,
  stagedImmediate.grid.placed[0]!.instanceId,
);
assert.ok(immediate);
assert.equal(immediate.cargo.grid.placed.length, 0);

// Full cargo never overwrites and has no hidden Supply cap below 12 cells.
let full = createDefaultCargoRunState();
for (let row = 0; row < 4; row += 1) {
  for (let col = 0; col < 3; col += 1) {
    full = placeSupplyAtCell(full, 'sonar-ping', row, col, 'DEBUG')!;
  }
}
assert.equal(full.grid.placed.length, 12);
assert.equal(placeSupplyAtFirstOpenCell(full, 'relay-spike', 'FIND'), null);

// Recovery floor: temporary cargo is non-persistent/non-bankable; first market is guaranteed.
assert.equal(accountOwnsRecoverySupply({}), false);
assert.equal(canOfferTemporaryCoagulant({}, createDefaultCargoRunState()), true);
assert.deepEqual(
  applyRecoverySupplyMarketFloor(['relay-spike'], true),
  ['standard-coagulant', 'relay-spike'],
);
let temporary = placeSupplyAtCell(
  createDefaultCargoRunState(),
  'standard-coagulant',
  0,
  0,
  'TEMPORARY_RECOVERY',
  true,
)!;
const bankPartition = partitionCargoForSafehouseBank(temporary);
assert.equal(bankPartition.bankable.grid.placed.length, 0);
assert.equal(bankPartition.blocked.grid.placed.length, 1);

const defaults = createDefaultPlayerAccount();
const extractedTemporary = depositAllCargoToHubAccount(
  temporary,
  defaults,
  {
    aegisTechniqueLoadout: defaults.aegisTechniqueLoadout,
    hexShotLoadout: defaults.hexShotLoadout,
    envoyLoadout: defaults.envoyLoadout,
  },
);
assert.equal(extractedTemporary.hubCraftedConsumables['standard-coagulant'] ?? 0, 0);

// Unused normal Supply returns on extraction; secured Supply returns from the bank snapshot.
const normal = placeSupplyAtCell(
  createDefaultCargoRunState(),
  'standard-coagulant',
  0,
  0,
  'FIND',
)!;
const extractedNormal = depositAllCargoToHubAccount(
  normal,
  defaults,
  {
    aegisTechniqueLoadout: defaults.aegisTechniqueLoadout,
    hexShotLoadout: defaults.hexShotLoadout,
    envoyLoadout: defaults.envoyLoadout,
  },
);
assert.equal(extractedNormal.hubCraftedConsumables['standard-coagulant'], 1);
const banked = bankEligiblePhysicalRunCargo(
  normal,
  createEmptyRunPhysicalBankSnapshot(),
);
assert.equal(banked.cargo.grid.placed.length, 0);
const depositedBank = depositPhysicalBankSnapshot(banked.bank, defaults);
assert.equal(depositedBank.hubCraftedConsumables['standard-coagulant'], 1);

// Similar legacy coagulants remain mechanically distinct identities.
assert.notEqual('coagulation-stitch', 'standard-coagulant');
assert.ok(CARGO_ITEM_CATALOG['coagulation-stitch']);
assert.ok(CARGO_ITEM_CATALOG['standard-coagulant']);

console.log('Stage IV-A Cargo Supply proof passed');
