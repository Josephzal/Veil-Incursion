import assert from 'node:assert/strict';
import { NINE_STRAIN_IDS } from './nineStrain/strainRegistry';
import {
  CONVERGENCE_IDS,
  SECTOR_2_CONVERGENCE_IDS,
  SECTOR_3_CONVERGENCE_IDS,
  SECTOR_4_CONVERGENCE_IDS,
  SECTOR_4_STRAIN_IDS,
} from '../types/convergence';
import type { StrainId } from '../types/nineStrain';

const SECTOR_1_CONVERGENCE_IDS = [
  CONVERGENCE_IDS.FATED_REFRAIN,
  CONVERGENCE_IDS.SECOND_OUTCOME,
  CONVERGENCE_IDS.ECHOED_RITE,
] as const;
import {
  getLiveUniversalBoonDefinitions,
  getProductionOfferDefinitions,
  definitionAcquisitionWave,
} from './nineStrain/definitionCatalog';
import { NINE_STRAIN_SCHEMA_VERSION } from './nineStrain/strainRegistry';
import { NINE_STRAIN_CONTENT_MAX_ACQUISITION_WAVE } from './nineStrain/contentConfiguration';
import { CANONICAL_WEAPON_FAMILY_IDS } from './weaponFamilyIdNormalize';

console.log('Stage E.3 — Standard-catalog closeout integrity');

const live = getLiveUniversalBoonDefinitions();

// --- Exactly 9 Strains ---
assert.equal(NINE_STRAIN_IDS.length, 9, 'exactly nine Strains');
assert.equal(new Set(live.map((row) => row.strainId)).size, 9, 'catalog spans exactly nine Strains');

// --- Exactly 4 Cores, 2 Supports, 1 Manifestation, 1 Verdict per Strain ---
for (const strainId of NINE_STRAIN_IDS) {
  const rows = live.filter((row) => row.strainId === strainId && row.role !== 'CONVERGENCE');
  assert.equal(rows.length, 8, `${strainId} has exactly 8 non-Convergence definitions`);
  assert.equal(rows.filter((row) => row.role === 'CORE').length, 4, `${strainId} has exactly 4 Cores`);
  assert.equal(rows.filter((row) => row.role === 'SUPPORT').length, 2, `${strainId} has exactly 2 Supports`);
  assert.equal(rows.filter((row) => row.role === 'MANIFESTATION').length, 1, `${strainId} has exactly 1 Manifestation`);
  assert.equal(rows.filter((row) => row.role === 'VERDICT').length, 1, `${strainId} has exactly 1 Verdict`);
}

// --- Exactly 36 Convergences; 108 standard definitions; 72 family definitions ---
const convergences = live.filter((row) => row.role === 'CONVERGENCE');
assert.equal(convergences.length, 36, 'exactly 36 Convergences');
assert.equal(live.length, 108, 'exactly 108 standard definitions');
assert.equal(live.filter((row) => row.role !== 'CONVERGENCE').length, 72, 'exactly 72 family definitions');

// --- Wave pools: 27 / 50 / 77 / 108 ---
assert.equal(getProductionOfferDefinitions(1).length, 27);
assert.equal(getProductionOfferDefinitions(2).length, 50);
assert.equal(getProductionOfferDefinitions(3).length, 77);
assert.equal(getProductionOfferDefinitions(4).length, 108);
assert.equal(NINE_STRAIN_CONTENT_MAX_ACQUISITION_WAVE, 4, 'production wave ceiling is cut over to 4');

// --- Cumulative Convergences by wave: 3 / 10 / 21 / 36 ---
assert.equal(SECTOR_1_CONVERGENCE_IDS.length, 3);
assert.equal(SECTOR_1_CONVERGENCE_IDS.length + SECTOR_2_CONVERGENCE_IDS.length, 10);
assert.equal(SECTOR_1_CONVERGENCE_IDS.length + SECTOR_2_CONVERGENCE_IDS.length + SECTOR_3_CONVERGENCE_IDS.length, 21);
assert.equal(
  SECTOR_1_CONVERGENCE_IDS.length + SECTOR_2_CONVERGENCE_IDS.length + SECTOR_3_CONVERGENCE_IDS.length + SECTOR_4_CONVERGENCE_IDS.length,
  36,
);
assert.equal(
  convergences.filter((row) => definitionAcquisitionWave(row) === 1).length,
  SECTOR_1_CONVERGENCE_IDS.length,
);
assert.equal(
  convergences.filter((row) => definitionAcquisitionWave(row) <= 2).length,
  SECTOR_1_CONVERGENCE_IDS.length + SECTOR_2_CONVERGENCE_IDS.length,
);
assert.equal(
  convergences.filter((row) => definitionAcquisitionWave(row) <= 3).length,
  SECTOR_1_CONVERGENCE_IDS.length + SECTOR_2_CONVERGENCE_IDS.length + SECTOR_3_CONVERGENCE_IDS.length,
);
assert.equal(convergences.filter((row) => definitionAcquisitionWave(row) <= 4).length, 36);

// --- The exact 15 Sector 4 Convergence ids exist, are role CONVERGENCE, acquisitionWave 4, no Imprint,
//     and record both parent Strains (via strainId/secondaryStrainId) plus qualifying parent Cores ---
const SECTOR_4_PAIRINGS: Record<string, readonly [StrainId, StrainId]> = {
  [CONVERGENCE_IDS.FATE_OUT_OF_PLACE]: ['COUNTERFATE', 'GRAVEMARK'],
  [CONVERGENCE_IDS.TURNING_RITE]: ['RITUAL_CADENCE', 'GRAVEMARK'],
  [CONVERGENCE_IDS.PARALLAX_ECHO]: ['AFTERIMAGE', 'GRAVEMARK'],
  [CONVERGENCE_IDS.STORED_VECTOR]: ['STILLPOINT', 'GRAVEMARK'],
  [CONVERGENCE_IDS.TETHERED_ORBIT]: ['WOUNDWEAVE', 'GRAVEMARK'],
  [CONVERGENCE_IDS.TECTONIC_SHIFT]: ['FAULTLINE', 'GRAVEMARK'],
  [CONVERGENCE_IDS.TRAUMA_VECTOR]: ['SOULWAKE', 'GRAVEMARK'],
  [CONVERGENCE_IDS.FATED_FACET]: ['COUNTERFATE', 'SHARDSKIN'],
  [CONVERGENCE_IDS.PRISMATIC_RITE]: ['RITUAL_CADENCE', 'SHARDSKIN'],
  [CONVERGENCE_IDS.PHANTOM_FACET]: ['AFTERIMAGE', 'SHARDSKIN'],
  [CONVERGENCE_IDS.STILLGLASS]: ['STILLPOINT', 'SHARDSKIN'],
  [CONVERGENCE_IDS.CRYSTAL_LIGATURE]: ['WOUNDWEAVE', 'SHARDSKIN'],
  [CONVERGENCE_IDS.FAULTGLASS]: ['FAULTLINE', 'SHARDSKIN'],
  [CONVERGENCE_IDS.SOULGLASS]: ['SOULWAKE', 'SHARDSKIN'],
  [CONVERGENCE_IDS.IMPACT_LATTICE]: ['GRAVEMARK', 'SHARDSKIN'],
};

assert.equal(Object.keys(SECTOR_4_PAIRINGS).length, 15, 'exactly 15 Sector 4 Convergences enumerated');
assert.equal(SECTOR_4_CONVERGENCE_IDS.length, 15);
assert.deepEqual(
  new Set(SECTOR_4_CONVERGENCE_IDS as readonly string[]),
  new Set(Object.keys(SECTOR_4_PAIRINGS)),
  'SECTOR_4_CONVERGENCE_IDS matches the fixed 15-definition table',
);

for (const [id, [parentA, parentB]] of Object.entries(SECTOR_4_PAIRINGS)) {
  const def = live.find((row) => row.id === id);
  assert.ok(def, `${id} is a live definition`);
  assert.equal(def!.role, 'CONVERGENCE', `${id} is role CONVERGENCE`);
  assert.equal(def!.acquisitionWave, 4, `${id} is acquisitionWave 4`);
  assert.equal(def!.imprint, undefined, `${id} carries no Imprint`);
  const parents = new Set([def!.strainId, def!.secondaryStrainId]);
  assert.ok(parents.has(parentA), `${id} records parent Strain ${parentA}`);
  assert.ok(parents.has(parentB), `${id} records parent Strain ${parentB}`);
  const parentStrainIds = def!.prerequisites?.parentStrainIds ?? [];
  assert.ok(parentStrainIds.length >= 2, `${id} records both parent Strains in prerequisites`);
}

// --- Gravemark/Shardskin are exactly the Sector 4 Strains ---
assert.deepEqual(new Set(SECTOR_4_STRAIN_IDS as readonly string[]), new Set(['GRAVEMARK', 'SHARDSKIN']));

// --- Exactly one live definition per id; no test-only definition in production offers ---
{
  const ids = live.map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length, 'no duplicate definition ids');
}
for (const wave of [1, 2, 3, 4] as const) {
  const pool = getProductionOfferDefinitions(wave);
  assert.equal(pool.some((row) => row.testOnly === true), false, `wave ${wave} production pool excludes test-only definitions`);
}

// --- Canonical nine weapon IDs and Vambrace singular ---
assert.equal(CANONICAL_WEAPON_FAMILY_IDS.length, 9);
assert.ok(CANONICAL_WEAPON_FAMILY_IDS.includes('envoy-vambrace'), 'canonical Envoy id uses singular Vambrace');
assert.equal(CANONICAL_WEAPON_FAMILY_IDS.some((id) => id.includes('vambraces')), false, 'no plural Vambraces leaks into canonical ids');

// --- Schema version ---
assert.equal(NINE_STRAIN_SCHEMA_VERSION, 15);

console.log('Stage E.3 — Standard-catalog closeout integrity passed');
