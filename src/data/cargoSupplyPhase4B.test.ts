import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDefaultActiveIncursionState } from '../types/game';
import { ALL_RUN_ITEM_IDS } from '../types/runItem';
import { createDefaultCargoRunState } from '../types/cargoGrid';
import { resolveSupplyCombatTranslation } from './cargoSupplyCombatSafetyEngine';
import { simulateCargoSupplyPolicies } from './cargoSupplySimulationEngine';
import { assertCargoSupplyCatalogValid } from './cargoSupplyValidationEngine';
import {
  consumeSupplyInstance,
  placeSupplyAtFirstOpenCell,
} from './cargoSupplyEngine';
import { buildRunBalanceTelemetry } from './runIntegration/runBalanceTelemetryEngine';
import { RUN_ITEM_REGISTRY } from './runItemRegistry';

console.log('Stage IV-B — Cargo Supply closure proof');

assert.equal(ALL_RUN_ITEM_IDS.length, 24);
assertCargoSupplyCatalogValid();

let cargo = createDefaultCargoRunState();
const placed = placeSupplyAtFirstOpenCell(cargo, 'standard-coagulant', 'FIND');
assert.ok(placed);
cargo = placed;
const instance = cargo.grid.placed[0];
assert.ok(instance);
const consumed = consumeSupplyInstance(cargo, instance.instanceId);
assert.ok(consumed);
assert.equal(consumeSupplyInstance(consumed.cargo, instance.instanceId), null);

let fullCargo = createDefaultCargoRunState();
for (let index = 0; index < 12; index += 1) {
  const next = placeSupplyAtFirstOpenCell(
    fullCargo,
    ALL_RUN_ITEM_IDS[index % ALL_RUN_ITEM_IDS.length],
    'FIND',
  );
  assert.ok(next);
  fullCargo = next;
}
assert.equal(placeSupplyAtFirstOpenCell(fullCargo, 'trauma-patch', 'MARKET'), null);

const normalInterrupt = resolveSupplyCombatTranslation('black_iron_wedge', {
  isBoss: false,
  isObjectiveCritical: false,
  revealedIntent: true,
});
const bossInterrupt = resolveSupplyCombatTranslation('black_iron_wedge', {
  isBoss: true,
  isObjectiveCritical: false,
  revealedIntent: true,
});
const objectiveInterrupt = resolveSupplyCombatTranslation('black_iron_wedge', {
  isBoss: false,
  isObjectiveCritical: true,
  revealedIntent: true,
});
assert.equal(normalInterrupt.cancelRevealedIntent, true);
assert.equal(bossInterrupt.cancelRevealedIntent, false);
assert.equal(objectiveInterrupt.cancelRevealedIntent, false);
assert.equal(bossInterrupt.maxControlTurns, 1);
assert.equal(objectiveInterrupt.allowExecution, false);
assert.equal(objectiveInterrupt.allowForcedTargeting, false);

const relay = RUN_ITEM_REGISTRY['relay-spike'];
assert.ok(relay.tags.includes('RISK'));
assert.ok(relay.riskText);
assert.equal(relay.usableContexts.includes('SCANNER'), true);

const simulations = simulateCargoSupplyPolicies('stage-iv-b:shared-seed');
assert.equal(simulations.length, 3);
simulations.forEach((result) => {
  assert.equal(result.seed, 'stage-iv-b:shared-seed');
  assert.equal(result.survived, true, `${result.policy} entered a failure spiral`);
  assert.equal(result.softlocked, false);
  assert.equal(result.duplicateInstanceIds, 0);
  assert.equal(result.reconciliationMismatch, 0);
  assert.ok(result.suppliesUsed < result.bands.reduce((sum, band) => sum + band.encounters, 0));
  assert.ok(result.bands.some((band) => band.suppliesAcquired > 0));
  assert.ok(result.bands.some((band) => band.suppliesUsed > 0));
});
(['EARLY', 'MID', 'DEEP'] as const).forEach((band) => {
  assert.ok(simulations.some(
    (result) => result.bands.some(
      (sample) => sample.band === band && sample.suppliesAcquired > 0 && sample.suppliesUsed > 0,
    ),
  ), `${band} band did not circulate a Supply`);
});
const resourceFirst = simulations.find((result) => result.policy === 'RESOURCE_FIRST')!;
const balanced = simulations.find((result) => result.policy === 'BALANCED')!;
assert.ok(resourceFirst.resourcesCarried > resourceFirst.suppliesExtracted);
assert.ok(balanced.resourcesCarried > 0);
assert.ok(balanced.suppliesExtracted + balanced.suppliesBanked > 0);
assert.ok(simulations.some((result) => result.fullCargoDecisions > 0));
assert.ok(simulations.some((result) => result.resourcesDisplacedForSupply > 0));

const incursion = createDefaultActiveIncursionState();
incursion.cargo = placed;
incursion.supplyRuntime.stats.suppliesPacked = 1;
incursion.supplyRuntime.stats.suppliesFound = 1;
incursion.supplyRuntime.stats.suppliesJettisoned = 2;
incursion.supplyRuntime.stats.resourcesDisplacedForSupply = 1;
const extractedTelemetry = buildRunBalanceTelemetry(incursion, { extractedSuccessfully: true });
assert.equal(extractedTelemetry.supplyCargoCellsOccupied, 1);
assert.equal(extractedTelemetry.suppliesExtracted, 1);
assert.equal(extractedTelemetry.suppliesLost, 0);
const deathTelemetry = buildRunBalanceTelemetry(incursion, { extractedSuccessfully: false });
assert.equal(deathTelemetry.suppliesExtracted, 0);
assert.equal(deathTelemetry.suppliesLost, 1);
assert.equal(deathTelemetry.suppliesJettisoned, 2);
assert.equal(deathTelemetry.resourcesDisplacedForSupply, 1);

[
  'src/components/RunGlobalChrome.tsx',
  'src/components/CargoGridBoard.tsx',
  'src/components/hub/LoadoutHubPanel.tsx',
  'src/components/run/RunItemSlotChoiceModal.tsx',
].forEach((relativePath) => {
  const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8');
  assert.doesNotMatch(source, /\bRUN ITEMS?\b/i, relativePath);
});
[
  'src/data/runItemInventoryEngine.ts',
  'src/components/hub/loadout/FieldKitWorkspace.tsx',
  'src/components/RunItemsOverlay.tsx',
].forEach((relativePath) => assert.equal(existsSync(resolve(process.cwd(), relativePath)), false));

console.log('Stage IV-B Cargo Supply closure proof passed.');
