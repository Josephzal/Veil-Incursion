import assert from 'node:assert/strict';
import type {
  RequisitionEncounterDescriptor,
  RequisitionRuntime,
} from '../types/expeditionRequisition';
import {
  applyRequisitionOnNewRun,
  beginRequisitionCombatEncounter,
  completeRequisitionCombatEncounter,
  consumeKineticBatteryAction,
  grantAdrenalinePrimerFirstTurnAp,
  initializeRequisitionRuntime,
  interceptChalkLineHostileEffect,
  reduceReinforcedTrenchCoatDamage,
  resolveHollowPointCritChanceBonus,
} from './expeditionRequisitionRuntimeEngine';

console.log('Stage III-B — finite Combat Preparation runtime');

const encounter = (
  encounterId: string,
  kind: RequisitionEncounterDescriptor['kind'],
): RequisitionEncounterDescriptor => ({ encounterId, kind });
const runtime = (id: RequisitionRuntime['requisitionId']): RequisitionRuntime => {
  const initialized = initializeRequisitionRuntime(id, null);
  assert.ok(initialized);
  return initialized;
};

// Hazard Pay only grants on explicit new-run application, once.
let hazard = applyRequisitionOnNewRun(runtime('hazard_pay'), 10);
assert.equal(hazard.runCredits, 60);
assert.equal(hazard.creditsGranted, 50);
assert.equal(hazard.runtime?.stats.startingCreditsGranted, 50);
hazard = applyRequisitionOnNewRun(hazard.runtime, hazard.runCredits);
assert.equal(hazard.runCredits, 60);
assert.equal(hazard.creditsGranted, 0);

// Expedition-facing entries initialize no combat preparation state.
assert.equal(runtime('signal_compass').combatPreparation, null);

// Primer: first turn only is represented by one call per encounter; stable IDs block replay.
let primer: RequisitionRuntime | null = runtime('adrenaline_primer');
for (let index = 1; index <= 3; index += 1) {
  const combat = encounter(`standard-${index}`, index === 2 ? 'ELITE' : 'STANDARD');
  const first = grantAdrenalinePrimerFirstTurnAp(primer, combat);
  assert.equal(first.bonusAp, 1);
  primer = first.runtime;
  const replay = grantAdrenalinePrimerFirstTurnAp(primer, combat);
  assert.equal(replay.bonusAp, 0);
  primer = replay.runtime;
}
assert.equal(
  grantAdrenalinePrimerFirstTurnAp(primer, encounter('standard-4', 'STANDARD')).bonusAp,
  0,
);
for (const kind of [
  'BOSS',
  'DIRTY_EXTRACTION',
  'TUTORIAL',
  'SCRIPTED',
  'SIMULATION',
  'DEVELOPER',
] as const) {
  assert.equal(
    grantAdrenalinePrimerFirstTurnAp(runtime('adrenaline_primer'), encounter(kind, kind))
      .bonusAp,
    0,
  );
}
assert.equal(primer?.stats.temporaryApGranted, 3);

// Trench-Coat: first eligible Elite only, floor rounding, direct hostile attacks only.
let coat = beginRequisitionCombatEncounter(
  runtime('reinforced_trench_coat'),
  encounter('standard-before-elite', 'STANDARD'),
  1,
);
assert.equal(
  reduceReinforcedTrenchCoatDamage(
    coat,
    encounter('standard-before-elite', 'STANDARD'),
    9,
    true,
  ).damage,
  9,
);
coat = beginRequisitionCombatEncounter(
  coat,
  encounter('elite-1', 'ELITE'),
  1,
);
let protectedHit = reduceReinforcedTrenchCoatDamage(
  coat,
  encounter('elite-1', 'ELITE'),
  9,
  true,
);
assert.equal(protectedHit.damage, 4);
assert.equal(protectedHit.prevented, 5);
coat = protectedHit.runtime;
assert.equal(
  reduceReinforcedTrenchCoatDamage(
    coat,
    encounter('elite-1', 'ELITE'),
    9,
    true,
  ).damage,
  9,
);
const excludedPacket = reduceReinforcedTrenchCoatDamage(
  coat,
  encounter('elite-1', 'ELITE'),
  9,
  false,
);
assert.equal(excludedPacket.damage, 9);
coat = completeRequisitionCombatEncounter(coat, encounter('elite-1', 'ELITE'));
coat = beginRequisitionCombatEncounter(coat, encounter('elite-2', 'ELITE'), 1);
assert.equal(
  reduceReinforcedTrenchCoatDamage(
    coat,
    encounter('elite-2', 'ELITE'),
    20,
    true,
  ).damage,
  20,
);

// Hollow-Point: additive 0.10 only at Depth 1 and never reactivates after expiry.
let hollow: RequisitionRuntime | null = runtime('hollow_point_requisition');
assert.equal(resolveHollowPointCritChanceBonus(hollow, 1, true), 0.1);
assert.equal(resolveHollowPointCritChanceBonus(hollow, 1, false), 0);
hollow = beginRequisitionCombatEncounter(hollow, encounter('depth-2', 'STANDARD'), 2);
assert.equal(resolveHollowPointCritChanceBonus(hollow, 2, true), 0);
assert.equal(resolveHollowPointCritChanceBonus(hollow, 1, true), 0);

// Battery: consume only the first eligible action against a currently protected target.
let battery: RequisitionRuntime | null = runtime('kinetic_battery');
const excludedBattery = consumeKineticBatteryAction(
  battery,
  encounter('boss-layered', 'BOSS'),
  'boss-action',
  { kineticArmor: 1, occultWards: 1 },
  true,
);
assert.equal(excludedBattery.armorPierceLayers, 0);
assert.equal(excludedBattery.wardPierceLayers, 0);
assert.equal(
  consumeKineticBatteryAction(
    battery,
    encounter('layered-ineligible', 'STANDARD'),
    'ineligible-action',
    { kineticArmor: 1, occultWards: 1 },
    false,
  ).armorPierceLayers,
  0,
);
const noLayer = consumeKineticBatteryAction(
  battery,
  encounter('layered-1', 'STANDARD'),
  'action-1',
  { kineticArmor: 0, occultWards: 0 },
  true,
);
assert.equal(noLayer.armorPierceLayers, 0);
battery = noLayer.runtime;
for (let index = 1; index <= 3; index += 1) {
  const result = consumeKineticBatteryAction(
    battery,
    encounter(`layered-${index}`, 'STANDARD'),
    `action-${index}`,
    { kineticArmor: 1, occultWards: index === 2 ? 0 : 1 },
    true,
  );
  assert.equal(result.armorPierceLayers, 1);
  assert.equal(result.wardPierceLayers, index === 2 ? 0 : 1);
  battery = result.runtime;
  const sameEncounter = consumeKineticBatteryAction(
    battery,
    encounter(`layered-${index}`, 'STANDARD'),
    `action-${index}-later`,
    { kineticArmor: 1, occultWards: 1 },
    true,
  );
  assert.equal(sameEncounter.armorPierceLayers, 0);
  battery = sameEncounter.runtime;
}
assert.equal(
  consumeKineticBatteryAction(
    battery,
    encounter('layered-4', 'ELITE'),
    'action-4',
    { kineticArmor: 1, occultWards: 1 },
    true,
  ).armorPierceLayers,
  0,
);
assert.equal(battery?.stats.empoweredPiercingActions, 3);

// Chalk-Line: encounter consumed at start; one prevention; unused wards do not bank.
let chalk: RequisitionRuntime | null = runtime('chalk_line_ward');
const excludedChalkEncounter = encounter('ward-boss', 'BOSS');
chalk = beginRequisitionCombatEncounter(chalk, excludedChalkEncounter, 1);
assert.equal(
  interceptChalkLineHostileEffect(
    chalk,
    excludedChalkEncounter,
    'boss-effect',
    true,
    false,
  ).prevented,
  false,
);
for (let index = 1; index <= 3; index += 1) {
  const combat = encounter(`ward-${index}`, index === 2 ? 'ELITE' : 'STANDARD');
  chalk = beginRequisitionCombatEncounter(chalk, combat, 1);
  assert.equal(
    interceptChalkLineHostileEffect(
      chalk,
      combat,
      `unpreventable-${index}`,
      true,
      true,
    ).prevented,
    false,
  );
  assert.equal(
    interceptChalkLineHostileEffect(
      chalk,
      combat,
      `ineligible-${index}`,
      false,
      false,
    ).prevented,
    false,
  );
  if (index !== 2) {
    const prevented = interceptChalkLineHostileEffect(
      chalk,
      combat,
      `effect-${index}`,
      true,
      false,
    );
    assert.equal(prevented.prevented, true);
    chalk = prevented.runtime;
    assert.equal(
      interceptChalkLineHostileEffect(
        chalk,
        combat,
        `effect-${index}-later`,
        true,
        false,
      ).prevented,
      false,
    );
  }
  chalk = completeRequisitionCombatEncounter(chalk, combat);
}
chalk = beginRequisitionCombatEncounter(chalk, encounter('ward-4', 'STANDARD'), 1);
assert.equal(
  interceptChalkLineHostileEffect(
    chalk,
    encounter('ward-4', 'STANDARD'),
    'effect-4',
    true,
    false,
  ).prevented,
  false,
);
assert.equal(chalk?.stats.eligibleCombatEncountersConsumed, 3);
assert.equal(chalk?.stats.hostileEffectsPrevented, 2);

// Runtime snapshots are already-consumed state: replay attempts remain inert.
const primerSnapshot = JSON.parse(JSON.stringify(primer)) as RequisitionRuntime;
assert.equal(
  grantAdrenalinePrimerFirstTurnAp(
    primerSnapshot,
    encounter('standard-1', 'STANDARD'),
  ).bonusAp,
  0,
);

console.log('✓ Stage III-B finite Combat Preparation checks passed.');
