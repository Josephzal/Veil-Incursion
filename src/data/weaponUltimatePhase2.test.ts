/**
 * WU-2 — rebind class ultimates to Longsword / Carbine / Scythe only.
 * Run: npx tsx src/data/weaponUltimatePhase2.test.ts
 */
import assert from 'node:assert/strict';
import { AEGIS_ABILITY_CATALOG } from './aegisAbilities';
import { HEX_SHOT_ABILITY_CATALOG } from './hexShotAbilities';
import { ENVOY_ABILITY_CATALOG } from './envoyAbilities';
import {
  canFireLegacyClassUltimate,
  formatWeaponUltimateLabel,
  getCanonicalWeaponUltimateDisplayName,
  getWeaponUltimate,
  resolveUltimateFromLegacyClassId,
} from './weaponUltimateRegistry';
import {
  validateEnvoyLoadoutCommit,
  validateHexShotLoadoutCommit,
} from '../utils/classLoadoutUtils';

console.log('Phase WU-2 — weapon ultimate rebind suite');

// Ownership gates
assert.equal(canFireLegacyClassUltimate('EVISCERATE', 'aegis-runed-longsword'), true);
assert.equal(canFireLegacyClassUltimate('EVISCERATE', 'aegis-rift-edge'), false);
assert.equal(canFireLegacyClassUltimate('EVISCERATE', 'aegis-claymore-blade'), false);
assert.equal(canFireLegacyClassUltimate('EVISCERATE', null), false);

assert.equal(canFireLegacyClassUltimate('ZERO_PROTOCOL', 'hex-pulse-rifle'), true);
assert.equal(canFireLegacyClassUltimate('ZERO_PROTOCOL', 'hex-silver-core-sidearm'), false);
assert.equal(canFireLegacyClassUltimate('ZERO_PROTOCOL', 'hex-void-cannon'), false);

assert.equal(canFireLegacyClassUltimate('CATACLYSM_SIGIL', 'envoy-null-conduit'), true);
assert.equal(canFireLegacyClassUltimate('CATACLYSM_SIGIL', 'envoy-echo-lantern'), false);
assert.equal(canFireLegacyClassUltimate('CATACLYSM_SIGIL', 'envoy-sanguine-prism'), false);

assert.equal(getWeaponUltimate('aegis-runed-longsword').status, 'WIRED');
assert.equal(getWeaponUltimate('hex-pulse-rifle').status, 'WIRED');
assert.equal(getWeaponUltimate('envoy-null-conduit').status, 'WIRED');
assert.equal(getWeaponUltimate('aegis-rift-edge').status, 'WIRED');
assert.equal(getWeaponUltimate('hex-silver-core-sidearm').status, 'WIRED');
assert.equal(getWeaponUltimate('envoy-echo-lantern').status, 'WIRED');
assert.equal(getWeaponUltimate('aegis-claymore-blade').status, 'WIRED');
assert.equal(getWeaponUltimate('hex-void-cannon').status, 'WIRED');
assert.equal(getWeaponUltimate('envoy-sanguine-prism').status, 'WIRED');

assert.equal(
  resolveUltimateFromLegacyClassId('EVISCERATE', 'aegis-runed-longsword')?.displayName,
  'ABYSSAL VERDICT',
);
assert.equal(
  getCanonicalWeaponUltimateDisplayName('hex-pulse-rifle'),
  'ZERO PROTOCOL',
);
assert.equal(
  formatWeaponUltimateLabel('envoy-null-conduit'),
  '[ NULL CIRCUIT ]',
);

// Player-facing labels no longer emit retired class ultimate names on wired weapons
assert.equal(AEGIS_ABILITY_CATALOG.EVISCERATE.label, '[ ABYSSAL VERDICT ]');
assert.ok(!AEGIS_ABILITY_CATALOG.EVISCERATE.label.includes('EVISCERATE'));
assert.equal(HEX_SHOT_ABILITY_CATALOG.ZERO_PROTOCOL.label, '[ ZERO PROTOCOL ]');
assert.ok(!HEX_SHOT_ABILITY_CATALOG.ZERO_PROTOCOL.label.includes('ZERO-PROTOCOL'));
assert.equal(ENVOY_ABILITY_CATALOG.CATACLYSM_SIGIL.label, '[ NULL CIRCUIT ]');
assert.ok(!ENVOY_ABILITY_CATALOG.CATACLYSM_SIGIL.label.includes('CATACLYSM'));

// Deck reject copy uses weapon ultimate names
assert.ok(
  validateHexShotLoadoutCommit([
    'SILVER_CORE_SIDEARM',
    'ZERO_PROTOCOL',
    'PHASE_SHIFT_RELOAD',
    'ASH_JACKET_SALVO',
  ])?.includes('ZERO PROTOCOL'),
);
assert.ok(
  validateEnvoyLoadoutCommit([
    'VEIL_SPLINTER',
    'CATACLYSM_SIGIL',
    'ASTRAL_LANCE',
    'RIFT_WARD',
  ])?.includes('NULL CIRCUIT'),
);

console.log('Phase WU-2 rebind OK — Longsword / Carbine / Scythe own rebound ultimates');
