/**
 * WU-6 — weapon ultimate validation + retired player-facing name audit.
 */
import type { WeaponValidationIssue } from '../types/weapon';
import { ALL_WEAPON_FAMILY_IDS, STARTER_WEAPON_BY_CLASS } from './weaponRegistry';
import { AEGIS_ABILITY_CATALOG } from './aegisAbilities';
import { HEX_SHOT_ABILITY_CATALOG } from './hexShotAbilities';
import { ENVOY_ABILITY_CATALOG } from './envoyAbilities';
import {
  assertWeaponUltimateNamesMatchRegistry,
  canFireLegacyClassUltimate,
  canFireWeaponUltimate,
  formatWeaponUltimateLabel,
  formatWeaponUltimateLogTag,
  getCanonicalWeaponUltimateDisplayName,
  getWeaponUltimate,
  listWeaponUltimates,
  RETIRED_CLASS_ULTIMATE_DISPLAY_NAMES,
  type WeaponUltimateId,
} from './weaponUltimateRegistry';
import {
  assertNoRetiredUltimatePlayerFacing,
  formatWeaponUltimateReadyCallout,
  listRetiredUltimatePlayerFacingStrings,
  resolveWeaponUltimateLegacyHookAbilityId,
  weaponUltimateActionHasUltimateTag,
} from './weaponUltimateSurfaceEngine';
import { getWu4StagedScript } from './weaponUltimateStagedScripts';
import { isWu4NewUltimateId, WU4_ULTIMATE_IDS } from './weaponUltimateNewResolveEngine';

const EXPECTED_ULTIMATE_BY_FAMILY: Record<string, WeaponUltimateId> = {
  'aegis-runed-longsword': 'THREEFOLD_BRAND',
  'aegis-rift-edge': 'REND_THE_VEIL',
  'aegis-claymore-blade': 'GRAVEFALL',
  'hex-silver-core-sidearm': 'SIXTH_SEAL',
  'hex-pulse-rifle': 'ZERO_PROTOCOL',
  'hex-void-cannon': 'LAST_KNOCK',
  'envoy-echo-lantern': 'FUNERAL_KNOT',
  'envoy-null-conduit': 'NULL_CIRCUIT',
  'envoy-sanguine-prism': 'CRIMSON_REFRACTION',
};

const EXPECTED_DISPLAY: Record<WeaponUltimateId, string> = {
  THREEFOLD_BRAND: 'ABYSSAL VERDICT',
  REND_THE_VEIL: 'REND THE VEIL',
  GRAVEFALL: 'GRAVEFALL',
  SIXTH_SEAL: 'SIXTH SEAL',
  ZERO_PROTOCOL: 'ZERO PROTOCOL',
  LAST_KNOCK: 'LAST KNOCK',
  FUNERAL_KNOT: 'FUNERAL KNOT',
  NULL_CIRCUIT: 'NULL CIRCUIT',
  CRIMSON_REFRACTION: 'CRIMSON REFRACTION',
};

function pushIssues(
  issues: WeaponValidationIssue[],
  messages: readonly string[],
  severity: WeaponValidationIssue['severity'] = 'error',
  weaponId?: string,
): void {
  for (const message of messages) {
    issues.push({ severity, weaponId, message: `Weapon ultimate: ${message}` });
  }
}

/** Scan player-facing catalog labels/descriptions for retired ultimate titles. */
export function auditWeaponUltimatePlayerFacingCatalogs(): string[] {
  const issues: string[] = [];
  const retired = [
    ...RETIRED_CLASS_ULTIMATE_DISPLAY_NAMES,
    ...listRetiredUltimatePlayerFacingStrings(),
  ];
  const uniqueRetired = [...new Set(retired)];

  const catalogSurfaces: Array<{ source: string; text: string }> = [
    {
      source: 'AEGIS EVISCERATE.label',
      text: AEGIS_ABILITY_CATALOG.EVISCERATE.label,
    },
    {
      source: 'AEGIS EVISCERATE.description',
      text: AEGIS_ABILITY_CATALOG.EVISCERATE.description,
    },
    {
      source: 'HEX ZERO_PROTOCOL.label',
      text: HEX_SHOT_ABILITY_CATALOG.ZERO_PROTOCOL.label,
    },
    {
      source: 'HEX ZERO_PROTOCOL.description',
      text: HEX_SHOT_ABILITY_CATALOG.ZERO_PROTOCOL.description,
    },
    {
      source: 'ENVOY CATACLYSM_SIGIL.label',
      text: ENVOY_ABILITY_CATALOG.CATACLYSM_SIGIL.label,
    },
    {
      source: 'ENVOY CATACLYSM_SIGIL.description',
      text: ENVOY_ABILITY_CATALOG.CATACLYSM_SIGIL.description,
    },
  ];

  for (const surface of catalogSurfaces) {
    for (const token of uniqueRetired) {
      // Ability IDs may appear in code comments only — block display forms.
      if (surface.text.includes(token)) {
        issues.push(`${surface.source} still emits retired "${token}"`);
      }
    }
    // Labels must never be the raw legacy ability id as the visible title.
    if (/\bEVISCERATE\b/.test(surface.text) && surface.source.includes('label')) {
      issues.push(`${surface.source} still shows EVISCERATE as live label`);
    }
    if (/CATACLYSM/.test(surface.text) && surface.source.includes('label')) {
      issues.push(`${surface.source} still shows CATACLYSM in live label`);
    }
    if (/ZERO-PROTOCOL/.test(surface.text)) {
      issues.push(`${surface.source} still shows ZERO-PROTOCOL hyphen form`);
    }
  }

  for (const familyId of ALL_WEAPON_FAMILY_IDS) {
    issues.push(...assertNoRetiredUltimatePlayerFacing(formatWeaponUltimateLabel(familyId)));
    issues.push(...assertNoRetiredUltimatePlayerFacing(formatWeaponUltimateLogTag(familyId)));
    issues.push(...assertNoRetiredUltimatePlayerFacing(getCanonicalWeaponUltimateDisplayName(familyId)));
    const callout = formatWeaponUltimateReadyCallout(familyId);
    if (callout) issues.push(...assertNoRetiredUltimatePlayerFacing(callout));
  }

  return issues;
}

export function validateWeaponUltimates(): WeaponValidationIssue[] {
  const issues: WeaponValidationIssue[] = [];

  pushIssues(issues, assertWeaponUltimateNamesMatchRegistry());

  const ultimates = listWeaponUltimates();
  if (ultimates.length !== 9) {
    pushIssues(issues, [`Expected 9 weapon ultimates, found ${ultimates.length}`]);
  }
  if (new Set(ultimates.map((u) => u.id)).size !== 9) {
    pushIssues(issues, ['Weapon ultimate IDs must be unique']);
  }

  const wired = ultimates.filter((u) => u.status === 'WIRED' || u.status === 'LIVE');
  if (wired.length !== 9) {
    pushIssues(issues, [`Expected all 9 ultimates WIRED/LIVE, found ${wired.length}`]);
  }

  for (const familyId of ALL_WEAPON_FAMILY_IDS) {
    const ultimate = getWeaponUltimate(familyId);
    const expectedId = EXPECTED_ULTIMATE_BY_FAMILY[familyId];
    if (ultimate.id !== expectedId) {
      pushIssues(issues, [`${familyId} ultimate id ${ultimate.id} ≠ ${expectedId}`], 'error', familyId);
    }
    if (ultimate.displayName !== EXPECTED_DISPLAY[ultimate.id]) {
      pushIssues(
        issues,
        [`${familyId} displayName "${ultimate.displayName}" ≠ "${EXPECTED_DISPLAY[ultimate.id]}"`],
        'error',
        familyId,
      );
    }
    if (!canFireWeaponUltimate(familyId)) {
      pushIssues(issues, [`${familyId} canFireWeaponUltimate failed`], 'error', familyId);
    }
    const hook = resolveWeaponUltimateLegacyHookAbilityId(familyId);
    if (!hook || !weaponUltimateActionHasUltimateTag(hook, ultimate.classId)) {
      pushIssues(issues, [`${familyId} legacy hook missing ULTIMATE tag`], 'error', familyId);
    }
  }

  // Ownership gates — rebound legacy ultimates stay weapon-bound.
  if (canFireLegacyClassUltimate('EVISCERATE', 'aegis-rift-edge')) {
    pushIssues(issues, ['Paired Blades must not fire legacy EVISCERATE']);
  }
  if (canFireLegacyClassUltimate('ZERO_PROTOCOL', 'hex-void-cannon')) {
    pushIssues(issues, ['Black Door must not fire legacy ZERO_PROTOCOL']);
  }
  if (canFireLegacyClassUltimate('CATACLYSM_SIGIL', 'envoy-echo-lantern')) {
    pushIssues(issues, ['Vambrace must not fire legacy CATACLYSM_SIGIL']);
  }
  if (!canFireLegacyClassUltimate('EVISCERATE', 'aegis-runed-longsword')) {
    pushIssues(issues, ['Longsword must own ABYSSAL VERDICT (THREEFOLD_BRAND / EVISCERATE) hook']);
  }
  if (!canFireLegacyClassUltimate('ZERO_PROTOCOL', 'hex-pulse-rifle')) {
    pushIssues(issues, ['Carbine must own ZERO PROTOCOL']);
  }
  if (!canFireLegacyClassUltimate('CATACLYSM_SIGIL', 'envoy-null-conduit')) {
    pushIssues(issues, ['Scythe must own NULL CIRCUIT']);
  }

  for (const id of WU4_ULTIMATE_IDS) {
    if (!isWu4NewUltimateId(id)) {
      pushIssues(issues, [`WU4 id ${id} failed isWu4NewUltimateId`]);
    }
    if (!getWu4StagedScript(id)) {
      pushIssues(issues, [`WU4 ultimate ${id} missing staged script`]);
    }
  }

  // Envoy starter owns Funeral Knot, not Null Circuit.
  if (STARTER_WEAPON_BY_CLASS.ENVOY !== 'envoy-echo-lantern') {
    pushIssues(issues, ['Envoy starter must be Vambrace (envoy-echo-lantern)']);
  }
  if (getWeaponUltimate(STARTER_WEAPON_BY_CLASS.ENVOY).id !== 'FUNERAL_KNOT') {
    pushIssues(issues, ['Envoy starter ultimate must be FUNERAL_KNOT']);
  }

  pushIssues(issues, auditWeaponUltimatePlayerFacingCatalogs());

  // Last Knock must never be titled The Black Door.
  if (formatWeaponUltimateLabel('hex-void-cannon').includes('The Black Door')) {
    pushIssues(issues, ['Last Knock label must not include "The Black Door"'], 'error', 'hex-void-cannon');
  }

  return issues;
}

export function formatWeaponUltimateValidationReport(
  issues: readonly WeaponValidationIssue[] = validateWeaponUltimates(),
): string {
  if (issues.length === 0) {
    return 'WEAPON ULTIMATE VALIDATION — PASS (9 WIRED, retired-name audit clean).';
  }
  const lines = issues.map((issue) => {
    const prefix = issue.severity === 'error' ? 'ERR' : 'WRN';
    const id = issue.weaponId ? `[${issue.weaponId}] ` : '';
    return `${prefix} ${id}${issue.message}`;
  });
  return ['WEAPON ULTIMATE VALIDATION REPORT', ...lines].join('\n');
}
