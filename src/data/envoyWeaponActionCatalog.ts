/**
 * Authored Envoy weapon-action structural definitions (E.2 contract / E.3 catalog).
 * Values match docs/envoy-weapon-kit-contract.md. No resolution plans for Actions 2–4.
 */
import type { EnvoyWeaponActionId } from '../types/envoyWeaponAction';
import type { AbilityTargetMode } from './combatTargeting';
import type { EnvoyWeaponFamilyId } from './envoyWeaponActionRegistry';
import { isEnvoyWeaponActionId } from './envoyWeaponActionRegistry';

export type EnvoyWeaponActionCategory = 'ENVOY_WEAPON_ACTION';

/** E.3/E.4 dispatch identity — Action 1 stays on live anchor path. */
export type EnvoyWeaponActionExecutorDispatch =
  | 'LIVE_ANCHOR_BASIC'
  | 'ENVOY_WA_EXECUTOR';

export type EnvoyCatalystPrime = 'NULL' | 'ECHO' | 'BLOOD' | 'ASH' | null;

export interface EnvoyWeaponActionDefinition {
  id: EnvoyWeaponActionId;
  familyId: EnvoyWeaponFamilyId;
  /** Canonical order 1–4 within the family. */
  order: 1 | 2 | 3 | 4;
  displayName: string;
  label: string;
  category: EnvoyWeaponActionCategory;
  description: string;
  tooltip: string;
  combatLogTemplate: string;
  apCost: number;
  staminaCost: number;
  /** Catalog Flux cost before family plan overrides (Action 1 may adjust at runtime). */
  fluxCost: number;
  /** Authored Flux gain on hit/resolve (0 unless contracted). */
  fluxGain: number;
  /** Structural HP-sacrifice metadata; Action 1 uses live prism constants. */
  hasHpSacrifice: boolean;
  targetMode: AbilityTargetMode;
  damageChannel: 'OCCULT' | 'NONE';
  /** Authored base occult before family scaling / conditionals. */
  baseDamage: number;
  rotApply: number;
  rotTransferMax: number;
  rotConsumeMax: number;
  wardStrip: number;
  catalystPrime: EnvoyCatalystPrime;
  cleanCycleEligible: boolean;
  brinkEligible: boolean;
  curseTags: readonly string[];
  boonTags: readonly string[];
  graftTags: readonly string[];
  previewDispatchId: EnvoyWeaponActionId;
  executorDispatch: EnvoyWeaponActionExecutorDispatch;
  /** No new WA charge meter — Rot contribution only. */
  ultimateChargeEligibility: 'ROT_BOARD_CONTRIBUTION' | 'NONE';
  provenanceId: EnvoyWeaponActionId;
  /** True when E.4 has not supplied an executor (orders 2–4). */
  executorUnavailable: boolean;
}

function def(
  partial: Omit<EnvoyWeaponActionDefinition, 'category' | 'previewDispatchId' | 'provenanceId' | 'label'>
    & { label?: string },
): EnvoyWeaponActionDefinition {
  return {
    category: 'ENVOY_WEAPON_ACTION',
    previewDispatchId: partial.id,
    provenanceId: partial.id,
    label: partial.label ?? `[ ${partial.displayName.toUpperCase()} ]`,
    ...partial,
  };
}

const CATALOG: Record<EnvoyWeaponActionId, EnvoyWeaponActionDefinition> = {
  GRAVEWEAVE: def({
    id: 'GRAVEWEAVE',
    familyId: 'envoy-echo-lantern',
    order: 1,
    displayName: 'Graveweave',
    description: 'Low occult brand. Applies 2 Veil Rot. Strips 1 Occult Ward. Primes NULL.',
    tooltip: 'Low occult brand. Applies 2 Veil Rot. Strips 1 Occult Ward. Primes NULL.',
    combatLogTemplate: "[VAMBRACE] >> Graveweave — extra Veil Rot for later detonation.",
    apCost: 1,
    staminaCost: 6,
    fluxCost: 5,
    fluxGain: 0,
    hasHpSacrifice: false,
    targetMode: 'SINGLE',
    damageChannel: 'OCCULT',
    baseDamage: 10,
    rotApply: 2,
    rotTransferMax: 0,
    rotConsumeMax: 0,
    wardStrip: 1,
    catalystPrime: 'NULL',
    cleanCycleEligible: false,
    brinkEligible: false,
    curseTags: [],
    boonTags: ['OCCULT', 'CURSE', 'CONTROL', 'FLUX', 'WEAPON_BASIC'],
    graftTags: ['OCCULT', 'CURSE', 'CONTROL', 'FLUX', 'WEAPON_BASIC'],
    executorDispatch: 'LIVE_ANCHOR_BASIC',
    ultimateChargeEligibility: 'ROT_BOARD_CONTRIBUTION',
    executorUnavailable: false,
  }),
  GRAVE_TRANSFER: def({
    id: 'GRAVE_TRANSFER',
    familyId: 'envoy-echo-lantern',
    order: 2,
    displayName: 'Grave Transfer',
    description: 'Move up to 2 Veil Rot from one enemy to another. Light occult on the destination. Primes ECHO.',
    tooltip: 'Move up to 2 Veil Rot from one enemy to another. Light occult on the destination. Primes ECHO.',
    combatLogTemplate: '[VAMBRACE] >> Grave Transfer — Rot relocated.',
    apCost: 1,
    staminaCost: 8,
    fluxCost: 10,
    fluxGain: 0,
    hasHpSacrifice: false,
    targetMode: 'DUAL',
    damageChannel: 'OCCULT',
    baseDamage: 6,
    rotApply: 0,
    rotTransferMax: 2,
    rotConsumeMax: 0,
    wardStrip: 0,
    catalystPrime: 'ECHO',
    cleanCycleEligible: false,
    brinkEligible: false,
    curseTags: [],
    boonTags: ['OCCULT', 'CURSE', 'CONTROL', 'FLUX'],
    graftTags: ['OCCULT', 'CURSE', 'CONTROL', 'FLUX'],
    executorDispatch: 'ENVOY_WA_EXECUTOR',
    ultimateChargeEligibility: 'ROT_BOARD_CONTRIBUTION',
    executorUnavailable: false,
  }),
  VEIL_BRAND: def({
    id: 'VEIL_BRAND',
    familyId: 'envoy-echo-lantern',
    order: 3,
    displayName: 'Veil Brand',
    description: 'Brand the target: 5 occult, 1 Veil Rot, −1 AP next turn. Primes ECHO.',
    tooltip: 'Brand the target: 5 occult, 1 Veil Rot, −1 AP next turn. Primes ECHO.',
    combatLogTemplate: '[VAMBRACE] >> Veil Brand — curse latched.',
    apCost: 1,
    staminaCost: 8,
    fluxCost: 12,
    fluxGain: 0,
    hasHpSacrifice: false,
    targetMode: 'SINGLE',
    damageChannel: 'OCCULT',
    baseDamage: 5,
    rotApply: 1,
    rotTransferMax: 0,
    rotConsumeMax: 0,
    wardStrip: 0,
    catalystPrime: 'ECHO',
    cleanCycleEligible: false,
    brinkEligible: false,
    curseTags: ['AP_DRAIN'],
    boonTags: ['OCCULT', 'CURSE', 'CONTROL', 'DEBUFF'],
    graftTags: ['OCCULT', 'CURSE', 'CONTROL', 'DEBUFF'],
    executorDispatch: 'ENVOY_WA_EXECUTOR',
    ultimateChargeEligibility: 'ROT_BOARD_CONTRIBUTION',
    executorUnavailable: false,
  }),
  ROT_KNELL: def({
    id: 'ROT_KNELL',
    familyId: 'envoy-echo-lantern',
    order: 4,
    displayName: 'Rot Knell',
    description: 'Consume up to 2 Veil Rot on the target for 8 occult per stack consumed. Primes ASH.',
    tooltip: 'Consume up to 2 Veil Rot on the target for 8 occult per stack consumed. Primes ASH.',
    combatLogTemplate: '[VAMBRACE] >> Rot Knell — partial detonation.',
    apCost: 1,
    staminaCost: 10,
    fluxCost: 15,
    fluxGain: 0,
    hasHpSacrifice: false,
    targetMode: 'SINGLE',
    damageChannel: 'OCCULT',
    baseDamage: 8,
    rotApply: 0,
    rotTransferMax: 0,
    rotConsumeMax: 2,
    wardStrip: 0,
    catalystPrime: 'ASH',
    cleanCycleEligible: false,
    brinkEligible: false,
    curseTags: [],
    boonTags: ['OCCULT', 'FLUX_DUMP', 'CURSE'],
    graftTags: ['OCCULT', 'FLUX_DUMP', 'CURSE'],
    executorDispatch: 'ENVOY_WA_EXECUTOR',
    ultimateChargeEligibility: 'ROT_BOARD_CONTRIBUTION',
    executorUnavailable: false,
  }),
  NULL_ARC: def({
    id: 'NULL_ARC',
    familyId: 'envoy-null-conduit',
    order: 1,
    displayName: 'Null Arc',
    description: 'Efficient occult arc. 1 Veil Rot, 1 Ward strip. Primes NULL. CLEAN CYCLE after NULL or BLOOD.',
    tooltip: 'Efficient occult arc. 1 Veil Rot, 1 Ward strip. Primes NULL. CLEAN CYCLE after NULL or BLOOD.',
    combatLogTemplate: '[SCYTHE] >> Null Arc — Clean Catalyst cycle.',
    apCost: 1,
    staminaCost: 6,
    fluxCost: 5,
    fluxGain: 0,
    hasHpSacrifice: false,
    targetMode: 'SINGLE',
    damageChannel: 'OCCULT',
    baseDamage: 10,
    rotApply: 1,
    rotTransferMax: 0,
    rotConsumeMax: 0,
    wardStrip: 1,
    catalystPrime: 'NULL',
    cleanCycleEligible: true,
    brinkEligible: false,
    curseTags: [],
    boonTags: ['OCCULT', 'FLUX', 'CLEAN_CYCLE', 'WEAPON_BASIC'],
    graftTags: ['OCCULT', 'FLUX', 'CLEAN_CYCLE', 'WEAPON_BASIC'],
    executorDispatch: 'LIVE_ANCHOR_BASIC',
    ultimateChargeEligibility: 'ROT_BOARD_CONTRIBUTION',
    executorUnavailable: false,
  }),
  SILENT_EDGE: def({
    id: 'SILENT_EDGE',
    familyId: 'envoy-null-conduit',
    order: 2,
    displayName: 'Silent Edge',
    description: '14 occult, 1 Rot, 1 Ward strip. Primes ECHO. Completes Silencing Echo after NULL.',
    tooltip: '14 occult, 1 Rot, 1 Ward strip. Primes ECHO. Completes Silencing Echo after NULL.',
    combatLogTemplate: '[SCYTHE] >> Silent Edge — echo cut.',
    apCost: 1,
    staminaCost: 8,
    fluxCost: 12,
    fluxGain: 0,
    hasHpSacrifice: false,
    targetMode: 'SINGLE',
    damageChannel: 'OCCULT',
    baseDamage: 14,
    rotApply: 1,
    rotTransferMax: 0,
    rotConsumeMax: 0,
    wardStrip: 1,
    catalystPrime: 'ECHO',
    cleanCycleEligible: false,
    brinkEligible: false,
    curseTags: [],
    boonTags: ['OCCULT', 'FLUX', 'WARD_BREAK'],
    graftTags: ['OCCULT', 'FLUX', 'WARD_BREAK'],
    executorDispatch: 'ENVOY_WA_EXECUTOR',
    ultimateChargeEligibility: 'ROT_BOARD_CONTRIBUTION',
    executorUnavailable: false,
  }),
  VEIN_CUT: def({
    id: 'VEIN_CUT',
    familyId: 'envoy-null-conduit',
    order: 3,
    displayName: 'Vein Cut',
    description: '10 occult, 1 Rot. Primes BLOOD. Sets Clean Cycle for a later Null Arc.',
    tooltip: '10 occult, 1 Rot. Primes BLOOD. Sets Clean Cycle for a later Null Arc.',
    combatLogTemplate: '[SCYTHE] >> Vein Cut — blood catalyst.',
    apCost: 1,
    staminaCost: 8,
    fluxCost: 10,
    fluxGain: 0,
    hasHpSacrifice: false,
    targetMode: 'SINGLE',
    damageChannel: 'OCCULT',
    baseDamage: 10,
    rotApply: 1,
    rotTransferMax: 0,
    rotConsumeMax: 0,
    wardStrip: 0,
    catalystPrime: 'BLOOD',
    cleanCycleEligible: false,
    brinkEligible: false,
    curseTags: [],
    boonTags: ['OCCULT', 'FLUX', 'RESTORE'],
    graftTags: ['OCCULT', 'FLUX', 'RESTORE'],
    executorDispatch: 'ENVOY_WA_EXECUTOR',
    ultimateChargeEligibility: 'ROT_BOARD_CONTRIBUTION',
    executorUnavailable: false,
  }),
  SMOKE_ARC: def({
    id: 'SMOKE_ARC',
    familyId: 'envoy-null-conduit',
    order: 4,
    displayName: 'Smoke Arc',
    description: '8 occult, +5 Flux on hit, −10% enemy accuracy. Primes ASH. No Veil Rot.',
    tooltip: '8 occult, +5 Flux on hit, −10% enemy accuracy. Primes ASH. No Veil Rot.',
    combatLogTemplate: '[SCYTHE] >> Smoke Arc — ash veil.',
    apCost: 1,
    staminaCost: 8,
    fluxCost: 10,
    fluxGain: 5,
    hasHpSacrifice: false,
    targetMode: 'SINGLE',
    damageChannel: 'OCCULT',
    baseDamage: 8,
    rotApply: 0,
    rotTransferMax: 0,
    rotConsumeMax: 0,
    wardStrip: 0,
    catalystPrime: 'ASH',
    cleanCycleEligible: false,
    brinkEligible: false,
    curseTags: ['ACCURACY_DOWN'],
    boonTags: ['OCCULT', 'FLUX', 'ASH'],
    graftTags: ['OCCULT', 'FLUX', 'ASH'],
    executorDispatch: 'ENVOY_WA_EXECUTOR',
    ultimateChargeEligibility: 'NONE',
    executorUnavailable: false,
  }),
  BLOOD_REFRACTION: def({
    id: 'BLOOD_REFRACTION',
    familyId: 'envoy-sanguine-prism',
    order: 1,
    displayName: 'Blood Refraction',
    description: 'Pay capped HP for occult spike. Brink at Flux ≤25. Full pay required for sacrifice multiplier.',
    tooltip: 'Pay capped HP for occult spike. Brink at Flux ≤25. Full pay required for sacrifice multiplier.',
    combatLogTemplate: "[HEART'S DUE] >> Blood Refraction.",
    apCost: 1,
    staminaCost: 6,
    fluxCost: 5,
    fluxGain: 0,
    hasHpSacrifice: true,
    targetMode: 'SINGLE',
    damageChannel: 'OCCULT',
    baseDamage: 12,
    rotApply: 1,
    rotTransferMax: 0,
    rotConsumeMax: 0,
    wardStrip: 1,
    catalystPrime: 'NULL',
    cleanCycleEligible: false,
    brinkEligible: true,
    curseTags: [],
    boonTags: ['OCCULT', 'SACRIFICE', 'HIGH_RISK', 'FLUX', 'WEAPON_BASIC'],
    graftTags: ['OCCULT', 'SACRIFICE', 'HIGH_RISK', 'FLUX', 'WEAPON_BASIC'],
    executorDispatch: 'LIVE_ANCHOR_BASIC',
    ultimateChargeEligibility: 'ROT_BOARD_CONTRIBUTION',
    executorUnavailable: false,
  }),
  EXPOSE_VEIN: def({
    id: 'EXPOSE_VEIN',
    familyId: 'envoy-sanguine-prism',
    order: 2,
    displayName: 'Expose Vein',
    description: 'Mark the target Exposed. 9 occult, 1 Rot, 1 Ward strip. Brink amp if Flux ≤25. No HP sacrifice. Primes BLOOD.',
    tooltip: 'Mark the target Exposed. 9 occult, 1 Rot, 1 Ward strip. Brink amp if Flux ≤25. No HP sacrifice. Primes BLOOD.',
    combatLogTemplate: "[HEART'S DUE] >> Expose Vein — blood marked.",
    apCost: 1,
    staminaCost: 8,
    fluxCost: 12,
    fluxGain: 0,
    hasHpSacrifice: false,
    targetMode: 'SINGLE',
    damageChannel: 'OCCULT',
    baseDamage: 9,
    rotApply: 1,
    rotTransferMax: 0,
    rotConsumeMax: 0,
    wardStrip: 1,
    catalystPrime: 'BLOOD',
    cleanCycleEligible: false,
    brinkEligible: true,
    curseTags: [],
    boonTags: ['OCCULT', 'SACRIFICE', 'HIGH_RISK', 'FLUX'],
    graftTags: ['OCCULT', 'SACRIFICE', 'HIGH_RISK', 'FLUX'],
    executorDispatch: 'ENVOY_WA_EXECUTOR',
    ultimateChargeEligibility: 'ROT_BOARD_CONTRIBUTION',
    executorUnavailable: false,
  }),
  CRIMSON_VENT: def({
    id: 'CRIMSON_VENT',
    familyId: 'envoy-sanguine-prism',
    order: 3,
    displayName: 'Crimson Vent',
    description: 'Vent pressure: +15 Flux and a small self heal. Primes ASH. No damage.',
    tooltip: 'Vent pressure: +15 Flux and a small self heal. Primes ASH. No damage.',
    combatLogTemplate: "[HEART'S DUE] >> Crimson Vent — pressure bled off.",
    apCost: 1,
    staminaCost: 0,
    fluxCost: 0,
    fluxGain: 15,
    hasHpSacrifice: false,
    targetMode: 'NONE',
    damageChannel: 'NONE',
    baseDamage: 0,
    rotApply: 0,
    rotTransferMax: 0,
    rotConsumeMax: 0,
    wardStrip: 0,
    catalystPrime: 'ASH',
    cleanCycleEligible: false,
    brinkEligible: false,
    curseTags: [],
    boonTags: ['OCCULT', 'RESTORE', 'FLUX'],
    graftTags: ['OCCULT', 'RESTORE', 'FLUX'],
    executorDispatch: 'ENVOY_WA_EXECUTOR',
    ultimateChargeEligibility: 'NONE',
    executorUnavailable: false,
  }),
  HEART_CLAIM: def({
    id: 'HEART_CLAIM',
    familyId: 'envoy-sanguine-prism',
    order: 4,
    displayName: 'Heart Claim',
    description: 'Heavy occult claim. Pays capped HP once. Brink and full-pay mults apply. +10% if Expose Vein marked the target.',
    tooltip: 'Heavy occult claim. Pays capped HP once. Brink and full-pay mults apply. +10% if Expose Vein marked the target.',
    combatLogTemplate: "[HEART'S DUE] >> Heart Claim — due collected.",
    apCost: 2,
    staminaCost: 12,
    fluxCost: 18,
    fluxGain: 0,
    hasHpSacrifice: true,
    targetMode: 'SINGLE',
    damageChannel: 'OCCULT',
    baseDamage: 22,
    rotApply: 1,
    rotTransferMax: 0,
    rotConsumeMax: 0,
    wardStrip: 1,
    catalystPrime: 'BLOOD',
    cleanCycleEligible: false,
    brinkEligible: true,
    curseTags: [],
    boonTags: ['OCCULT', 'SACRIFICE', 'HIGH_RISK', 'FLUX_DUMP'],
    graftTags: ['OCCULT', 'SACRIFICE', 'HIGH_RISK', 'FLUX_DUMP'],
    executorDispatch: 'ENVOY_WA_EXECUTOR',
    ultimateChargeEligibility: 'ROT_BOARD_CONTRIBUTION',
    executorUnavailable: false,
  }),
};

Object.freeze(CATALOG);
for (const id of Object.keys(CATALOG) as EnvoyWeaponActionId[]) {
  Object.freeze(CATALOG[id]);
}

export function getEnvoyWeaponActionDefinition(
  id: string,
): EnvoyWeaponActionDefinition | null {
  if (!isEnvoyWeaponActionId(id)) return null;
  return CATALOG[id];
}

export function requireEnvoyWeaponActionDefinition(
  id: EnvoyWeaponActionId,
): EnvoyWeaponActionDefinition {
  const defn = CATALOG[id];
  if (!defn) {
    throw new Error(`[ENVOY E.3] Missing weapon-action catalog entry: ${id}`);
  }
  return defn;
}

export function listEnvoyWeaponActionDefinitions(): readonly EnvoyWeaponActionDefinition[] {
  return (Object.keys(CATALOG) as EnvoyWeaponActionId[]).map((id) => CATALOG[id]);
}

export function formatEnvoyWeaponActionLabel(id: string): string {
  const defn = getEnvoyWeaponActionDefinition(id);
  return defn?.label ?? `[ ${id.replace(/_/g, ' ')} ]`;
}

/** Structural preview gate — Actions 2–4 must not fabricate executable preview packets in E.3. */
export function isEnvoyWeaponActionPreviewLive(id: string): boolean {
  const defn = getEnvoyWeaponActionDefinition(id);
  return defn != null && !defn.executorUnavailable;
}
