import assert from 'node:assert/strict';
import {
  COMBAT_PREPARATION_REQUISITION_IDS,
  DEFERRED_REQUISITION_IDS,
  ENABLED_REQUISITION_IDS,
} from '../types/expeditionRequisition';
import {
  canDeployWithRequisition,
  createFreshProofRequisitionAccountFields,
  normalizeRequisitionAccount,
  sanitizeRequisitionDeployment,
} from './requisitionAccountNormalize';
import {
  EXPEDITION_REQUISITION_DEFINITIONS,
  EXPEDITION_REQUISITION_REGISTRY,
} from './expeditionRequisitionRegistry';
import {
  REQUISITION_DONOR_DISPOSITIONS,
  resolveRequisitionDonorId,
} from './requisitionDonorDisposition';
import { validateExpeditionRequisitionProof } from './expeditionRequisitionValidation';
import { normalizeActiveRunRequisition } from './requisitionActiveRunNormalize';
import { createKeepsakeRuntime } from './keepsakeRunState';
import { mergeStoredAccount } from '../context/PlayerAccountContext';

console.log('Stage III-B — Expedition Requisition registry and account migration');

assert.equal(EXPEDITION_REQUISITION_DEFINITIONS.length, 15);
assert.equal(new Set(ENABLED_REQUISITION_IDS).size, 15);
assert.equal(
  EXPEDITION_REQUISITION_DEFINITIONS.filter(
    (definition) => definition.subtype === 'Combat Preparation',
  ).length,
  5,
);
assert.deepEqual(
  EXPEDITION_REQUISITION_DEFINITIONS
    .filter((definition) => definition.subtype === 'Combat Preparation')
    .map((definition) => definition.id),
  [...COMBAT_PREPARATION_REQUISITION_IDS],
);
for (const id of DEFERRED_REQUISITION_IDS) {
  assert.equal(id in EXPEDITION_REQUISITION_REGISTRY, false);
}
assert.deepEqual(validateExpeditionRequisitionProof(), []);

assert.equal(REQUISITION_DONOR_DISPOSITIONS.length, 39);
for (const id of ENABLED_REQUISITION_IDS) {
  assert.equal(resolveRequisitionDonorId(id), id);
}
assert.equal(resolveRequisitionDonorId('HAZARD_PAY'), 'hazard_pay');
assert.equal(resolveRequisitionDonorId('ADRENALINE_PRIMER'), 'adrenaline_primer');
assert.equal(
  resolveRequisitionDonorId('REINFORCED_TRENCH_COAT'),
  'reinforced_trench_coat',
);
assert.equal(
  resolveRequisitionDonorId('HOLLOW_POINT_REQUISITION'),
  'hollow_point_requisition',
);
assert.equal(resolveRequisitionDonorId('KINETIC_BATTERY'), 'kinetic_battery');
assert.equal(resolveRequisitionDonorId('CHALK_LINE_WARD'), 'chalk_line_ward');
assert.equal(resolveRequisitionDonorId('mirror_writ'), 'contract_seal');
assert.equal(resolveRequisitionDonorId('grave_polaroid'), 'mourners_bell');
assert.equal(resolveRequisitionDonorId('BLOOD_PRICE'), null);
assert.equal(resolveRequisitionDonorId('unknown_display_name'), null);

const migrated = normalizeRequisitionAccount({
  equippedKeepsakeId: 'signal_compass',
  unlockedKeepsakeIds: ['signal_compass', 'grave_polaroid', 'mirror_writ', 'unknown_id'],
  keepsakeDeployment: {
    attunement: 'ECHO_RESIDUE',
    routeDoctrine: 'GREED',
    mirrorCategory: 'CARGO',
  },
  craftedAugments: [
    'ADRENALINE_PRIMER',
    'KINETIC_BATTERY',
    'CHALK_LINE_WARD',
    'SMUGGLERS_POCKETS',
    'BLOOD_PRICE',
  ],
});
assert.equal(migrated.equippedRequisitionId, 'signal_compass');
assert.deepEqual(migrated.requisitionDeployment, {
  attunement: 'ECHO_RESIDUE',
  routeDoctrine: null,
});
assert.deepEqual(migrated.unlockedRequisitionIds, [
  'signal_compass',
  'smugglers_wrap',
  'contract_seal',
  'adrenaline_primer',
  'kinetic_battery',
  'chalk_line_ward',
  'mourners_bell',
]);
assert.equal('equippedKeepsakeId' in migrated, false);
assert.equal('unlockedKeepsakeIds' in migrated, false);
assert.equal('keepsakeDeployment' in migrated, false);
assert.equal('craftedAugments' in migrated, false);
assert.deepEqual(normalizeRequisitionAccount(migrated), migrated);

const mergedAccount = mergeStoredAccount({
  equippedKeepsakeId: 'signal_compass',
  unlockedKeepsakeIds: ['signal_compass'],
  craftedAugments: ['KINETIC_BATTERY'],
  keepsakeDeployment: {
    attunement: 'ECHO_RESIDUE',
  },
});
assert.equal(mergedAccount.equippedRequisitionId, 'signal_compass');
assert.deepEqual(mergedAccount.unlockedRequisitionIds, [
  'signal_compass',
  'kinetic_battery',
]);
assert.equal('craftedAugments' in mergedAccount, false);
assert.equal('equippedKeepsakeId' in mergedAccount, false);
assert.deepEqual(mergeStoredAccount(mergedAccount), mergedAccount);

assert.deepEqual(
  normalizeRequisitionAccount({
    equippedKeepsakeId: 'grave_polaroid',
    unlockedKeepsakeIds: ['grave_polaroid'],
  }),
  {
    equippedRequisitionId: null,
    unlockedRequisitionIds: ['mourners_bell'],
    requisitionDeployment: { attunement: null, routeDoctrine: null },
  },
);
assert.equal(
  normalizeRequisitionAccount({ equippedKeepsakeId: 'VOID_TOUCHED_ARTIFACT' })
    .equippedRequisitionId,
  null,
);
assert.deepEqual(
  sanitizeRequisitionDeployment('ashen_cartograph', {
    attunement: 'ANCHOR_SIGNAL',
    routeDoctrine: 'HUNT',
    mirrorCategory: 'CARGO',
  }),
  { attunement: null, routeDoctrine: 'HUNT' },
);

const fresh = createFreshProofRequisitionAccountFields();
assert.deepEqual(fresh.unlockedRequisitionIds, [...ENABLED_REQUISITION_IDS]);
assert.equal(fresh.equippedRequisitionId, null);
assert.equal(canDeployWithRequisition(fresh), false);
assert.equal(
  canDeployWithRequisition({
    ...fresh,
    equippedRequisitionId: 'signal_compass',
  }),
  true,
);
assert.deepEqual(fresh.requisitionDeployment, {
  attunement: null,
  routeDoctrine: null,
});

const legacyKeepsakeRuntime = createKeepsakeRuntime('signal_compass');
legacyKeepsakeRuntime.stats.nodeDetailsRevealed = 2;
const bothRuntimeSlots = normalizeActiveRunRequisition({
  keepsakeRuntime: {
    ...legacyKeepsakeRuntime,
    requisitionId: undefined,
    keepsakeId: 'signal_compass',
  },
  boundRequisition: { id: 'HAZARD_PAY' },
  keepsakeFullyInterpretedNodeIds: ['node-a'],
});
assert.equal(bothRuntimeSlots.winner, 'keepsake');
assert.equal(bothRuntimeSlots.requisitionRuntime?.requisitionId, 'signal_compass');
assert.equal(bothRuntimeSlots.requisitionRuntime?.stats.nodeDetailsRevealed, 2);
assert.deepEqual(bothRuntimeSlots.requisitionFullyInterpretedNodeIds, ['node-a']);
assert.equal(bothRuntimeSlots.replayRunStartEffects, false);

const boundOnly = normalizeActiveRunRequisition({
  boundRequisition: { id: 'HAZARD_PAY' },
});
assert.equal(boundOnly.winner, 'bound_cleared');
assert.equal(boundOnly.requisitionRuntime, null);
assert.equal(boundOnly.replayRunStartEffects, false);

console.log('✓ Stage III-B registry and account migration checks passed.');
