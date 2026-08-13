/**
 * Phase 3L — canonical player-facing weapon summaries (copy + presentation).
 * Derived from live registry + approved 3G–3K data. Zero runtime combat effect.
 */
import type { WeaponFamilyId } from '../../types/weapon';
import type {
  WeaponFirstUseBrief,
  WeaponPlayerFacingSummary,
  WeaponStrengthOrPressure,
} from '../../types/weaponPlayerFacing';
import { getWeaponFamily, STARTER_WEAPON_BY_CLASS } from '../weaponRegistry';
import { getWeaponIdentityProfile } from '../weaponIdentityProfiles';
import { WEAPON_DRAWBACK_RECORDS } from '../weaponDrawbackEngine';
import { getWeaponLoadoutRecommendationProfile } from '../weaponLoadoutRecommendationProfiles';
import { getWeaponGraftRecommendationProfile } from '../graftSynergy/weaponGraftRecommendationProfiles';
import { getResourceDisplayName } from '../resourceRegistry';
import type { OperativeAbilityId } from '../../types/weaponLoadoutRecommendation';

function strength(
  phrase: string,
  mechanicalSource: string,
  reason?: string,
): WeaponStrengthOrPressure {
  return { phrase, mechanicalSource, reason };
}

function brief(partial: WeaponFirstUseBrief): WeaponFirstUseBrief {
  return partial;
}

const ROLE: Record<WeaponFamilyId, string> = {
  'aegis-longsword': 'Balanced Fracture Setup',
  'aegis-paired-blades': 'Tempo Execution Blade',
  'aegis-claymore': 'Heavy Break Cashout',
  'hex-revolver': 'Precision Reload Tempo',
  'hex-shotgun': 'Armor Breach Burst',
  'hex-carbine': 'Cluster Spread Clear',
  'envoy-scythe': 'Clean Flux Cycle',
  'envoy-vambrace': 'Rot Detonation Setup',
  'envoy-sanguine-prism': 'Brink Sacrifice Spike',
};

const LOOP_CUE: Record<WeaponFamilyId, string> = {
  'aegis-longsword': 'FRACTURE',
  'aegis-paired-blades': 'EVADE',
  'aegis-claymore': 'BREAK',
  'hex-revolver': 'RELOAD',
  'hex-shotgun': 'PRIORITY TARGET',
  'hex-carbine': 'SPREAD',
  'envoy-scythe': 'CLEAN CYCLE',
  'envoy-vambrace': 'ROT',
  'envoy-sanguine-prism': 'BRINK',
};

const BUILD_TAGS: Record<WeaponFamilyId, readonly string[]> = {
  'aegis-longsword': ['Fracture', 'Parry', 'Reserve', 'Melee'],
  'aegis-paired-blades': ['Evade', 'Parry', 'Execution', 'Occult'],
  'aegis-claymore': ['Fracture', 'Break', 'Reserve', 'Control'],
  'hex-revolver': ['Reload', 'Perfect Reload', 'Protocol', 'Execution'],
  'hex-shotgun': ['Priority Target', 'Armor Pierce', 'Reload', 'High Risk'],
  'hex-carbine': ['Spread', 'Reload', 'Fracture', 'Ballistic'],
  'envoy-scythe': ['Clean Cycle', 'Catalyst', 'Flux', 'Occult'],
  'envoy-vambrace': ['Rot', 'Detonation', 'Curse', 'Flux'],
  'envoy-sanguine-prism': ['Brink', 'Sacrifice', 'Flux', 'High Risk'],
};

const STRENGTHS: Record<WeaponFamilyId, readonly [WeaponStrengthOrPressure, WeaponStrengthOrPressure, ...WeaponStrengthOrPressure[]]> = {
  'aegis-longsword': [
    strength('Steady Fracture setup', 'identity.uniqueBasic', 'Reliable Kinetic basic without stamina tax'),
    strength('Parry / Reserve rhythm', 'identity.meter', 'Natural Abyssal Reserve on hits'),
    strength('Flexible mixed offense', 'identity.role', 'Complete starter — not a temporary beginner blade'),
  ],
  'aegis-paired-blades': [
    strength('Tempo-armed Occult rider', 'basic.riftEdgeTempo', 'Evade/Parry arms the finish'),
    strength('Fast Kinetic basic', 'identity.uniqueBasic', 'Keeps pressure while banking tempo'),
    strength('Execution windows', 'identity.affinity', 'Pays off when you earn the rider'),
  ],
  'aegis-claymore': [
    strength('Heavy Fracture pressure', 'identity.uniqueBasic', 'High Fracture commitment per swing'),
    strength('Break cashout Reserve', 'drawback.mechanicalEnforcement', 'Large Reserve only on Fracture-break'),
    strength('Committed frontline control', 'identity.role', 'Owns break windows, not chip fights'),
  ],
  'hex-revolver': [
    strength('Efficient precision shots', 'identity.uniqueBasic', '1 AP / 1 ammo inherits loaded payload'),
    strength('Reload → Protocol loop', 'identity.meter', 'Perfect Reload feeds Protocol / Zero Protocol'),
    strength('Flexible execute tempo', 'identity.role', 'Learning weapon that stays complete'),
  ],
  'hex-shotgun': [
    strength('Armor-breach ST burst', 'identity.uniqueBasic', 'Pierce pressure vs Kinetic Armor'),
    strength('Priority target deletion', 'identity.role', 'Spends scarce ammo to crack tanks'),
    strength('High-impact commitment', 'identity.meter', 'Each shot matters — reloads are deliberate'),
  ],
  'hex-carbine': [
    strength('Primary + adjacent spread', 'basic.spread', 'Cluster clear without Ash-Jacket Salvo'),
    strength('Reload as burst window', 'identity.playstyle', 'Empty mag is part of the loop'),
    strength('Crowd Fracture pressure', 'identity.affinity', 'Rewards packed frontlines'),
  ],
  'envoy-scythe': [
    strength('Clean Catalyst cycle', 'basic.cleanCatalystCycle', 'NULL/BLOOD → Splinter pays Flux + damage'),
    strength('Stable Flux cycling', 'identity.meter', 'Forgiving baseline without Brink gambling'),
    strength('Sequence discipline', 'identity.role', 'Rewards controlled Catalyst dumps'),
  ],
  'envoy-vambrace': [
    strength('Extra Rot on Splinter', 'identity.uniqueBasic', 'Stacks setup for board payoff'),
    strength('Flux dump detonation', 'basic.lanternFluxPurge', 'Pays when Rot density is ready'),
    strength('Flexible starter chassis', 'identity.role', 'Complete starter — not a temporary beginner focus'),
  ],
  'envoy-sanguine-prism': [
    strength('Capped HP sacrifice spike', 'basic.prismSacrifice', 'Full payoff only when fully paid'),
    strength('Brink Flux amp', 'basic.prismBrink', 'Bonus near low Flux / Void-Siphoned'),
    strength('High-risk burst casts', 'identity.role', 'Spend exposure for spike windows'),
  ],
};

const PRESSURES: Record<WeaponFamilyId, readonly [WeaponStrengthOrPressure, WeaponStrengthOrPressure]> = {
  'aegis-longsword': [
    strength('Single-target only', 'drawback.primary', 'No innate AoE or backline reach'),
    strength('Not best burst / hard control', 'drawback.secondary', 'Specialists outpace it at extremes'),
  ],
  'aegis-paired-blades': [
    strength('Weak baseline armor crack', 'drawback.primary', 'Needs earned tempo for Occult rider'),
    strength('Soft vs swarms', 'drawback.secondary', 'Tempo is spent once — chip fights starve it'),
  ],
  'aegis-claymore': [
    strength('Commitment-heavy swings', 'drawback.primary', 'Setup and interrupt pressure punish mistimed breaks'),
    strength('Poor chip Reserve', 'drawback.mechanicalEnforcement', 'Ordinary hits stay Reserve-poor'),
  ],
  'hex-revolver': [
    strength('Poor innate AoE', 'drawback.primary', 'Needs boons/grafts to clear crowds'),
    strength('Limited innate armor pressure', 'drawback.primary', 'Weaker than Nullbreach vs tanks'),
  ],
  'hex-shotgun': [
    strength('Small magazine commitment', 'drawback.primary', 'Misses and soft targets are expensive'),
    strength('Weak crowd handling', 'drawback.secondary', 'Cannot become Pulse-like spread'),
  ],
  'hex-carbine': [
    strength('Ammo-hungry spread', 'drawback.primary', 'Isolated targets waste the mag'),
    strength('Missing splash never redirects', 'drawback.mechanicalEnforcement', 'No free multi-hit into primary'),
  ],
  'envoy-scythe': [
    strength('Lower peak without sequencing', 'drawback.primary', 'Needs Clean Catalyst cycle for best output'),
    strength('Punished by jam / silence', 'drawback.secondary', 'Discipline required vs denial'),
  ],
  'envoy-vambrace': [
    strength('Fragile setup windows', 'drawback.primary', 'Enemies dying too fast erase Rot cashout'),
    strength('Weaker raw chip', 'identity.meter', 'Dumps need Rot density first'),
  ],
  'envoy-sanguine-prism': [
    strength('Self-harm exposure', 'drawback.primary', 'Bad in attrition without vents'),
    strength('Partial sacrifice = no full payoff', 'basic.prismSacrifice', 'Never pretends a full pay when short'),
  ],
};

const FIRST_USE: Record<WeaponFamilyId, WeaponFirstUseBrief> = {
  'aegis-longsword': brief({
    coreLoop: 'Strike to build Fracture, Parry to stay alive, spend Reserve when the board opens.',
    doThis: 'Keep swinging the basic to bank Fracture and Reserve; use Parry on telegraphed hits.',
    avoidThis: 'Do not expect Claymore-level break cashouts or Pulse-style crowd clear from the blade alone.',
    watchThis: 'Abyssal Reserve and Fracture progress on your current target.',
    buildToward: 'Fracture, Parry, Reserve — then flex pierce/control for matchups.',
  }),
  'aegis-paired-blades': brief({
    coreLoop: 'Bank tempo from Evade/Parry, then cash the Occult rider on a priority finish.',
    doThis: 'Deliberately earn tempo before expecting big rider damage.',
    avoidThis: 'Do not chip armored packs without tempo — baseline crack is weak.',
    watchThis: 'Whether the Occult rider is armed, then consume it on purpose.',
    buildToward: 'Evade, Parry, Execution, Occult.',
  }),
  'aegis-claymore': brief({
    coreLoop: 'Commit into heavy Fracture, then cash Reserve on the break.',
    doThis: 'Pick break windows when Fracture is about to land.',
    avoidThis: 'Do not trade chip hits forever — chip Reserve stays poor.',
    watchThis: 'Fracture-break opportunities and Reserve spikes.',
    buildToward: 'Fracture, Break, Reserve, Control.',
  }),
  'hex-revolver': brief({
    coreLoop: 'Shoot efficiently, reload deliberately, feed Protocol Charge into Zero Protocol.',
    doThis: 'Treat Perfect Reload as a resource — bank Protocol before big windows.',
    avoidThis: 'Do not expect innate AoE or armor-specialist deletion.',
    watchThis: 'Magazine, Perfect Reload timing, Protocol Charge pips.',
    buildToward: 'Reload, Perfect Reload, Protocol, Execution.',
  }),
  'hex-shotgun': brief({
    coreLoop: 'Save scarce ammo for armored priority targets and breach windows.',
    doThis: 'Identify Kinetic Armor / tanks before dumping the mag.',
    avoidThis: 'Do not spray soft swarms — overcommit is expensive.',
    watchThis: 'Magazine size, reload commitment, armor pressure on the target.',
    buildToward: 'Priority Target, Armor Pierce, Reload.',
  }),
  'hex-carbine': brief({
    coreLoop: 'Dump spread into clustered frontlines; reload is your burst reset.',
    doThis: 'Aim where secondary targets exist beside the primary.',
    avoidThis: 'Do not expect missing splash to redirect into the primary.',
    watchThis: 'Spread secondary availability and remaining ammo.',
    buildToward: 'Spread, Reload, Fracture, Ballistic.',
  }),
  'envoy-scythe': brief({
    coreLoop: 'Your Scythe supplies four fixed actions. Prime NULL/BLOOD, then Null Arc for a Clean Cycle Flux payoff.',
    doThis: 'Sequence Catalyst → Null Arc deliberately; keep Flux cycling clean across the four Scythe actions.',
    avoidThis: 'Do not play Heart’s Due brink/sacrifice on this chassis — peak comes from sequencing.',
    watchThis: 'Current Catalyst, previous Catalyst, Flux.',
    buildToward: 'Clean Cycle, Catalyst, Flux.',
  }),
  'envoy-vambrace': brief({
    coreLoop: 'Your Vambrace supplies four fixed actions. Stack Rot, protect the setup, then dump Flux for detonation.',
    doThis: 'Prefer durable groups that live long enough for Rot density. Your three flex picks stay when you change weapons.',
    avoidThis: 'Do not force detonation on the same resolution that just applied Rot.',
    watchThis: 'Total Rot stacks and whether a Flux dump is ready.',
    buildToward: 'Rot, Detonation, Curse, Flux.',
  }),
  'envoy-sanguine-prism': brief({
    coreLoop: 'Your Heart’s Due supplies four fixed actions. Enter Brink, pay the capped HP sacrifice fully, spike, then Crimson Vent.',
    doThis: 'Only take the sacrifice when you can pay the full capped cost. Use Expose Vein before Heart Claim when the mark is armed.',
    avoidThis: 'Do not expect full payoff on a partial sacrifice.',
    watchThis: 'Flux vs Brink threshold, sacrifice preview, and whether full pay is possible.',
    buildToward: 'Brink, Sacrifice, Flux — with restore/vent support.',
  }),
};

const SELECTION: Record<WeaponFamilyId, string> = {
  'aegis-longsword': 'Steady Fracture and Parry/Reserve — the complete Aegis baseline.',
  'aegis-paired-blades': 'Earn tempo from Evade/Parry, then finish with an Occult rider.',
  'aegis-claymore': 'Heavy Fracture commitment — cash out Reserve on the break.',
  'hex-revolver': 'Precision shots, Perfect Reload, and Protocol Charge tempo.',
  'hex-shotgun': 'Scarce ammo, hard Kinetic Armor breach, priority deletes.',
  'hex-carbine': 'Short-range spread into clusters — reload is the burst window.',
  'envoy-scythe': 'Clean Flux cycling with Catalyst → Null Arc sequencing across four Scythe actions.',
  'envoy-vambrace': 'Stack Rot across four Vambrace actions, delay the dump, detonate when the board is ready — the complete Envoy starter.',
  'envoy-sanguine-prism': 'Brink Flux, Expose Vein marks, and capped HP sacrifice across four Heart’s Due actions.',
};

function coreRecommendedIds(familyId: WeaponFamilyId): OperativeAbilityId[] {
  const profile = getWeaponLoadoutRecommendationProfile(familyId);
  const fixedBasic = profile.sampleLoadouts[0]?.slots[0];
  return profile.recommendations
    .filter((r) => r.coreTier === 'CORE' && r.abilityId !== fixedBasic)
    .slice(0, 5)
    .map((r) => r.abilityId);
}

function sanctuaryPathsFor(familyId: WeaponFamilyId) {
  const profile = getWeaponGraftRecommendationProfile(familyId);
  return profile.applications.slice(0, 3).map((a) => ({
    abilityId: a.abilityId,
    graftId: a.graftId,
    reason: a.playerFacingReason,
  }));
}

function unlockLines(familyId: WeaponFamilyId) {
  const def = getWeaponFamily(familyId);
  return def.unlockRequirement.map((c) => ({
    resourceId: c.resourceId,
    quantity: c.quantity,
    displayName: getResourceDisplayName(c.resourceId),
  }));
}

function buildSummary(familyId: WeaponFamilyId): WeaponPlayerFacingSummary {
  const def = getWeaponFamily(familyId);
  const identity = getWeaponIdentityProfile(familyId);
  const drawback = WEAPON_DRAWBACK_RECORDS[familyId];
  const loadout = getWeaponLoadoutRecommendationProfile(familyId);
  const isStarter = STARTER_WEAPON_BY_CLASS[def.classId] === familyId;
  const alternate = loadout.sampleLoadouts.find((s) => s.kind === 'ALTERNATE_COVERAGE');

  return {
    id: familyId,
    displayName: def.name,
    classId: def.classId,
    roleLabel: ROLE[familyId],
    selectionSummary: SELECTION[familyId],
    playstyleExplanation: identity.oneSentencePlaystyle,
    basicExplanation: identity.uniqueBasicSummary,
    meterBehavior: identity.meterSummary,
    strengths: STRENGTHS[familyId],
    pressures: PRESSURES[familyId],
    buildDirectionTags: BUILD_TAGS[familyId],
    recommendedAbilityIds: coreRecommendedIds(familyId),
    alternateLoadoutNote: alternate?.playerFacingSummary ?? null,
    firstUseBrief: FIRST_USE[familyId],
    unlockRequirements: unlockLines(familyId),
    isStarter,
    starterFraming: isStarter
      ? 'Flexible and complete — not a temporary beginner chassis.'
      : null,
    phase3GDrawback: drawback.playerFacingSignal,
    tutorialCompletionKey: `weapon_brief.${familyId}`,
    sanctuaryPaths: sanctuaryPathsFor(familyId),
    loopCueTag: LOOP_CUE[familyId],
  };
}

export const WEAPON_PLAYER_FACING_SUMMARIES: Record<WeaponFamilyId, WeaponPlayerFacingSummary> = {
  'aegis-longsword': buildSummary('aegis-longsword'),
  'aegis-paired-blades': buildSummary('aegis-paired-blades'),
  'aegis-claymore': buildSummary('aegis-claymore'),
  'hex-revolver': buildSummary('hex-revolver'),
  'hex-shotgun': buildSummary('hex-shotgun'),
  'hex-carbine': buildSummary('hex-carbine'),
  'envoy-scythe': buildSummary('envoy-scythe'),
  'envoy-vambrace': buildSummary('envoy-vambrace'),
  'envoy-sanguine-prism': buildSummary('envoy-sanguine-prism'),
};
