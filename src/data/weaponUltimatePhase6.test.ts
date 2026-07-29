/**
 * WU-6 — validation closeout + retired-name audit.
 * Run: npx tsx src/data/weaponUltimatePhase6.test.ts
 */
import assert from 'node:assert/strict';
import {
  auditWeaponUltimatePlayerFacingCatalogs,
  formatWeaponUltimateValidationReport,
  validateWeaponUltimates,
} from './weaponUltimateValidationEngine';
import { validateWeaponRegistry, formatWeaponValidationReport } from './weaponValidationEngine';
import {
  RETIRED_CLASS_ULTIMATE_DISPLAY_NAMES,
  formatWeaponUltimateLabel,
  listWeaponUltimates,
} from './weaponUltimateRegistry';
import { AEGIS_ABILITY_CATALOG } from './aegisAbilities';
import { HEX_SHOT_ABILITY_CATALOG } from './hexShotAbilities';
import { ENVOY_ABILITY_CATALOG } from './envoyAbilities';

console.log('Phase WU-6 — weapon ultimate validation closeout');

const ultimateIssues = validateWeaponUltimates();
assert.deepEqual(
  ultimateIssues,
  [],
  formatWeaponUltimateValidationReport(ultimateIssues),
);

assert.deepEqual(auditWeaponUltimatePlayerFacingCatalogs(), []);

assert.equal(listWeaponUltimates().filter((u) => u.status === 'WIRED').length, 9);

// Catalog labels are weapon ultimate names, not retired class titles.
assert.equal(AEGIS_ABILITY_CATALOG.EVISCERATE.label, '[ THREEFOLD BRAND ]');
assert.ok(!AEGIS_ABILITY_CATALOG.EVISCERATE.label.includes('EVISCERATE'));
assert.equal(HEX_SHOT_ABILITY_CATALOG.ZERO_PROTOCOL.label, '[ ZERO PROTOCOL ]');
assert.ok(!HEX_SHOT_ABILITY_CATALOG.ZERO_PROTOCOL.label.includes('ZERO-PROTOCOL'));
assert.equal(ENVOY_ABILITY_CATALOG.CATACLYSM_SIGIL.label, '[ NULL CIRCUIT ]');
assert.ok(!ENVOY_ABILITY_CATALOG.CATACLYSM_SIGIL.label.includes('CATACLYSM'));

for (const retired of RETIRED_CLASS_ULTIMATE_DISPLAY_NAMES) {
  assert.ok(!formatWeaponUltimateLabel('aegis-runed-longsword').includes(retired));
  assert.ok(!formatWeaponUltimateLabel('hex-pulse-rifle').includes(retired));
  assert.ok(!formatWeaponUltimateLabel('envoy-null-conduit').includes(retired));
  assert.ok(!formatWeaponUltimateLabel('hex-void-cannon').includes(retired));
}

assert.equal(formatWeaponUltimateLabel('hex-void-cannon'), '[ LAST KNOCK ]');
assert.ok(!formatWeaponUltimateLabel('hex-void-cannon').includes('The Black Door'));

// Wired into global weapon validation pipeline.
const registryIssues = validateWeaponRegistry().filter((i) =>
  i.message.startsWith('Weapon ultimate:'),
);
assert.deepEqual(registryIssues, [], formatWeaponValidationReport(registryIssues));

assert.match(
  formatWeaponUltimateValidationReport([]),
  /PASS/,
);

console.log('Phase WU-6 OK — validation PASS, retired-name audit clean, pipeline wired');
