/**
 * Player-facing Sanctuary recommendations derived from the live weapon-action
 * registries. Universal grafts improve one numeric axis and never alter tags,
 * events, targeting, or action identity.
 */
import type { ClassType } from '../../types/game';
import type { WeaponFamilyId } from '../../types/weapon';
import type {
  WeaponGraftApplication,
  WeaponGraftConfiguration,
  WeaponGraftRecommendationProfile,
} from '../../types/weaponGraftRecommendation';
import { deriveAegisWeaponActions } from '../aegisWeaponActionRegistry';
import { deriveEnvoyWeaponActions } from '../envoyWeaponActionRegistry';
import { deriveHexWeaponActions } from '../hexWeaponActionRegistry';
import { getUniversalGraftForAction } from '../universalGraftRegistry';
import { getWeaponIdentityProfile } from '../weaponIdentityProfiles';
import { ALL_WEAPON_FAMILY_IDS, getWeaponFamily } from '../weaponRegistry';
import { getWeaponLoadoutRecommendationProfile } from '../weaponLoadoutRecommendationProfiles';

const NEUTRAL_LEGACY_RANK = 0;

function canonicalActionId(actionId: string): string {
  if (actionId.startsWith('WA:')) return actionId.slice(3);
  if (actionId.startsWith('TECH:')) return actionId.slice(5);
  return actionId;
}

function canonicalActions(
  familyId: WeaponFamilyId,
  classId: ClassType,
): readonly string[] {
  if (classId === 'AEGIS') return deriveAegisWeaponActions(familyId) ?? [];
  if (classId === 'HEX_SHOT') return deriveHexWeaponActions(familyId) ?? [];
  return deriveEnvoyWeaponActions(familyId) ?? [];
}

function application(
  familyId: WeaponFamilyId,
  classId: ClassType,
  actionId: string,
  index: number,
): WeaponGraftApplication {
  const graft = getUniversalGraftForAction(classId, actionId);
  if (!graft) {
    throw new Error(`Missing universal upgrade for ${classId}:${actionId}`);
  }
  const sample = getWeaponLoadoutRecommendationProfile(familyId);
  const actionName = graft.name;
  return {
    weaponFamilyId: familyId,
    abilityId: classId === 'AEGIS' ? `WA:${actionId}` : actionId,
    graftId: graft.id,
    role: index === 0 ? 'IDENTITY_ANCHOR' : 'ALTERNATE_EXPRESSION',
    exactRuntimeInteraction: `${actionName} improves ${graft.previewCopy}`,
    tagsAdded: [],
    tagsRemoved: [],
    tagsReplaced: [],
    eventsAdded: [],
    eventsRemoved: [],
    meterEffect: 'Unchanged',
    resourceEffect: graft.upgradeAxis.includes('COST') || graft.upgradeAxis.includes('GAIN')
      ? graft.previewCopy
      : 'Unchanged',
    targetingEffect: 'Unchanged',
    meaningfulUpside: graft.previewCopy,
    meaningfulDownside: 'No tag, event, targeting, or action transformation',
    phase3GDrawbackGuard: 'Weapon identity and authored drawbacks remain unchanged',
    requiredClassRank: NEUTRAL_LEGACY_RANK,
    availableWhenWeaponUnlocks: true,
    abilityInPhase3HSample: sample.sampleLoadouts.some((loadout) =>
      (loadout.slots as readonly string[]).includes(actionId)),
    validationState: 'VALIDATED',
    playerFacingReason: `${actionName}: ${graft.previewCopy}`,
  };
}

function configuration(
  kind: WeaponGraftConfiguration['kind'],
  applications: readonly WeaponGraftApplication[],
): WeaponGraftConfiguration {
  const selected = kind === 'EARLY_IDENTITY' ? applications.slice(0, 1) : applications.slice(0, 2);
  return {
    kind,
    label: selected.map((entry) => getUniversalGraftForAction(
      getWeaponFamily(entry.weaponFamilyId).classId,
      canonicalActionId(entry.abilityId),
    )?.name ?? entry.abilityId).join(' + '),
    requiredClassRank: NEUTRAL_LEGACY_RANK,
    loadoutRef: kind === 'EARLY_IDENTITY' ? 'IDENTITY_FORWARD' : 'ALTERNATE_COVERAGE',
    assignments: selected.map((entry) => ({
      abilityId: entry.abilityId,
      graftId: entry.graftId,
      job: entry.playerFacingReason,
      tradeoff: 'None; tags and events remain unchanged',
    })),
    preservesDrawback: 'The weapon action, tags, events, and targeting remain unchanged',
    playerFacingSummary: selected.map((entry) =>
      getUniversalGraftForAction(
        getWeaponFamily(entry.weaponFamilyId).classId,
        canonicalActionId(entry.abilityId),
      )?.name ?? entry.abilityId).join(' + '),
  };
}

function buildProfile(familyId: WeaponFamilyId): WeaponGraftRecommendationProfile {
  const classId = getWeaponFamily(familyId).classId;
  const actions = canonicalActions(familyId, classId).slice(0, 2);
  if (actions.length === 0) {
    throw new Error(`No live weapon actions registered for ${familyId}`);
  }
  const applications = actions.map((actionId, index) =>
    application(familyId, classId, actionId, index));
  return {
    weaponFamilyId: familyId,
    classId,
    validationState: 'VALIDATED',
    identitySummary: getWeaponIdentityProfile(familyId).oneSentencePlaystyle,
    applications,
    antiSynergies: [],
    configurations: [
      configuration('EARLY_IDENTITY', applications),
      configuration('MATURE_ALTERNATE', applications),
    ],
    unresolvedGaps: [],
  };
}

const PROFILES = Object.freeze(Object.fromEntries(
  ALL_WEAPON_FAMILY_IDS.map((familyId) => [familyId, buildProfile(familyId)]),
)) as Readonly<Record<WeaponFamilyId, WeaponGraftRecommendationProfile>>;

export function getWeaponGraftRecommendationProfile(
  id: WeaponFamilyId,
): WeaponGraftRecommendationProfile {
  return PROFILES[id];
}

export function listWeaponGraftRecommendationProfiles(): WeaponGraftRecommendationProfile[] {
  return ALL_WEAPON_FAMILY_IDS.map((id) => PROFILES[id]);
}

export function validateWeaponGraftRecommendationProfiles(): string[] {
  const issues: string[] = [];
  for (const familyId of ALL_WEAPON_FAMILY_IDS) {
    const profile = PROFILES[familyId];
    if (!profile) {
      issues.push(`Missing graft recommendation profile ${familyId}`);
      continue;
    }
    if (profile.classId !== getWeaponFamily(familyId).classId) {
      issues.push(`${familyId} class mismatch`);
    }
    if (profile.applications.length < 1 || profile.applications.length > 2) {
      issues.push(`${familyId} must recommend one or two canonical weapon actions`);
    }
    for (const entry of profile.applications) {
      const graft = getUniversalGraftForAction(
        profile.classId,
        canonicalActionId(entry.abilityId),
      );
      if (!graft || graft.id !== entry.graftId) {
        issues.push(`${familyId}:${entry.abilityId} is not registry-derived`);
      }
      if (
        entry.tagsAdded.length
        || entry.tagsRemoved.length
        || entry.tagsReplaced.length
        || entry.eventsAdded.length
        || entry.eventsRemoved.length
      ) {
        issues.push(`${familyId}:${entry.abilityId} changes tags or events`);
      }
    }
  }
  return issues;
}
