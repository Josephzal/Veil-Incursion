/**
 * Phase 3K — read-only matchup inspection.
 */
import type { MatchupInspectInput, MatchupInspectResult } from '../../types/weaponEnemyMatchup';
import { getWeaponFamily } from '../weaponRegistry';
import { getWeaponIdentityProfile } from '../weaponIdentityProfiles';
import { getWeaponDrawbackRecord } from '../weaponDrawbackEngine';
import { getWeaponLoadoutRecommendationProfile } from '../weaponLoadoutRecommendationProfiles';
import { getWeaponGraftRecommendationProfile } from '../graftSynergy/weaponGraftRecommendationProfiles';
import { buildLoadoutTagLayers } from '../boonOffer/boonOfferContext';
import { getWeaponEnemyMatchup } from './weaponEnemyMatchupEngine';
import { getWeaponSectorMatchup } from './weaponSectorMatchupEngine';
import { getEnemyDefinition } from '../enemyDefinitions';
import { getLiveEnemyAuditEntry } from './enemyRosterAudit';
import { sectorIdToVeilBiome } from '../sectorBiomeBridge';

export function inspectWeaponMatchup(input: MatchupInspectInput): MatchupInspectResult {
  const family = getWeaponFamily(input.weaponFamilyId);
  const identity = getWeaponIdentityProfile(input.weaponFamilyId);
  const drawback = getWeaponDrawbackRecord(input.weaponFamilyId);
  const loadoutProfile = getWeaponLoadoutRecommendationProfile(input.weaponFamilyId);
  const sample = loadoutProfile.sampleLoadouts.find((s) => s.kind === (input.loadoutKind ?? 'IDENTITY_FORWARD'))
    ?? loadoutProfile.sampleLoadouts[0];
  const equipped = (sample?.slots ?? []) as unknown as string[];

  const layers = buildLoadoutTagLayers({
    classId: family.classId,
    weaponFamilyId: input.weaponFamilyId,
    equippedAbilityIds: equipped,
    abilityGrafts: input.abilityGrafts,
  });

  const graftProfile = getWeaponGraftRecommendationProfile(input.weaponFamilyId);
  const unresolved: string[] = [];

  let matchupClassification = null as MatchupInspectResult['matchupClassification'];
  const reasons: string[] = [];
  let enemyLegality: string | null = null;
  let deckSource: string | null = null;

  if (input.enemyId) {
    const m = getWeaponEnemyMatchup(input.weaponFamilyId, input.enemyId);
    matchupClassification = m.classification;
    reasons.push(m.mechanicalReason);
    const audit = getLiveEnemyAuditEntry(input.enemyId);
    enemyLegality = audit
      ? `depths=${audit.allowedDepths.join(',')} biomes=${audit.allowedSectors.join(',')}`
      : 'unknown enemy';
    deckSource = audit?.encounterDeckMembership.slice(0, 3).join(', ') || (audit?.reachableViaDeck ? 'hints' : 'unreachable');
    if (!getEnemyDefinition(input.enemyId)) unresolved.push(`enemy ${input.enemyId}`);
  } else if (input.sectorId && input.depth) {
    const m = getWeaponSectorMatchup(input.weaponFamilyId, input.sectorId, input.depth);
    matchupClassification = m.classification;
    reasons.push(m.mechanicalReason);
    enemyLegality = `${sectorIdToVeilBiome(input.sectorId)} D${input.depth}`;
    deckSource = m.poolSummary;
  }

  if (input.abilityGrafts && Object.keys(input.abilityGrafts).length > 0) {
    reasons.push(`Active Sanctuary grafts: ${Object.entries(input.abilityGrafts).map(([a, g]) => `${a}=${g}`).join(', ')}`);
  }
  if (input.ownedBoonIds?.length) {
    reasons.push(`Acquired boons: ${input.ownedBoonIds.join(', ')}`);
  }

  return {
    weaponFamilyId: input.weaponFamilyId,
    baseProperties: [
      identity.liveDisplayName,
      identity.oneSentencePlaystyle,
      identity.uniqueBasicSummary,
    ],
    finalTransformedProperties: [
      `tags=${layers.finalTransformedTags.join('|')}`,
      `graftAdded=${layers.graftAddedTags.join('|') || 'none'}`,
      `graftRemoved=${layers.graftRemovedTags.join('|') || 'none'}`,
    ],
    finalTags: layers.finalTransformedTags,
    finalReachableEvents: layers.finalTransformedTags.filter((t) =>
      ['FRACTURE', 'ARMOR_PIERCE', 'AOE', 'SINGLE_TARGET', 'CLEAN_CYCLE'].includes(t)
    ),
    damageDefenseRouting: 'KINETIC→Armor, OCCULT→Wards, TRUE/pierce bypass; break→Fracture',
    resourceCadence: identity.meterSummary,
    classMeterRoute: identity.meterSummary,
    targetingBehavior: family.role,
    matchupClassification,
    classificationReasons: reasons,
    accessibleCompensationRoutes: [
      `3H ${sample?.kind ?? 'loadout'}`,
      `Sanctuary path: ${graftProfile.configurations[0].playerFacingSummary}`,
      `Expanded path: ${graftProfile.configurations[1].playerFacingSummary}`,
    ],
    phase3GDrawbackGuard: drawback.compensationMustNotErase,
    enemySectorDepthLegality: enemyLegality,
    encounterDeckSource: deckSource,
    unresolvedDependencies: unresolved,
  };
}
