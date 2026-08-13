/**
 * Stage II-A — legacy mid-run combat-trinket retirement.
 * Run: npx tsx src/data/legacyCombatTrinketRetirement.test.ts
 */
import assert from 'node:assert/strict';
import { createInitialRunState } from './createInitialRunState';
import { applySkillCheckTierEffects } from './skillCheckTierEngine';
import {
  createDefaultPlayerAccountEquipment,
  normalizePlayerAccountEquipment,
  storedEquipmentHasRetiredTrinketId,
} from './playerAccountEquipmentNormalize';
import {
  createDefaultPlayerAccount,
  mergeStoredAccount,
} from '../context/PlayerAccountContext';
import { preparePostCombatBoonOffers } from './classBoonEngine';
import { ENABLED_REQUISITION_IDS } from '../types/expeditionRequisition';
import { createKeepsakeRuntime } from './keepsakeRunState';
import { CARGO_ITEM_CATALOG } from '../types/cargoGrid';
import * as regions from './regions';

console.log('Stage II-A — legacy combat-trinket retirement');

// 1. Fresh run has no legacy activeTrinkets state
{
  const run = createInitialRunState();
  assert.equal(
    Object.prototype.hasOwnProperty.call(run, 'activeTrinkets'),
    false,
    'fresh RunState must not declare activeTrinkets',
  );
  assert.equal(run.parryWindowBonus, 0);
  assert.equal(run.parryMultiplierBonus, 0);
  assert.equal(run.sliceDamagePenalty, 0);
  assert.equal(run.startingAbyssalReservePercent, 0);
}

// 2. No reachable reward-pool catalogs / pickers for legacy trinkets
{
  const regionExports = regions as Record<string, unknown>;
  for (const dead of [
    'TRINKET_POOL',
    'POST_COMBAT_BOON_POOL',
    'pickRandomTrinkets',
    'pickRandomPostCombatBoons',
  ]) {
    assert.equal(regionExports[dead], undefined, `regions must not export ${dead}`);
  }
}

// 3. Skill-check critical success does not grant a trinket (HP restore only)
{
  const base = {
    maxStamina: 100,
    maxSoulAnchor: 100,
    soulAnchorIntegrity: 40,
    currentStamina: 50,
    pendingAmbush: false,
  };
  const crit = applySkillCheckTierEffects(base, 'CRITICAL_SUCCESS');
  assert.equal(crit.soulAnchorIntegrity, 70);
  assert.equal(crit.maxStamina, 100);
  assert.equal(crit.currentStamina, 50);
  assert.equal(crit.pendingAmbush, false);
  assert.equal(
    Object.prototype.hasOwnProperty.call(crit, 'activeTrinkets'),
    false,
    'skill-check effects must not include activeTrinkets',
  );

  const success = applySkillCheckTierEffects(base, 'SUCCESS');
  assert.equal(success.maxStamina, 110);
  assert.equal(success.currentStamina, 70);

  const fail = applySkillCheckTierEffects(base, 'FAILURE');
  assert.equal(fail.soulAnchorIntegrity, 25);
  assert.equal(fail.maxStamina, 70);

  const desync = applySkillCheckTierEffects(base, 'CRITICAL_DESYNC', { ambushEnabled: true });
  assert.equal(desync.soulAnchorIntegrity, 15);
  assert.equal(desync.pendingAmbush, true);
}

// 4. Combat startup modifiers are not driven by legacy trinket aggregation
{
  const run = createInitialRunState();
  // Sole retained writers of these fields are non-trinket systems (e.g. narrative
  // patching startingAbyssalReservePercent). Fresh runs contribute zeros.
  assert.deepEqual(
    {
      parryWindowBonus: run.parryWindowBonus,
      parryMultiplierBonus: run.parryMultiplierBonus,
      sliceDamagePenalty: run.sliceDamagePenalty,
      startingAbyssalReservePercent: run.startingAbyssalReservePercent,
    },
    {
      parryWindowBonus: 0,
      parryMultiplierBonus: 0,
      sliceDamagePenalty: 0,
      startingAbyssalReservePercent: 0,
    },
  );
}

// 5. Run-complete presentation: no TRINKETS field on run state to report
{
  const run = createInitialRunState();
  assert.equal('activeTrinkets' in run, false);
}

// 6–8. Old account with equipment.trinketId loads safely; field stripped; idempotent
{
  const legacyBlob = {
    ...createDefaultPlayerAccount(),
    id: 'legacy-operative',
    equipment: {
      weaponId: 'ghost-blade',
      armorId: null,
      trinketId: 'tuning-fork',
    },
  } as Parameters<typeof mergeStoredAccount>[0] & {
    equipment: { weaponId: string | null; armorId: string | null; trinketId: string | null };
  };

  assert.ok(storedEquipmentHasRetiredTrinketId(legacyBlob.equipment));

  const first = mergeStoredAccount(legacyBlob);
  assert.equal(Object.prototype.hasOwnProperty.call(first.equipment, 'trinketId'), false);
  assert.deepEqual(first.equipment, { weaponId: null, armorId: null });
  assert.notEqual(
    (first.equipment as { trinketId?: string | null }).trinketId,
    'tuning-fork',
    'must not remapped retired trinketId to a live field',
  );

  const second = mergeStoredAccount(first);
  assert.deepEqual(second.equipment, first.equipment);
  assert.equal(Object.prototype.hasOwnProperty.call(second.equipment, 'trinketId'), false);

  const normalizedDirect = normalizePlayerAccountEquipment({
    weaponId: 'x',
    armorId: 'y',
    trinketId: 'ghost-battery',
  });
  assert.deepEqual(normalizedDirect, { weaponId: null, armorId: 'y' });
  assert.deepEqual(
    normalizePlayerAccountEquipment(normalizedDirect),
    normalizedDirect,
  );
  assert.deepEqual(createDefaultPlayerAccountEquipment(), { weaponId: null, armorId: null });
  assert.equal(
    Object.prototype.hasOwnProperty.call(createDefaultPlayerAccount().equipment, 'trinketId'),
    false,
  );
}

// 9. Expedition Requisition selection defaults remain intact
{
  assert.ok(ENABLED_REQUISITION_IDS.length > 0);
  const requisitionId = ENABLED_REQUISITION_IDS[0]!;
  const runtime = createKeepsakeRuntime(requisitionId);
  assert.equal(runtime.requisitionId, requisitionId);
  assert.equal(runtime.stats.cargoBankedByRequisition, 0);
  assert.ok(Array.isArray(runtime.decisions));
}

// 10. Cargo Supply subtype remains intact
{
  assert.equal(CARGO_ITEM_CATALOG['standard-coagulant'].subtype, 'SUPPLY');
}

// 11. Class-boon post-combat offer path still produces offers (unchanged API)
{
  const offers = preparePostCombatBoonOffers(
    'AEGIS',
    [],
    [],
    [],
    3,
    {
      weaponFamilyId: 'aegis-longsword',
      equippedAbilityIds: [],
      seed: 'stage-ii-a-trinket-retirement',
      depthBand: 1,
      isFirstOffer: true,
      abilityGrafts: {},
    },
  );
  assert.equal(offers.length, 3);
  for (const offer of offers) {
    assert.ok(offer.id);
    assert.ok(offer.name);
  }
}

console.log('legacyCombatTrinketRetirement.test.ts — all assertions passed');
