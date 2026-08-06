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
  'aegis-runed-longsword': 'Balanced Fracture Setup',
  'aegis-rift-edge': 'Tempo Execution Blade',
  'aegis-claymore-blade': 'Heavy Break Cashout',
  'hex-silver-core-sidearm': 'Precision Reload Tempo',
  'hex-void-cannon': 'Armor Breach Burst',
  'hex-pulse-rifle': 'Cluster Spread Clear',
  'envoy-null-conduit': 'Clean Flux Cycle',
  'envoy-echo-lantern': 'Rot Detonation Setup',
  'envoy-sanguine-prism': 'Brink Sacrifice Spike',
};

const LOOP_CUE: Record<WeaponFamilyId, string> = {
  'aegis-runed-longsword': 'FRACTURE',
  'aegis-rift-edge': 'EVADE',
  'aegis-claymore-blade': 'BREAK',
  'hex-silver-core-sidearm': 'RELOAD',
  'hex-void-cannon': 'PRIORITY TARGET',
  'hex-pulse-rifle': 'SPREAD',
  'envoy-null-conduit': 'CLEAN CYCLE',
  'envoy-echo-lantern': 'ROT',
  'envoy-sanguine-prism': 'BRINK',
};

const BUILD_TAGS: Record<WeaponFamilyId, readonly string[]> = {
  'aegis-runed-longsword': ['Fracture', 'Parry', 'Reserve', 'Melee'],
  'aegis-rift-edge': ['Evade', 'Parry', 'Execution', 'Occult'],
  'aegis-claymore-blade': ['Fracture', 'Break', 'Reserve', 'Control'],
  'hex-silver-core-sidearm': ['Reload', 'Perfect Reload', 'Protocol', 'Execution'],
  'hex-void-cannon': ['Priority Target', 'Armor Pierce', 'Reload', 'High Risk'],
  'hex-pulse-rifle': ['Spread', 'Reload', 'Fracture', 'Ballistic'],
  'envoy-null-conduit': ['Clean Cycle', 'Catalyst', 'Flux', 'Occult'],
  'envoy-echo-lantern': ['Rot', 'Detonation', 'Curse', 'Flux'],
  'envoy-sanguine-prism': ['Brink', 'Sacrifice', 'Flux', 'High Risk'],
};

const STRENGTHS: Record<WeaponFamilyId, readonly [WeaponStrengthOrPressure, WeaponStrengthOrPressure, ...WeaponStrengthOrPressure[]]> = {
  'aegis-runed-longsword': [
    strength('Steady Fracture setup', 'identity.uniqueBasic', 'Reliable Kinetic basic without stamina tax'),
    strength('Parry / Reserve rhythm', 'identity.meter', 'Natural Abyssal Reserve on hits'),
    strength('Flexible mixed offense', 'identity.role', 'Complete starter — not a temporary beginner blade'),
  ],
  'aegis-rift-edge': [
    strength('Tempo-armed Occult rider', 'basic.riftEdgeTempo', 'Evade/Parry arms the finish'),
    strength('Fast Kinetic basic', 'identity.uniqueBasic', 'Keeps pressure while banking tempo'),
    strength('Execution windows', 'identity.affinity', 'Pays off when you earn the rider'),
  ],
  'aegis-claymore-blade': [
    strength('Heavy Fracture pressure', 'identity.uniqueBasic', 'High Fracture commitment per swing'),
    strength('Break cashout Reserve', 'drawback.mechanicalEnforcement', 'Large Reserve only on Fracture-break'),
    strength('Committed frontline control', 'identity.role', 'Owns break windows, not chip fights'),
  ],
  'hex-silver-core-sidearm': [
    strength('Efficient precision shots', 'identity.uniqueBasic', '1 AP / 1 ammo inherits loaded payload'),
    strength('Reload → Protocol loop', 'identity.meter', 'Perfect Reload feeds Protocol / Zero Protocol'),
    strength('Flexible execute tempo', 'identity.role', 'Learning weapon that stays complete'),
  ],
  'hex-void-cannon': [
    strength('Armor-breach ST burst', 'identity.uniqueBasic', 'Pierce pressure vs Kinetic Armor'),
    strength('Priority target deletion', 'identity.role', 'Spends scarce ammo to crack tanks'),
    strength('High-impact commitment', 'identity.meter', 'Each shot matters — reloads are deliberate'),
  ],
  'hex-pulse-rifle': [
    strength('Primary + adjacent spread', 'basic.spread', 'Cluster clear without Ash-Jacket Salvo'),
    strength('Reload as burst window', 'identity.playstyle', 'Empty mag is part of the loop'),
    strength('Crowd Fracture pressure', 'identity.affinity', 'Rewards packed frontlines'),
  ],
  'envoy-null-conduit': [
    strength('Clean Catalyst cycle', 'basic.cleanCatalystCycle', 'NULL/BLOOD → Splinter pays Flux + damage'),
    strength('Stable Flux cycling', 'identity.meter', 'Forgiving baseline without Brink gambling'),
    strength('Sequence discipline', 'identity.role', 'Rewards controlled Catalyst dumps'),
  ],
  'envoy-echo-lantern': [
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
  'aegis-runed-longsword': [
    strength('Single-target only', 'drawback.primary', 'No innate AoE or backline reach'),
    strength('Not best burst / hard control', 'drawback.secondary', 'Specialists outpace it at extremes'),
  ],
  'aegis-rift-edge': [
    strength('Weak baseline armor crack', 'drawback.primary', 'Needs earned tempo for Occult rider'),
    strength('Soft vs swarms', 'drawback.secondary', 'Tempo is spent once — chip fights starve it'),
  ],
  'aegis-claymore-blade': [
    strength('Commitment-heavy swings', 'drawback.primary', 'Setup and interrupt pressure punish mistimed breaks'),
    strength('Poor chip Reserve', 'drawback.mechanicalEnforcement', 'Ordinary hits stay Reserve-poor'),
  ],
  'hex-silver-core-sidearm': [
    strength('Poor innate AoE', 'drawback.primary', 'Needs boons/grafts to clear crowds'),
    strength('Limited innate armor pressure', 'drawback.primary', 'Weaker than Nullbreach vs tanks'),
  ],
  'hex-void-cannon': [
    strength('Small magazine commitment', 'drawback.primary', 'Misses and soft targets are expensive'),
    strength('Weak crowd handling', 'drawback.secondary', 'Cannot become Pulse-like spread'),
  ],
  'hex-pulse-rifle': [
    strength('Ammo-hungry spread', 'drawback.primary', 'Isolated targets waste the mag'),
    strength('Missing splash never redirects', 'drawback.mechanicalEnforcement', 'No free multi-hit into primary'),
  ],
  'envoy-null-conduit': [
    strength('Lower peak without sequencing', 'drawback.primary', 'Needs Clean Catalyst cycle for best output'),
    strength('Punished by jam / silence', 'drawback.secondary', 'Discipline required vs denial'),
  ],
  'envoy-echo-lantern': [
    strength('Fragile setup windows', 'drawback.primary', 'Enemies dying too fast erase Rot cashout'),
    strength('Weaker raw chip', 'identity.meter', 'Dumps need Rot density first'),
  ],
  'envoy-sanguine-prism': [
    strength('Self-harm exposure', 'drawback.primary', 'Bad in attrition without vents'),
    strength('Partial sacrifice = no full payoff', 'basic.prismSacrifice', 'Never pretends a full pay when short'),
  ],
};

const FIRST_USE: Record<WeaponFamilyId, WeaponFirstUseBrief> = {
  'aegis-runed-longsword': brief({
    coreLoop: 'Strike to build Fracture, Parry to stay alive, spend Reserve when the board opens.',
    doThis: 'Keep swinging the basic to bank Fracture and Reserve; use Parry on telegraphed hits.',
    avoidThis: 'Do not expect Claymore-level break cashouts or Pulse-style crowd clear from the blade alone.',
    watchThis: 'Abyssal Reserve and Fracture progress on your current target.',
    buildToward: 'Fracture, Parry, Reserve — then flex pierce/control for matchups.',
  }),
  'aegis-rift-edge': brief({
    coreLoop: 'Bank tempo from Evade/Parry, then cash the Occult rider on a priority finish.',
    doThis: 'Deliberately earn tempo before expecting big rider damage.',
    avoidThis: 'Do not chip armored packs without tempo — baseline crack is weak.',
    watchThis: 'Whether the Occult rider is armed, then consume it on purpose.',
    buildToward: 'Evade, Parry, Execution, Occult.',
  }),
  'aegis-claymore-blade': brief({
    coreLoop: 'Commit into heavy Fracture, then cash Reserve on the break.',
    doThis: 'Pick break windows when Fracture is about to land.',
    avoidThis: 'Do not trade chip hits forever — chip Reserve stays poor.',
    watchThis: 'Fracture-break opportunities and Reserve spikes.',
    buildToward: 'Fracture, Break, Reserve, Control.',
  }),
  'hex-silver-core-sidearm': brief({
    coreLoop: 'Shoot efficiently, reload deliberately, feed Protocol Charge into Zero Protocol.',
    doThis: 'Treat Perfect Reload as a resource — bank Protocol before big windows.',
    avoidThis: 'Do not expect innate AoE or armor-specialist deletion.',
    watchThis: 'Magazine, Perfect Reload timing, Protocol Charge pips.',
    buildToward: 'Reload, Perfect Reload, Protocol, Execution.',
  }),
  'hex-void-cannon': brief({
    coreLoop: 'Save scarce ammo for armored priority targets and breach windows.',
    doThis: 'Identify Kinetic Armor / tanks before dumping the mag.',
    avoidThis: 'Do not spray soft swarms — overcommit is expensive.',
    watchThis: 'Magazine size, reload commitment, armor pressure on the target.',
    buildToward: 'Priority Target, Armor Pierce, Reload.',
  }),
  'hex-pulse-rifle': brief({
    coreLoop: 'Dump spread into clustered frontlines; reload is your burst reset.',
    doThis: 'Aim where secondary targets exist beside the primary.',
    avoidThis: 'Do not expect missing splash to redirect into the primary.',
    watchThis: 'Spread secondary availability and remaining ammo.',
    buildToward: 'Spread, Reload, Fracture, Ballistic.',
  }),
  'envoy-null-conduit': brief({
    coreLoop: 'Prime NULL/BLOOD Catalyst, then Splinter for a Clean Cycle Flux payoff.',
    doThis: 'Sequence Catalyst → Splinter deliberately; keep Flux cycling clean.',
    avoidThis: 'Do not play Prism brink/sacrifice on this chassis — peak comes from sequencing.',
    watchThis: 'Current Catalyst, previous Catalyst, Flux.',
    buildToward: 'Clean Cycle, Catalyst, Flux.',
  }),
  'envoy-echo-lantern': brief({
    coreLoop: 'Stack Rot, protect the setup, then dump Flux for detonation.',
    doThis: 'Prefer durable groups that live long enough for Rot density.',
    avoidThis: 'Do not force detonation on the same resolution that just applied Rot.',
    watchThis: 'Total Rot stacks and whether a Flux dump is ready.',
    buildToward: 'Rot, Detonation, Curse, Flux.',
  }),
  'envoy-sanguine-prism': brief({
    coreLoop: 'Enter Brink, pay the capped HP sacrifice fully, spike the cast, then vent.',
    doThis: 'Only take the sacrifice when you can pay the full capped cost.',
    avoidThis: 'Do not expect full payoff on a partial sacrifice.',
    watchThis: 'Flux vs Brink threshold, sacrifice preview, and whether full pay is possible.',
    buildToward: 'Brink, Sacrifice, Flux — with restore/vent support.',
  }),
};

const SELECTION: Record<WeaponFamilyId, string> = {
  'aegis-runed-longsword': 'Steady Fracture and Parry/Reserve — the complete Aegis baseline.',
  'aegis-rift-edge': 'Earn tempo from Evade/Parry, then finish with an Occult rider.',
  'aegis-claymore-blade': 'Heavy Fracture commitment — cash out Reserve on the break.',
  'hex-silver-core-sidearm': 'Precision shots, Perfect Reload, and Protocol Charge tempo.',
  'hex-void-cannon': 'Scarce ammo, hard Kinetic Armor breach, priority deletes.',
  'hex-pulse-rifle': 'Short-range spread into clusters — reload is the burst window.',
  'envoy-null-conduit': 'Clean Flux cycling with Catalyst → Splinter sequencing.',
  'envoy-echo-lantern': 'Stack Rot, delay the dump, detonate when the board is ready — the complete Envoy starter.',
  'envoy-sanguine-prism': 'Brink Flux and capped HP sacrifice for spike casts.',
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
  'aegis-runed-longsword': buildSummary('aegis-runed-longsword'),
  'aegis-rift-edge': buildSummary('aegis-rift-edge'),
  'aegis-claymore-blade': buildSummary('aegis-claymore-blade'),
  'hex-silver-core-sidearm': buildSummary('hex-silver-core-sidearm'),
  'hex-void-cannon': buildSummary('hex-void-cannon'),
  'hex-pulse-rifle': buildSummary('hex-pulse-rifle'),
  'envoy-null-conduit': buildSummary('envoy-null-conduit'),
  'envoy-echo-lantern': buildSummary('envoy-echo-lantern'),
  'envoy-sanguine-prism': buildSummary('envoy-sanguine-prism'),
};
