/**
 * Phase 3H — recommended loadout mapping engine (read-only queries + validation).
 * No player-facing UI. No boon/graft weighting.
 */
import type { ClassType } from '../types/game';
import type { AegisAbilityId } from '../types/aegisCombat';
import type { EnvoyAbilityId, HexShotAbilityId } from '../types/operativeClass';
import type { WeaponFamilyId } from '../types/weapon';
import type {
  AbilityCoverageCategory,
  AbilityCoverageEntry,
  OperativeAbilityId,
  OrphanExplanation,
  WeaponLoadoutRecommendationProfile,
  WeaponSampleLoadout,
} from '../types/weaponLoadoutRecommendation';
import { ALL_WEAPON_FAMILY_IDS, getWeaponFamily } from './weaponRegistry';
import { AEGIS_ABILITY_CATALOG } from './aegisAbilities';
import { ENVOY_ABILITY_CATALOG } from './envoyAbilities';
import { HEX_SHOT_ABILITY_CATALOG } from './hexShotAbilities';
import { getAssignableAbilities } from './aegisAbilityUnlockEngine';
import {
  ENVOY_ANCHOR,
  ENVOY_INTRINSIC,
  getAssignableEnvoyAbilities,
  getAssignableHexShotAbilities,
  HEX_SHOT_ANCHOR,
  HEX_SHOT_DEPRECATED_ABILITIES,
  HEX_SHOT_INTRINSIC,
} from './classAbilityUnlockEngine';
import {
  validateEnvoyLoadoutCommit,
  validateHexShotLoadoutCommit,
} from '../utils/classLoadoutUtils';
import { AEGIS_ANCHOR, validateLoadoutCommit } from '../utils/aegisLoadoutUtils';
import {
  getWeaponLoadoutRecommendationProfile,
  listWeaponLoadoutRecommendationProfiles,
  WEAPON_LOADOUT_RECOMMENDATION_PROFILES,
} from './weaponLoadoutRecommendationProfiles';
import { isEnvoyProcUltimate, isHexShotProcUltimate } from './combatMasteryEngine';

export interface LoadoutRecommendationValidationIssue {
  severity: 'error' | 'warning';
  weaponId?: WeaponFamilyId;
  abilityId?: string;
  message: string;
}

function classOfAbility(abilityId: string): ClassType | null {
  if (abilityId in AEGIS_ABILITY_CATALOG) return 'AEGIS';
  if (abilityId in HEX_SHOT_ABILITY_CATALOG) return 'HEX_SHOT';
  if (abilityId in ENVOY_ABILITY_CATALOG) return 'ENVOY';
  return null;
}

function validateSlots(
  profile: WeaponLoadoutRecommendationProfile,
  slots: readonly OperativeAbilityId[],
  label: string,
): LoadoutRecommendationValidationIssue[] {
  const issues: LoadoutRecommendationValidationIssue[] = [];
  if (slots.length !== 4) {
    issues.push({
      severity: 'error',
      weaponId: profile.weaponFamilyId,
      message: `${label} must have exactly 4 slots.`,
    });
    return issues;
  }
  let rejection: string | null = null;
  if (profile.classId === 'AEGIS') {
    rejection = validateLoadoutCommit(slots as AegisAbilityId[]);
  } else if (profile.classId === 'HEX_SHOT') {
    rejection = validateHexShotLoadoutCommit(slots);
  } else {
    rejection = validateEnvoyLoadoutCommit(slots);
  }
  if (rejection) {
    issues.push({
      severity: 'error',
      weaponId: profile.weaponFamilyId,
      message: `${label} illegal: ${rejection}`,
    });
  }
  return issues;
}

function collectReferencedAbilityIds(
  profile: WeaponLoadoutRecommendationProfile,
): OperativeAbilityId[] {
  const ids = new Set<OperativeAbilityId>();
  profile.recommendations.forEach((r) => ids.add(r.abilityId));
  profile.antiSynergies.forEach((a) => ids.add(a.abilityId));
  profile.sampleLoadouts.forEach((s) => {
    s.slots.forEach((id) => ids.add(id));
    s.earlyAlternativeSlots?.forEach((id) => ids.add(id));
    s.abilityJobs.forEach((j) => ids.add(j.abilityId));
  });
  return [...ids];
}

/** Full Phase 3H validation gate. */
export function validateWeaponLoadoutRecommendations(): LoadoutRecommendationValidationIssue[] {
  const issues: LoadoutRecommendationValidationIssue[] = [];
  const profiles = listWeaponLoadoutRecommendationProfiles();

  if (profiles.length !== 9) {
    issues.push({
      severity: 'error',
      message: `Expected 9 recommendation profiles, found ${profiles.length}.`,
    });
  }

  ALL_WEAPON_FAMILY_IDS.forEach((id) => {
    if (!WEAPON_LOADOUT_RECOMMENDATION_PROFILES[id]) {
      issues.push({ severity: 'error', weaponId: id, message: 'Missing recommendation profile.' });
    }
  });

  const identityForwardByClass = new Map<ClassType, { weaponId: WeaponFamilyId; key: string }[]>();

  profiles.forEach((profile) => {
    const def = getWeaponFamily(profile.weaponFamilyId);
    if (def.classId !== profile.classId) {
      issues.push({
        severity: 'error',
        weaponId: profile.weaponFamilyId,
        message: `Profile classId ${profile.classId} != registry ${def.classId}.`,
      });
    }

    if (profile.sampleLoadouts.length !== 2) {
      issues.push({
        severity: 'error',
        weaponId: profile.weaponFamilyId,
        message: 'Each weapon needs exactly 2 sample loadouts.',
      });
    }

    const kinds = new Set(profile.sampleLoadouts.map((s) => s.kind));
    if (!kinds.has('IDENTITY_FORWARD') || !kinds.has('ALTERNATE_COVERAGE')) {
      issues.push({
        severity: 'error',
        weaponId: profile.weaponFamilyId,
        message: 'Samples must include IDENTITY_FORWARD and ALTERNATE_COVERAGE.',
      });
    }

    if (profile.antiSynergies.length < 3) {
      issues.push({
        severity: 'error',
        weaponId: profile.weaponFamilyId,
        message: 'Need ≥3 anti-synergies (meter / redundant / worsens).',
      });
    }
    const conflictKinds = new Set(profile.antiSynergies.map((a) => a.conflictKind));
    (['METER_COMPETITION', 'REDUNDANT_BASIC', 'WORSENS_WEAKNESS'] as const).forEach((k) => {
      if (!conflictKinds.has(k)) {
        issues.push({
          severity: 'error',
          weaponId: profile.weaponFamilyId,
          message: `Missing anti-synergy kind ${k}.`,
        });
      }
    });

    const hasClassMechanic = profile.recommendations.some((r) =>
      r.interactionHooks.some((h) =>
        [
          'RESERVE_FLOW',
          'RUNIC_BRAND',
          'RIFT_EDGE_TEMPO',
          'PARRY_EVADE_TEMPO',
          'FRACTURE_BREAK',
          'RELOAD_PROTOCOL',
          'PROTOCOL_CHARGE',
          'CLEAN_CATALYST_CYCLE',
          'FLUX_CYCLE',
          'ROT_SETUP',
          'ROT_DETONATION',
          'BRINK_FLUX',
          'HP_SACRIFICE',
          'WEAPON_BASIC',
        ].includes(h),
      ),
    );
    if (!hasClassMechanic) {
      issues.push({
        severity: 'error',
        weaponId: profile.weaponFamilyId,
        message: 'No recommendation tied to class/weapon mechanic.',
      });
    }

    collectReferencedAbilityIds(profile).forEach((abilityId) => {
      const cls = classOfAbility(abilityId);
      if (!cls) {
        issues.push({
          severity: 'error',
          weaponId: profile.weaponFamilyId,
          abilityId,
          message: `Unknown or retired ability ID: ${abilityId}`,
        });
        return;
      }
      if (cls !== profile.classId) {
        issues.push({
          severity: 'error',
          weaponId: profile.weaponFamilyId,
          abilityId,
          message: `Ability ${abilityId} is ${cls}, profile is ${profile.classId}.`,
        });
      }
      if (
        profile.classId === 'HEX_SHOT'
        && HEX_SHOT_DEPRECATED_ABILITIES.includes(abilityId as HexShotAbilityId)
      ) {
        issues.push({
          severity: 'error',
          weaponId: profile.weaponFamilyId,
          abilityId,
          message: `Deprecated Hex ability ${abilityId} cannot be recommended.`,
        });
      }
    });

    profile.sampleLoadouts.forEach((sample) => {
      issues.push(...validateSlots(profile, sample.slots, sample.kind));
      if (sample.earlyAlternativeSlots) {
        issues.push(
          ...validateSlots(profile, sample.earlyAlternativeSlots, `${sample.kind} earlyAlternative`),
        );
      }
      if (profile.classId === 'AEGIS' && sample.slots[0] !== AEGIS_ANCHOR) {
        issues.push({
          severity: 'error',
          weaponId: profile.weaponFamilyId,
          message: `${sample.kind} slot0 must be ${AEGIS_ANCHOR}.`,
        });
      }
      if (profile.classId === 'HEX_SHOT' && sample.slots[0] !== HEX_SHOT_ANCHOR) {
        issues.push({
          severity: 'error',
          weaponId: profile.weaponFamilyId,
          message: `${sample.kind} slot0 must be ${HEX_SHOT_ANCHOR}.`,
        });
      }
      if (profile.classId === 'ENVOY' && sample.slots[0] !== ENVOY_ANCHOR) {
        issues.push({
          severity: 'error',
          weaponId: profile.weaponFamilyId,
          message: `${sample.kind} slot0 must be ${ENVOY_ANCHOR}.`,
        });
      }
      sample.slots.forEach((id) => {
        if (isHexShotProcUltimate(id) || isEnvoyProcUltimate(id) || id === 'EVISCERATE' || id === 'WRAITH_PARRY') {
          issues.push({
            severity: 'error',
            weaponId: profile.weaponFamilyId,
            abilityId: id,
            message: `${sample.kind} includes non-selectable ultimate/intrinsic ${id}.`,
          });
        }
        if (HEX_SHOT_INTRINSIC.includes(id as HexShotAbilityId) && id !== HEX_SHOT_ANCHOR) {
          issues.push({
            severity: 'error',
            weaponId: profile.weaponFamilyId,
            abilityId: id,
            message: `${sample.kind} includes Hex intrinsic ${id}.`,
          });
        }
        if (ENVOY_INTRINSIC.includes(id as EnvoyAbilityId)) {
          issues.push({
            severity: 'error',
            weaponId: profile.weaponFamilyId,
            abilityId: id,
            message: `${sample.kind} includes Envoy intrinsic ${id}.`,
          });
        }
      });
    });

    const identity = profile.sampleLoadouts.find((s) => s.kind === 'IDENTITY_FORWARD');
    if (identity) {
      const key = identity.slots.join('|');
      const list = identityForwardByClass.get(profile.classId) ?? [];
      list.push({ weaponId: profile.weaponFamilyId, key });
      identityForwardByClass.set(profile.classId, list);
    }
  });

  identityForwardByClass.forEach((entries, classId) => {
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const a = entries[i]!;
        const b = entries[j]!;
        if (a.key === b.key) {
          issues.push({
            severity: 'error',
            message: `${classId} sibling identity-forward loadouts identical: ${a.weaponId} vs ${b.weaponId}.`,
          });
          continue;
        }
        const slotsA = a.key.split('|');
        const slotsB = b.key.split('|');
        const flexA = slotsA.slice(1);
        const flexB = slotsB.slice(1);
        const setA = new Set(flexA);
        const setB = new Set(flexB);
        const uniqueDiff = [...setA].filter((id) => !setB.has(id)).length
          + [...setB].filter((id) => !setA.has(id)).length;
        if (uniqueDiff < 2) {
          issues.push({
            severity: 'error',
            message: `${classId} identity-forward overlap too high (<2 differing abilities): ${a.weaponId} vs ${b.weaponId}.`,
          });
        }
      }
    }
  });

  return issues;
}

export function queryWeaponLoadoutRecommendations(
  weaponFamilyId: WeaponFamilyId,
): WeaponLoadoutRecommendationProfile {
  return getWeaponLoadoutRecommendationProfile(weaponFamilyId);
}

export function formatWeaponLoadoutRecommendationDebug(weaponFamilyId: WeaponFamilyId): string {
  const p = getWeaponLoadoutRecommendationProfile(weaponFamilyId);
  const lines = [
    `weapon=${p.weaponFamilyId}`,
    `class=${p.classId}`,
    `state=${p.validationState}`,
    `identity=${p.identitySummary}`,
    `recs=${p.recommendations.map((r) => `${r.abilityId}:${r.role}`).join(',')}`,
    `anti=${p.antiSynergies.map((a) => `${a.abilityId}:${a.conflictKind}`).join(',')}`,
    ...p.sampleLoadouts.map(
      (s) => `sample[${s.kind}]=${s.slots.join('>')}`
        + (s.earlyAlternativeSlots ? ` early=${s.earlyAlternativeSlots.join('>')}` : ''),
    ),
    ...p.recommendations.map(
      (r) => `why[${r.abilityId}]=${r.playerFacingReason} // hooks=${r.interactionHooks.join('+')}`,
    ),
    ...p.antiSynergies.map(
      (a) => `antiWhy[${a.abilityId}]=${a.playerFacingReason}`,
    ),
  ];
  return lines.join('\n');
}

function structuralKindFor(classId: ClassType, abilityId: string): import('../types/weaponLoadoutRecommendation').AbilityStructuralKind {
  if (classId === 'AEGIS') {
    if (abilityId === AEGIS_ANCHOR) return 'FIXED_WEAPON_BASIC';
    if (abilityId === 'EVISCERATE') return 'ULTIMATE';
    if (abilityId === 'WRAITH_PARRY') return 'INTRINSIC';
    return 'LIVE_SELECTABLE_FLEX';
  }
  if (classId === 'HEX_SHOT') {
    if (HEX_SHOT_DEPRECATED_ABILITIES.includes(abilityId as HexShotAbilityId)) return 'DEPRECATED_RETIRED';
    if (abilityId === HEX_SHOT_ANCHOR) return 'FIXED_WEAPON_BASIC';
    if (isHexShotProcUltimate(abilityId)) return 'ULTIMATE';
    if (HEX_SHOT_INTRINSIC.includes(abilityId as HexShotAbilityId)) return 'INTRINSIC';
    return 'LIVE_SELECTABLE_FLEX';
  }
  if (abilityId === ENVOY_ANCHOR) return 'FIXED_WEAPON_BASIC';
  if (isEnvoyProcUltimate(abilityId)) return 'ULTIMATE';
  if (ENVOY_INTRINSIC.includes(abilityId as EnvoyAbilityId)) return 'INTRINSIC';
  return 'LIVE_SELECTABLE_FLEX';
}

/** Coverage for every live catalog ability with separated structural groups. */
export function buildAbilityCoverageReport(): AbilityCoverageEntry[] {
  const entries: AbilityCoverageEntry[] = [];
  const mentioned = new Map<string, {
    categories: Set<AbilityCoverageCategory>;
    weapons: Set<WeaponFamilyId>;
  }>();

  const touch = (
    abilityId: OperativeAbilityId,
    category: AbilityCoverageCategory,
    weaponId?: WeaponFamilyId,
  ) => {
    const cur = mentioned.get(abilityId) ?? { categories: new Set(), weapons: new Set() };
    cur.categories.add(category);
    if (weaponId) cur.weapons.add(weaponId);
    mentioned.set(abilityId, cur);
  };

  listWeaponLoadoutRecommendationProfiles().forEach((profile) => {
    profile.recommendations.forEach((r) => {
      if (r.role === 'IDENTITY_ANCHOR') touch(r.abilityId, 'IDENTITY_ANCHOR', profile.weaponFamilyId);
      else if (r.role === 'CONDITIONAL' || r.role === 'MATCHUP_COVERAGE') {
        touch(r.abilityId, 'CONDITIONAL_MATCHUP', profile.weaponFamilyId);
      } else if (r.role === 'DEFENSIVE_FLEX') {
        touch(r.abilityId, 'FLEX_UNIVERSAL', profile.weaponFamilyId);
      } else {
        touch(r.abilityId, 'SUPPORTING', profile.weaponFamilyId);
      }
    });
    profile.antiSynergies.forEach((a) => touch(a.abilityId, 'ANTI_SYNERGY', profile.weaponFamilyId));
  });

  const pushClass = (classId: ClassType, ids: readonly string[]) => {
    ids.forEach((abilityId) => {
      const kind = structuralKindFor(classId, abilityId);
      const meta = mentioned.get(abilityId);
      const cats = new Set<AbilityCoverageCategory>(meta ? [...meta.categories] : []);
      if (kind === 'FIXED_WEAPON_BASIC') cats.add('FIXED_WEAPON_BASIC');
      if (kind === 'ULTIMATE') cats.add('ULTIMATE');
      if (kind === 'INTRINSIC') cats.add('INTRINSIC');
      if (kind === 'DEPRECATED_RETIRED') cats.add('DEPRECATED_RETIRED');

      let unmappedExplanation: import('../types/weaponLoadoutRecommendation').OrphanExplanation | undefined;
      let notes = '';
      if (kind === 'LIVE_SELECTABLE_FLEX' && (!meta || meta.categories.size === 0)) {
        cats.add('INTENTIONALLY_UNMAPPED_SELECTABLE');
        unmappedExplanation = 'TOO_NICHE';
        notes = abilityId === 'ABYSSAL_FAULT'
          ? 'Intentionally unmapped selectable — niche grid-root control; tags still participate in Phase 3I eligibility when equipped.'
          : 'Intentionally unmapped selectable — niche for base weapon mapping.';
      } else if (kind === 'FIXED_WEAPON_BASIC') {
        notes = 'Fixed weapon basic (slot 0) — not a flex-selectable recommendation orphan.';
      } else if (kind === 'ULTIMATE') {
        notes = 'Mastery / ultimate — non-deck; not a recommendation orphan.';
      } else if (kind === 'INTRINSIC') {
        notes = 'Class intrinsic combat control — non-deck; not a recommendation orphan.';
      } else if (kind === 'DEPRECATED_RETIRED') {
        notes = 'Deprecated/retired ID — hidden from loadout selection; not a recommendation orphan.';
      } else {
        notes = 'Mapped in Phase 3H recommendations.';
      }

      entries.push({
        abilityId: abilityId as OperativeAbilityId,
        classId,
        structuralKind: kind,
        selectableFlex: kind === 'LIVE_SELECTABLE_FLEX',
        categories: [...cats],
        weaponIds: meta ? [...meta.weapons] : [],
        unmappedExplanation,
        notes,
      });
    });
  };

  pushClass('AEGIS', Object.keys(AEGIS_ABILITY_CATALOG));
  pushClass('HEX_SHOT', Object.keys(HEX_SHOT_ABILITY_CATALOG));
  pushClass('ENVOY', Object.keys(ENVOY_ABILITY_CATALOG));

  return entries.sort((a, b) => a.classId.localeCompare(b.classId) || a.abilityId.localeCompare(b.abilityId));
}

export function formatAbilityCoverageDebug(): string {
  return buildAbilityCoverageReport()
    .map((e) =>
      `${e.classId} ${e.abilityId} kind=${e.structuralKind} flex=${e.selectableFlex} cats=${e.categories.join('+')}`
      + (e.unmappedExplanation ? ` unmapped=${e.unmappedExplanation}` : '')
      + ` weapons=${e.weaponIds.join(',') || '—'} // ${e.notes}`,
    )
    .join('\n');
}

/** Live loadout rules snapshot for reports. */
export function describeLiveLoadoutRules(): string {
  return [
    'Slots: exactly 4 per class.',
    `Aegis: slot0 fixed ${AEGIS_ANCHOR} (weapon basic for all Aegis weapons); WRAITH_PARRY + EVISCERATE are combat intrinsics/ultimate (not deck slots); flex slots 1–3; duplicates illegal.`,
    `Hex: slot0 fixed ${HEX_SHOT_ANCHOR} (weapon basic for all Hex weapons); ZERO_PROTOCOL + PHASE_SHIFT_RELOAD intrinsic; deprecated ammo-identity abilities hidden; duplicates illegal in flex.`,
    `Envoy: slot0 fixed ${ENVOY_ANCHOR}; CATACLYSM_SIGIL + RIFT_WARD intrinsic; duplicates illegal in flex.`,
    'Unlocks: hub stash costs; starters seed default loadouts; invalid/retired IDs sanitized/migrated on load.',
    'Loadouts are hub/safehouse staged — not mid-combat editable; persisted on account/run extraction.',
    'Class restriction: abilities are per-class catalogs only.',
    'Weapon unlocks are stash-cost only (no class-rank gate).',
    'Every loadout permanently retains access to its equipped weapon Phase 3D unique basic via the fixed slot-0 basic.',
  ].join('\n');
}

export type { WeaponSampleLoadout };
