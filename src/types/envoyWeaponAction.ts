/**
 * Envoy weapon-kit actions — derived from equipped family, never persisted as flex selections.
 * E.3: total family authority (all kit-complete). Actions 2–4 are not live-executable until E.4.
 */

export type EnvoyWeaponActionId =
  // Vambrace — envoy-echo-lantern
  | 'GRAVEWEAVE'
  | 'GRAVE_TRANSFER'
  | 'VEIL_BRAND'
  | 'ROT_KNELL'
  // Scythe — envoy-null-conduit
  | 'NULL_ARC'
  | 'SILENT_EDGE'
  | 'VEIN_CUT'
  | 'SMOKE_ARC'
  // Heart's Due — envoy-sanguine-prism
  | 'BLOOD_REFRACTION'
  | 'EXPOSE_VEIN'
  | 'CRIMSON_VENT'
  | 'HEART_CLAIM';

export type EnvoyVambraceWeaponActionId =
  | 'GRAVEWEAVE'
  | 'GRAVE_TRANSFER'
  | 'VEIL_BRAND'
  | 'ROT_KNELL';

export type EnvoyScytheWeaponActionId =
  | 'NULL_ARC'
  | 'SILENT_EDGE'
  | 'VEIN_CUT'
  | 'SMOKE_ARC';

export type EnvoyHeartsDueWeaponActionId =
  | 'BLOOD_REFRACTION'
  | 'EXPOSE_VEIN'
  | 'CRIMSON_VENT'
  | 'HEART_CLAIM';

export const ENVOY_VAMBRACE_WEAPON_ACTIONS: readonly [
  EnvoyVambraceWeaponActionId,
  EnvoyVambraceWeaponActionId,
  EnvoyVambraceWeaponActionId,
  EnvoyVambraceWeaponActionId,
] = ['GRAVEWEAVE', 'GRAVE_TRANSFER', 'VEIL_BRAND', 'ROT_KNELL'];

export const ENVOY_SCYTHE_WEAPON_ACTIONS: readonly [
  EnvoyScytheWeaponActionId,
  EnvoyScytheWeaponActionId,
  EnvoyScytheWeaponActionId,
  EnvoyScytheWeaponActionId,
] = ['NULL_ARC', 'SILENT_EDGE', 'VEIN_CUT', 'SMOKE_ARC'];

export const ENVOY_HEARTS_DUE_WEAPON_ACTIONS: readonly [
  EnvoyHeartsDueWeaponActionId,
  EnvoyHeartsDueWeaponActionId,
  EnvoyHeartsDueWeaponActionId,
  EnvoyHeartsDueWeaponActionId,
] = ['BLOOD_REFRACTION', 'EXPOSE_VEIN', 'CRIMSON_VENT', 'HEART_CLAIM'];

/** @deprecated E.4 — all twelve actions are internally executable; use ENVOY_EXECUTABLE_WEAPON_ACTION_IDS. */
export const ENVOY_LIVE_ACTION_ONE_IDS: readonly EnvoyWeaponActionId[] = [
  'GRAVEWEAVE',
  'NULL_ARC',
  'BLOOD_REFRACTION',
];

/** E.4 — all canonical Envoy weapon actions with real executors (engine-internal; Hub still 4-slot). */
export const ENVOY_EXECUTABLE_WEAPON_ACTION_IDS: readonly EnvoyWeaponActionId[] = [
  ...ENVOY_VAMBRACE_WEAPON_ACTIONS,
  ...ENVOY_SCYTHE_WEAPON_ACTIONS,
  ...ENVOY_HEARTS_DUE_WEAPON_ACTIONS,
];
