/**
 * Phase 3J — advisory graft recommendation profiles (read-only).
 * Live graft model: Sanctuary residue applications during a deployment (run-scoped).
 * Configurations describe validated possible Sanctuary builds — not Safehouse loadouts.
 */
import type { WeaponFamilyId } from '../../types/weapon';
import type {
  WeaponGraftApplication,
  WeaponGraftRecommendationProfile,
} from '../../types/weaponGraftRecommendation';
import { ALL_WEAPON_FAMILY_IDS, getWeaponFamily } from '../weaponRegistry';
import { getWeaponLoadoutRecommendationProfile } from '../weaponLoadoutRecommendationProfiles';
import { WEAPON_DRAWBACK_RECORDS } from '../weaponDrawbackEngine';

function app(
  partial: WeaponGraftApplication,
): WeaponGraftApplication {
  return partial;
}

function sampleHas(weaponId: WeaponFamilyId, abilityId: string): boolean {
  const p = getWeaponLoadoutRecommendationProfile(weaponId);
  return p.sampleLoadouts.some((s) => s.slots.includes(abilityId as never));
}

function buildAegisProfiles(): WeaponGraftRecommendationProfile[] {
  const longsword: WeaponGraftRecommendationProfile = {
    weaponFamilyId: 'aegis-runed-longsword',
    classId: 'AEGIS',
    validationState: 'VALIDATED',
    identitySummary: 'Reliable Fracture + Parry/Reserve sequencing',
    applications: [
      app({
        weaponFamilyId: 'aegis-runed-longsword',
        abilityId: 'VEIL_PIERCER',
        graftId: 'FLAYER_GRAFT',
        role: 'IDENTITY_ANCHOR',
        exactRuntimeInteraction: 'Armor pressure complement while STRIKE keeps Fracture',
        tagsAdded: [],
        tagsRemoved: [],
        tagsReplaced: [],
        eventsAdded: [],
        eventsRemoved: [],
        meterEffect: 'Preserves Reserve generation on basic',
        resourceEffect: 'See FLAYER costs',
        targetingEffect: 'Single-target flex',
        meaningfulUpside: 'Reinforces pierce/control without Claymore cashout',
        meaningfulDownside: 'FLAYER tradeoff on pierce ability',
        phase3GDrawbackGuard: WEAPON_DRAWBACK_RECORDS['aegis-runed-longsword'].compensationMustNotErase,
        requiredClassRank: 3,
        availableWhenWeaponUnlocks: true,
        abilityInPhase3HSample: sampleHas('aegis-runed-longsword', 'VEIL_PIERCER'),
        validationState: 'VALIDATED',
        playerFacingReason: 'Keeps Fracture on basic; flex pierces armor.',
      }),
      app({
        weaponFamilyId: 'aegis-runed-longsword',
        abilityId: 'ASHEN_MANTLE',
        graftId: 'NULL_SPACE_GRAFT',
        role: 'DEFENSIVE_FLEX',
        exactRuntimeInteraction: 'Defensive graft on mantle — Parry/Reserve sustain',
        tagsAdded: [],
        tagsRemoved: [],
        tagsReplaced: [],
        eventsAdded: [],
        eventsRemoved: [],
        meterEffect: 'Supports Reserve/parry loop',
        resourceEffect: 'Graft cost taxes',
        targetingEffect: 'Self/defense',
        meaningfulUpside: 'Survivability without burst conversion',
        meaningfulDownside: 'Residue + graft downside',
        phase3GDrawbackGuard: WEAPON_DRAWBACK_RECORDS['aegis-runed-longsword'].compensationMustNotErase,
        requiredClassRank: 3,
        availableWhenWeaponUnlocks: true,
        abilityInPhase3HSample: sampleHas('aegis-runed-longsword', 'ASHEN_MANTLE'),
        validationState: 'VALIDATED',
        playerFacingReason: 'Defense flex for balanced sword.',
      }),
    ],
    antiSynergies: [
      app({
        weaponFamilyId: 'aegis-runed-longsword',
        abilityId: 'STRIKE',
        graftId: 'ECHO_GRAFT',
        role: 'ANTI_SYNERGY',
        exactRuntimeInteraction: 'Removes FRACTURE from Strike — deletes identity setup',
        tagsAdded: [],
        tagsRemoved: ['FRACTURE'],
        tagsReplaced: [],
        eventsAdded: [],
        eventsRemoved: ['FRACTURE_SETUP'],
        meterEffect: 'Breaks Fracture→Reserve plan',
        resourceEffect: 'Echo duplicate under-delivers on Aegis',
        targetingEffect: 'Multi-hit without Fracture',
        meaningfulUpside: 'None for Longsword identity',
        meaningfulDownside: 'Removes reliable Fracture access',
        phase3GDrawbackGuard: 'Must not remove Fracture from the sword loop',
        requiredClassRank: 7,
        availableWhenWeaponUnlocks: true,
        abilityInPhase3HSample: true,
        validationState: 'VALIDATED',
        playerFacingReason: 'Echo on Strike strips Fracture — hard identity anti-synergy.',
      }),
    ],
    configurations: [
      {
        kind: 'EARLY_IDENTITY',
        label: 'Pierce flex',
        requiredClassRank: 3,
        loadoutRef: 'IDENTITY_FORWARD',
        assignments: [
          {
            abilityId: 'VEIL_PIERCER',
            graftId: 'NEUTRON_GRAFT',
            job: 'Committed pierce payoff',
            tradeoff: 'Neutron downside on flex ability',
          },
        ],
        preservesDrawback: 'Still single-target melee; no Claymore break cashout',
        playerFacingSummary: 'One early pierce graft; Fracture stays on ungrafted STRIKE.',
      },
      {
        kind: 'MATURE_ALTERNATE',
        label: 'Pierce + mantle',
        requiredClassRank: 17,
        loadoutRef: 'ALTERNATE_COVERAGE',
        assignments: [
          {
            abilityId: 'GRAVE_BIND',
            graftId: 'GRID_HACKER_GRAFT',
            job: 'Control coverage',
            tradeoff: 'Grid-hacker cost/tradeoff',
          },
          {
            abilityId: 'ASHEN_MANTLE',
            graftId: 'IRON_LUNG_GRAFT',
            job: 'Sustain flex',
            tradeoff: 'Pure-stat survivor noted for redesign',
          },
        ],
        preservesDrawback: 'No AoE conversion of basic; still not Claymore',
        playerFacingSummary: 'Coverage bind + mantle sustain — alternate expression.',
      },
    ],
    unresolvedGaps: ['No dedicated Parry-event graft in live catalog'],
  };

  const rift: WeaponGraftRecommendationProfile = {
    weaponFamilyId: 'aegis-rift-edge',
    classId: 'AEGIS',
    validationState: 'VALIDATED',
    identitySummary: 'Evade/Parry tempo → Occult rider',
    applications: [
      app({
        weaponFamilyId: 'aegis-rift-edge',
        abilityId: 'SHADOW_STEP',
        graftId: 'NULL_SPACE_GRAFT',
        role: 'METER_SUPPORT',
        exactRuntimeInteraction: 'Mobility/defense supports tempo arming window',
        tagsAdded: [],
        tagsRemoved: [],
        tagsReplaced: [],
        eventsAdded: ['PARRY_EVADE_TEMPO'],
        eventsRemoved: [],
        meterEffect: 'Helps earn tempo',
        resourceEffect: 'Graft tradeoff',
        targetingEffect: 'Self',
        meaningfulUpside: 'Tempo reliability',
        meaningfulDownside: 'Graft cost',
        phase3GDrawbackGuard: WEAPON_DRAWBACK_RECORDS['aegis-rift-edge'].compensationMustNotErase,
        requiredClassRank: 3,
        availableWhenWeaponUnlocks: true,
        abilityInPhase3HSample: sampleHas('aegis-rift-edge', 'SHADOW_STEP'),
        validationState: 'VALIDATED',
        playerFacingReason: 'Supports evade tempo without free Occult rider.',
      }),
    ],
    antiSynergies: [
      app({
        weaponFamilyId: 'aegis-rift-edge',
        abilityId: 'STRIKE',
        graftId: 'DENSITY_GRAFT',
        role: 'ANTI_SYNERGY',
        exactRuntimeInteraction: 'Unconditional damage amp flattens tempo decision',
        tagsAdded: [],
        tagsRemoved: [],
        tagsReplaced: [],
        eventsAdded: [],
        eventsRemoved: [],
        meterEffect: 'Reserve tax may fight tempo pacing',
        resourceEffect: 'Reserve penalty',
        targetingEffect: 'None',
        meaningfulUpside: 'Raw damage',
        meaningfulDownside: 'Pushes toward unconditional payoff fantasy',
        phase3GDrawbackGuard: 'Must still require tempo for Occult rider',
        requiredClassRank: 7,
        availableWhenWeaponUnlocks: true,
        abilityInPhase3HSample: true,
        validationState: 'NEEDS_REVIEW',
        playerFacingReason: 'Density on Strike risks erasing tempo as the decision.',
      }),
    ],
    configurations: [
      {
        kind: 'EARLY_IDENTITY',
        label: 'Tempo mobility',
        requiredClassRank: 3,
        loadoutRef: 'IDENTITY_FORWARD',
        assignments: [
          {
            abilityId: 'SHADOW_STEP',
            graftId: 'CONDUIT_GRAFT',
            job: 'Tempo approach tool',
            tradeoff: 'Conduit graft downside',
          },
        ],
        preservesDrawback: 'Occult rider still requires armed tempo',
        playerFacingSummary: 'Graft mobility; leave Strike ungrafted for tempo consume.',
      },
      {
        kind: 'MATURE_ALTERNATE',
        label: 'Execute flex',
        requiredClassRank: 17,
        loadoutRef: 'IDENTITY_FORWARD',
        assignments: [
          {
            abilityId: 'CRIMSON_PACT',
            graftId: 'SANGUINE_GRAFT',
            job: 'HP-tax execute amplify',
            tradeoff: 'HP drain',
          },
          {
            abilityId: 'SHADOW_STEP',
            graftId: 'NULL_SPACE_GRAFT',
            job: 'Tempo window',
            tradeoff: 'Graft cost',
          },
        ],
        preservesDrawback: 'No permanent unconditional Occult rider',
        playerFacingSummary: 'Sanguine pact + null-space step — alternate execute line.',
      },
    ],
    unresolvedGaps: ['No graft that explicitly arms riftEdgeTempo'],
  };

  const claymore: WeaponGraftRecommendationProfile = {
    weaponFamilyId: 'aegis-claymore-blade',
    classId: 'AEGIS',
    validationState: 'VALIDATED',
    identitySummary: 'Committed Fracture-break + stamina planning',
    applications: [
      app({
        weaponFamilyId: 'aegis-claymore-blade',
        abilityId: 'DEVASTATE',
        graftId: 'DENSITY_GRAFT',
        role: 'IDENTITY_ANCHOR',
        exactRuntimeInteraction: 'Heavy flex cashout after Fracture setup from basic',
        tagsAdded: [],
        tagsRemoved: [],
        tagsReplaced: [],
        eventsAdded: ['FRACTURE_BREAK'],
        eventsRemoved: [],
        meterEffect: 'Supports break window damage',
        resourceEffect: 'Reserve tax',
        targetingEffect: 'Single heavy',
        meaningfulUpside: 'Break turn impact',
        meaningfulDownside: 'Reserve tax',
        phase3GDrawbackGuard: WEAPON_DRAWBACK_RECORDS['aegis-claymore-blade'].compensationMustNotErase,
        requiredClassRank: 3,
        availableWhenWeaponUnlocks: true,
        abilityInPhase3HSample: sampleHas('aegis-claymore-blade', 'DEVASTATE'),
        validationState: 'VALIDATED',
        playerFacingReason: 'Amplify devastate after setup — stamina still on basic.',
      }),
    ],
    antiSynergies: [
      app({
        weaponFamilyId: 'aegis-claymore-blade',
        abilityId: 'STRIKE',
        graftId: 'ECHO_GRAFT',
        role: 'ANTI_SYNERGY',
        exactRuntimeInteraction: 'Removes FRACTURE from heavy basic',
        tagsAdded: [],
        tagsRemoved: ['FRACTURE'],
        tagsReplaced: [],
        eventsAdded: [],
        eventsRemoved: ['FRACTURE_SETUP', 'FRACTURE_BREAK'],
        meterEffect: 'Deletes break cashout route',
        resourceEffect: '—',
        targetingEffect: 'Echo hits',
        meaningfulUpside: 'None for Claymore',
        meaningfulDownside: 'Removes Fracture',
        phase3GDrawbackGuard: 'Must not remove Fracture',
        requiredClassRank: 7,
        availableWhenWeaponUnlocks: true,
        abilityInPhase3HSample: true,
        validationState: 'VALIDATED',
        playerFacingReason: 'Echo Strike on Claymore is a hard anti-synergy.',
      }),
    ],
    configurations: [
      {
        kind: 'EARLY_IDENTITY',
        label: 'Devastate density',
        requiredClassRank: 3,
        loadoutRef: 'IDENTITY_FORWARD',
        assignments: [
          {
            abilityId: 'DEVASTATE',
            graftId: 'DENSITY_GRAFT',
            job: 'Break-turn damage',
            tradeoff: 'Reserve tax',
          },
        ],
        preservesDrawback: 'Basic still stamina-heavy; chip Reserve remains poor',
        playerFacingSummary: 'One density graft on devastate.',
      },
      {
        kind: 'MATURE_ALTERNATE',
        label: 'Ruin + carapace',
        requiredClassRank: 17,
        loadoutRef: 'ALTERNATE_COVERAGE',
        assignments: [
          {
            abilityId: 'REAVE',
            graftId: 'SHRAPNEL_GRAFT',
            job: 'Coverage pressure',
            tradeoff: 'Shrapnel downside',
          },
          {
            abilityId: 'BLOOD_BOUND_CARAPACE',
            graftId: 'MARTYR_GRAFT',
            job: 'Committed defense',
            tradeoff: 'Max HP tax (reversibility gap noted)',
          },
        ],
        preservesDrawback: 'No free stamina; Fracture still from basic',
        playerFacingSummary: 'Coverage reave + martyr carapace.',
      },
    ],
    unresolvedGaps: ['No stamina-refund graft that keeps commitment meaningful'],
  };

  return [longsword, rift, claymore];
}

function buildHexProfiles(): WeaponGraftRecommendationProfile[] {
  const sidearm: WeaponGraftRecommendationProfile = {
    weaponFamilyId: 'hex-silver-core-sidearm',
    classId: 'HEX_SHOT',
    validationState: 'VALIDATED',
    identitySummary: 'Reload / Perfect Reload / Protocol Charge precision',
    applications: [
      app({
        weaponFamilyId: 'hex-silver-core-sidearm',
        abilityId: 'REVENANTS_ECHO',
        graftId: 'ECHO_RECEIVER_GRAFT',
        role: 'METER_SUPPORT',
        exactRuntimeInteraction: 'Kill ammo refund supports reload cadence without deleting it',
        tagsAdded: [],
        tagsRemoved: [],
        tagsReplaced: [],
        eventsAdded: ['RELOAD_PROTOCOL'],
        eventsRemoved: [],
        meterEffect: 'Protocol Charge still from Perfect Reload',
        resourceEffect: 'Ammo refund on kill only',
        targetingEffect: 'Unchanged',
        meaningfulUpside: 'Efficiency',
        meaningfulDownside: 'EXPOSE on non-kill',
        phase3GDrawbackGuard: WEAPON_DRAWBACK_RECORDS['hex-silver-core-sidearm'].compensationMustNotErase,
        requiredClassRank: 3,
        availableWhenWeaponUnlocks: true,
        abilityInPhase3HSample: sampleHas('hex-silver-core-sidearm', 'REVENANTS_ECHO'),
        validationState: 'VALIDATED',
        playerFacingReason: 'Efficiency without erasing reload decisions.',
      }),
      app({
        weaponFamilyId: 'hex-silver-core-sidearm',
        abilityId: 'PHASE_SHIFT_RELOAD',
        graftId: 'DEAD_MAN_SWITCH_GRAFT',
        role: 'ALTERNATE_EXPRESSION',
        exactRuntimeInteraction: 'Reload eject AoE — still a reload action',
        tagsAdded: [],
        tagsRemoved: [],
        tagsReplaced: [],
        eventsAdded: ['RELOAD_PROTOCOL'],
        eventsRemoved: [],
        meterEffect: 'Never grants overcharge — Protocol path preserved via Perfect',
        resourceEffect: 'Ejects remaining rounds',
        targetingEffect: 'AoE on manual reload',
        meaningfulUpside: 'Reload as weaponized decision',
        meaningfulDownside: 'No overcharge from that reload',
        phase3GDrawbackGuard: WEAPON_DRAWBACK_RECORDS['hex-silver-core-sidearm'].compensationMustNotErase,
        requiredClassRank: 3,
        availableWhenWeaponUnlocks: true,
        abilityInPhase3HSample: false,
        validationState: 'VALIDATED',
        playerFacingReason: 'Weaponizes reload without removing the loop.',
      }),
    ],
    antiSynergies: [
      app({
        weaponFamilyId: 'hex-silver-core-sidearm',
        abilityId: 'REVENANTS_ECHO',
        graftId: 'BLOOD_MAG_GRAFT',
        role: 'ANTI_SYNERGY',
        exactRuntimeInteraction: 'Zero ammo cost softens reload cadence',
        tagsAdded: [],
        tagsRemoved: [],
        tagsReplaced: [],
        eventsAdded: [],
        eventsRemoved: [],
        meterEffect: 'Fewer Perfect Reload opportunities',
        resourceEffect: 'HP drain replaces ammo',
        targetingEffect: 'None',
        meaningfulUpside: 'Ammo free casts',
        meaningfulDownside: 'Attacks Protocol Charge engine',
        phase3GDrawbackGuard: 'Reload cadence must remain meaningful',
        requiredClassRank: 3,
        availableWhenWeaponUnlocks: true,
        abilityInPhase3HSample: true,
        validationState: 'VALIDATED',
        playerFacingReason: 'Blood-Mag on Sidearm flex makes Perfect Reload rarer.',
      }),
    ],
    configurations: [
      {
        kind: 'EARLY_IDENTITY',
        label: 'Echo efficiency',
        requiredClassRank: 3,
        loadoutRef: 'IDENTITY_FORWARD',
        assignments: [
          {
            abilityId: 'REVENANTS_ECHO',
            graftId: 'ECHO_RECEIVER_GRAFT',
            job: 'Kill refund tempo',
            tradeoff: 'EXPOSE on whiff',
          },
        ],
        preservesDrawback: 'Still not Pulse AoE or Nullbreach armor specialist',
        playerFacingSummary: 'One echo-receiver on Revenant.',
      },
      {
        kind: 'MATURE_ALTERNATE',
        label: 'Dead-Man + sight',
        requiredClassRank: 17,
        loadoutRef: 'ALTERNATE_COVERAGE',
        assignments: [
          {
            abilityId: 'PHASE_SHIFT_RELOAD',
            graftId: 'DEAD_MAN_SWITCH_GRAFT',
            job: 'Weaponized reload',
            tradeoff: 'No overcharge on that reload',
          },
          {
            abilityId: 'ASTRAL_TARGET_LOCK',
            graftId: 'ASTRAL_SIGHT_GRAFT',
            job: 'Execute crit line',
            tradeoff: 'Base damage −50%',
          },
        ],
        preservesDrawback: 'No simultaneous specialist AoE + armor identity',
        playerFacingSummary: 'Reload eject + astral sight coverage.',
      },
    ],
    unresolvedGaps: [],
  };

  const nullbreach: WeaponGraftRecommendationProfile = {
    weaponFamilyId: 'hex-void-cannon',
    classId: 'HEX_SHOT',
    validationState: 'VALIDATED',
    identitySummary: 'Armor breach + small-mag commitment',
    applications: [
      app({
        weaponFamilyId: 'hex-void-cannon',
        abilityId: 'SINGULARITY_SLUG',
        graftId: 'GHOST_BEAM_GRAFT',
        role: 'IDENTITY_ANCHOR',
        exactRuntimeInteraction: 'Adds ARMOR_PIERCE tag to slug — reinforces breach',
        tagsAdded: ['ARMOR_PIERCE'],
        tagsRemoved: [],
        tagsReplaced: [],
        eventsAdded: ['ARMOR_PRESSURE'],
        eventsRemoved: [],
        meterEffect: 'Reload still required',
        resourceEffect: '+1 AP',
        targetingEffect: 'Single-target',
        meaningfulUpside: 'Armor identity',
        meaningfulDownside: 'AP tax',
        phase3GDrawbackGuard: WEAPON_DRAWBACK_RECORDS['hex-void-cannon'].compensationMustNotErase,
        requiredClassRank: 3,
        availableWhenWeaponUnlocks: true,
        abilityInPhase3HSample: sampleHas('hex-void-cannon', 'SINGULARITY_SLUG'),
        validationState: 'VALIDATED',
        playerFacingReason: 'Ghost-Beam keeps breach fantasy on slug.',
      }),
    ],
    antiSynergies: [
      app({
        weaponFamilyId: 'hex-void-cannon',
        abilityId: 'SINGULARITY_SLUG',
        graftId: 'RICOCHET_DEFLECTOR_GRAFT',
        role: 'ANTI_SYNERGY',
        exactRuntimeInteraction: 'Random multi-hit competes with Pulse crowd role',
        tagsAdded: [],
        tagsRemoved: [],
        tagsReplaced: [],
        eventsAdded: [],
        eventsRemoved: [],
        meterEffect: 'Ammo still scarce',
        resourceEffect: 'Damage ×0.7',
        targetingEffect: '2 random hits',
        meaningfulUpside: 'Pseudo-AoE',
        meaningfulDownside: 'Identity collapse risk vs Pulse',
        phase3GDrawbackGuard: 'Must stay worse at crowds than Pulse',
        requiredClassRank: 3,
        availableWhenWeaponUnlocks: true,
        abilityInPhase3HSample: true,
        validationState: 'VALIDATED',
        playerFacingReason: 'Ricochet on Nullbreach is a high-risk crowd conversion.',
      }),
      app({
        weaponFamilyId: 'hex-void-cannon',
        abilityId: 'SINGULARITY_SLUG',
        graftId: 'SPLITTER_BARREL_GRAFT',
        role: 'ANTI_SYNERGY',
        exactRuntimeInteraction: 'Duplicate cast pushes group efficiency',
        tagsAdded: [],
        tagsRemoved: [],
        tagsReplaced: [],
        eventsAdded: [],
        eventsRemoved: [],
        meterEffect: 'Ammo ×2',
        resourceEffect: 'Heavy ammo',
        targetingEffect: 'Duplicate',
        meaningfulUpside: 'More hits',
        meaningfulDownside: 'Competes with Pulse without equal loss if not careful',
        phase3GDrawbackGuard: WEAPON_DRAWBACK_RECORDS['hex-void-cannon'].compensationMustNotErase,
        requiredClassRank: 3,
        availableWhenWeaponUnlocks: true,
        abilityInPhase3HSample: true,
        validationState: 'NEEDS_REVIEW',
        playerFacingReason: 'Splitter is alternate expression only with ammo loss retained.',
      }),
    ],
    configurations: [
      {
        kind: 'EARLY_IDENTITY',
        label: 'Ghost slug',
        requiredClassRank: 3,
        loadoutRef: 'IDENTITY_FORWARD',
        assignments: [
          {
            abilityId: 'SINGULARITY_SLUG',
            graftId: 'GHOST_BEAM_GRAFT',
            job: 'Armor pierce reinforce',
            tradeoff: '+1 AP',
          },
        ],
        preservesDrawback: 'Still single-target; small mag',
        playerFacingSummary: 'Ghost-Beam on Singularity Slug.',
      },
      {
        kind: 'MATURE_ALTERNATE',
        label: 'Neutron dump',
        requiredClassRank: 17,
        loadoutRef: 'ALTERNATE_COVERAGE',
        assignments: [
          {
            abilityId: 'SINGULARITY_SLUG',
            graftId: 'NEUTRON_SEAR_GRAFT',
            job: 'Empty-mag commitment spike',
            tradeoff: 'Consumes all ammo',
          },
          {
            abilityId: 'NULL_SPACE_CLOAK',
            graftId: 'SILENT_VOID_SUPPRESSOR',
            job: 'Survival after dump',
            tradeoff: 'Base damage −30% on cloak casts',
          },
        ],
        preservesDrawback: 'Not Pulse spread; dump is commitment',
        playerFacingSummary: 'Neutron sear + silent cloak recovery.',
      },
    ],
    unresolvedGaps: [],
  };

  const pulse: WeaponGraftRecommendationProfile = {
    weaponFamilyId: 'hex-pulse-rifle',
    classId: 'HEX_SHOT',
    validationState: 'VALIDATED',
    identitySummary: 'Spread cluster + ammo pressure',
    applications: [
      app({
        weaponFamilyId: 'hex-pulse-rifle',
        abilityId: 'ASH_JACKET_SALVO',
        graftId: 'HELL_FIRE_COMPENSATOR',
        role: 'IDENTITY_ANCHOR',
        exactRuntimeInteraction: 'Bleed tax on concentrated salvo — distinct from basic spread',
        tagsAdded: [],
        tagsRemoved: [],
        tagsReplaced: [],
        eventsAdded: ['ASH_SALVO_BURST'],
        eventsRemoved: [],
        meterEffect: 'Reload still required',
        resourceEffect: '10% HP cast tax',
        targetingEffect: 'Salvo targeting unchanged',
        meaningfulUpside: 'Crowd DoT',
        meaningfulDownside: 'HP cost',
        phase3GDrawbackGuard: WEAPON_DRAWBACK_RECORDS['hex-pulse-rifle'].compensationMustNotErase,
        requiredClassRank: 3,
        availableWhenWeaponUnlocks: true,
        abilityInPhase3HSample: sampleHas('hex-pulse-rifle', 'ASH_JACKET_SALVO'),
        validationState: 'VALIDATED',
        playerFacingReason: 'Hell-Fire on Salvo — not Widow-Choke single-target.',
      }),
    ],
    antiSynergies: [
      app({
        weaponFamilyId: 'hex-pulse-rifle',
        abilityId: 'ASH_JACKET_SALVO',
        graftId: 'WIDOW_CHOKE_GRAFT',
        role: 'ANTI_SYNERGY',
        exactRuntimeInteraction: 'AoE→ST conversion — identity inversion; must not redirect miss hits',
        tagsAdded: ['SINGLE_TARGET'],
        tagsRemoved: ['AOE'],
        tagsReplaced: [{ from: 'AOE', to: 'SINGLE_TARGET' }],
        eventsAdded: [],
        eventsRemoved: ['SPREAD_CLUSTER'],
        meterEffect: '—',
        resourceEffect: 'Damage ×2.5',
        targetingEffect: 'Forces single-target',
        meaningfulUpside: 'ST burst',
        meaningfulDownside: 'Becomes Nullbreach-adjacent',
        phase3GDrawbackGuard: 'Must not recreate Nullbreach armor specialist or redirect spread misses',
        requiredClassRank: 3,
        availableWhenWeaponUnlocks: true,
        abilityInPhase3HSample: true,
        validationState: 'VALIDATED',
        playerFacingReason: 'Widow-Choke on Ash/Pulse kit is identity inversion.',
      }),
    ],
    configurations: [
      {
        kind: 'EARLY_IDENTITY',
        label: 'Hell Salvo',
        requiredClassRank: 3,
        loadoutRef: 'IDENTITY_FORWARD',
        assignments: [
          {
            abilityId: 'ASH_JACKET_SALVO',
            graftId: 'HELL_FIRE_COMPENSATOR',
            job: 'Cluster bleed',
            tradeoff: 'HP tax',
          },
        ],
        preservesDrawback: 'Basic spread still ammo-hungry; no miss redirect',
        playerFacingSummary: 'Hell-Fire on Ash-Jacket Salvo only.',
      },
      {
        kind: 'MATURE_ALTERNATE',
        label: 'Splitter phospho',
        requiredClassRank: 17,
        loadoutRef: 'ALTERNATE_COVERAGE',
        assignments: [
          {
            abilityId: 'PHOSPHORUS_HEX',
            graftId: 'SPLITTER_BARREL_GRAFT',
            job: 'Extra crowd pressure',
            tradeoff: 'Ammo ×2',
          },
          {
            abilityId: 'ASH_JACKET_SALVO',
            graftId: 'HELL_FIRE_COMPENSATOR',
            job: 'Salvo DoT',
            tradeoff: 'HP tax',
          },
        ],
        preservesDrawback: 'Still weak vs isolated targets; Salvo ≠ basic spread',
        playerFacingSummary: 'Splitter phospho + hell salvo.',
      },
    ],
    unresolvedGaps: [],
  };

  return [sidearm, nullbreach, pulse];
}

function buildEnvoyProfiles(): WeaponGraftRecommendationProfile[] {
  const conduit: WeaponGraftRecommendationProfile = {
    weaponFamilyId: 'envoy-null-conduit',
    classId: 'ENVOY',
    validationState: 'VALIDATED',
    identitySummary: 'Clean Cycle + stable Flux sequencing',
    applications: [
      app({
        weaponFamilyId: 'envoy-null-conduit',
        abilityId: 'DIMENSIONAL_SHEAR',
        graftId: 'VOID_CONDUCTOR_GRAFT',
        role: 'METER_SUPPORT',
        exactRuntimeInteraction: 'Flux-tax damage on shear — rewards Clean Cycle sequencing',
        tagsAdded: [],
        tagsRemoved: [],
        tagsReplaced: [],
        eventsAdded: ['CLEAN_CATALYST_CYCLE', 'FLUX_CYCLE'],
        eventsRemoved: [],
        meterEffect: 'Higher Flux cost reinforces discipline',
        resourceEffect: '+20% Flux cost',
        targetingEffect: 'Unchanged',
        meaningfulUpside: 'Damage',
        meaningfulDownside: 'Flux pressure',
        phase3GDrawbackGuard: WEAPON_DRAWBACK_RECORDS['envoy-null-conduit'].compensationMustNotErase,
        requiredClassRank: 3,
        availableWhenWeaponUnlocks: true,
        abilityInPhase3HSample: sampleHas('envoy-null-conduit', 'DIMENSIONAL_SHEAR'),
        validationState: 'VALIDATED',
        playerFacingReason: 'Conductor on Shear — not free Catalyst force.',
      }),
    ],
    antiSynergies: [
      app({
        weaponFamilyId: 'envoy-null-conduit',
        abilityId: 'FLUX_PURGE',
        graftId: 'OVERLOAD_CATALYST_GRAFT',
        role: 'ANTI_SYNERGY',
        exactRuntimeInteraction: 'Forced Catalyst bypasses Clean Cycle decision',
        tagsAdded: [],
        tagsRemoved: [],
        tagsReplaced: [],
        eventsAdded: [],
        eventsRemoved: ['CLEAN_CATALYST_CYCLE'],
        meterEffect: 'Undermines sequencing',
        resourceEffect: 'See graft',
        targetingEffect: '—',
        meaningfulUpside: 'Burst',
        meaningfulDownside: 'Deletes starter Envoy fantasy',
        phase3GDrawbackGuard: 'Must not reach top burst without Clean Cycle',
        requiredClassRank: 3,
        availableWhenWeaponUnlocks: true,
        abilityInPhase3HSample: true,
        validationState: 'NEEDS_REVIEW',
        playerFacingReason: 'Overload Catalyst fights Clean Cycle.',
      }),
    ],
    configurations: [
      {
        kind: 'EARLY_IDENTITY',
        label: 'Conductor shear',
        requiredClassRank: 3,
        loadoutRef: 'IDENTITY_FORWARD',
        assignments: [
          {
            abilityId: 'DIMENSIONAL_SHEAR',
            graftId: 'VOID_CONDUCTOR_GRAFT',
            job: 'Sequenced damage',
            tradeoff: 'Flux tax',
          },
        ],
        preservesDrawback: 'Still needs Clean Cycle; not Prism brink',
        playerFacingSummary: 'Void-Conductor on Dimensional Shear.',
      },
      {
        kind: 'MATURE_ALTERNATE',
        label: 'Shear + step',
        requiredClassRank: 17,
        loadoutRef: 'ALTERNATE_COVERAGE',
        assignments: [
          {
            abilityId: 'ASTRAL_LANCE',
            graftId: 'SPLINTER_RUNE_GRAFT',
            job: 'Multi-hit chip',
            tradeoff: '×0.4 raw',
          },
          {
            abilityId: 'PHASE_STEP',
            graftId: 'GHOST_THREAD_GRAFT',
            job: 'Mobility flex',
            tradeoff: 'Graft downside',
          },
        ],
        preservesDrawback: 'No automatic Catalyst; Clean Cycle intact on basic',
        playerFacingSummary: 'Splinter lance + ghost step coverage.',
      },
    ],
    unresolvedGaps: ['CLEAN_CYCLE affinity has no dedicated graft tag adder'],
  };

  const lantern: WeaponGraftRecommendationProfile = {
    weaponFamilyId: 'envoy-echo-lantern',
    classId: 'ENVOY',
    validationState: 'VALIDATED',
    identitySummary: 'Rot setup → delayed FLUX_PURGE detonation',
    applications: [
      app({
        weaponFamilyId: 'envoy-echo-lantern',
        abilityId: 'FLUX_PURGE',
        graftId: 'WITHER_MARK_GRAFT',
        role: 'IDENTITY_ANCHOR',
        exactRuntimeInteraction: 'Purge cashout reinforcement — separate from basic Rot apply',
        tagsAdded: [],
        tagsRemoved: [],
        tagsReplaced: [],
        eventsAdded: ['ROT_DETONATION', 'FLUX_PURGE_ROUTE'],
        eventsRemoved: [],
        meterEffect: 'Delayed detonation preserved',
        resourceEffect: 'See graft',
        targetingEffect: 'Purge targeting',
        meaningfulUpside: 'Cashout power',
        meaningfulDownside: 'Graft tradeoff',
        phase3GDrawbackGuard: WEAPON_DRAWBACK_RECORDS['envoy-echo-lantern'].compensationMustNotErase,
        requiredClassRank: 3,
        availableWhenWeaponUnlocks: true,
        abilityInPhase3HSample: sampleHas('envoy-echo-lantern', 'FLUX_PURGE'),
        validationState: 'VALIDATED',
        playerFacingReason: 'Wither on Purge — never same-cast auto-detonate on basic.',
      }),
    ],
    antiSynergies: [
      app({
        weaponFamilyId: 'envoy-echo-lantern',
        abilityId: 'VEIL_SPLINTER',
        graftId: 'WITHER_MARK_GRAFT',
        role: 'ANTI_SYNERGY',
        exactRuntimeInteraction: 'Any same-resolution detonate on basic is hard identity violation',
        tagsAdded: [],
        tagsRemoved: [],
        tagsReplaced: [],
        eventsAdded: [],
        eventsRemoved: [],
        meterEffect: 'Would erase setup vs cashout choice',
        resourceEffect: '—',
        targetingEffect: '—',
        meaningfulUpside: 'None valid',
        meaningfulDownside: 'Immediate Rot detonation',
        phase3GDrawbackGuard: 'Must not detonate Rot applied in same basic resolution',
        requiredClassRank: 7,
        availableWhenWeaponUnlocks: true,
        abilityInPhase3HSample: true,
        validationState: 'VALIDATED',
        playerFacingReason: 'Do not graft detonation fantasy onto Lantern basic.',
      }),
    ],
    configurations: [
      {
        kind: 'EARLY_IDENTITY',
        label: 'Wither purge',
        requiredClassRank: 3,
        loadoutRef: 'IDENTITY_FORWARD',
        assignments: [
          {
            abilityId: 'FLUX_PURGE',
            graftId: 'WITHER_MARK_GRAFT',
            job: 'Delayed cashout',
            tradeoff: 'Graft downside',
          },
        ],
        preservesDrawback: 'Rot still applied by basic without same-cast detonate',
        playerFacingSummary: 'Wither-Mark on FLUX_PURGE only.',
      },
      {
        kind: 'MATURE_ALTERNATE',
        label: 'Miasma control',
        requiredClassRank: 17,
        loadoutRef: 'ALTERNATE_COVERAGE',
        assignments: [
          {
            abilityId: 'PARALYTIC_MIASMA',
            graftId: 'ECLIPSE_SIGIL_GRAFT',
            job: 'AoE control setup',
            tradeoff: 'Base damage −30%',
          },
          {
            abilityId: 'FLUX_PURGE',
            graftId: 'WITHER_MARK_GRAFT',
            job: 'Detonation route',
            tradeoff: 'Graft downside',
          },
        ],
        preservesDrawback: 'Still setup-dependent vs fast kills',
        playerFacingSummary: 'Eclipse miasma + wither purge.',
      },
    ],
    unresolvedGaps: [],
  };

  const prism: WeaponGraftRecommendationProfile = {
    weaponFamilyId: 'envoy-sanguine-prism',
    classId: 'ENVOY',
    validationState: 'VALIDATED',
    identitySummary: 'Brink Flux + capped HP sacrifice',
    applications: [
      app({
        weaponFamilyId: 'envoy-sanguine-prism',
        abilityId: 'FLESH_WARP',
        graftId: 'BLOOD_INK_GRAFT',
        role: 'IDENTITY_ANCHOR',
        exactRuntimeInteraction: 'True damage flex while basic keeps Brink/sacrifice rules',
        tagsAdded: [],
        tagsRemoved: [],
        tagsReplaced: [],
        eventsAdded: ['BRINK_FLUX', 'HP_SACRIFICE'],
        eventsRemoved: [],
        meterEffect: 'Does not refill Flux',
        resourceEffect: 'Self bleed',
        targetingEffect: 'Unchanged',
        meaningfulUpside: 'True damage',
        meaningfulDownside: 'Self bleed',
        phase3GDrawbackGuard: WEAPON_DRAWBACK_RECORDS['envoy-sanguine-prism'].compensationMustNotErase,
        requiredClassRank: 3,
        availableWhenWeaponUnlocks: true,
        abilityInPhase3HSample: sampleHas('envoy-sanguine-prism', 'FLESH_WARP'),
        validationState: 'VALIDATED',
        playerFacingReason: 'Blood-Ink on Flesh Warp — sacrifice on basic unchanged.',
      }),
    ],
    antiSynergies: [
      app({
        weaponFamilyId: 'envoy-sanguine-prism',
        abilityId: 'FLUX_PURGE',
        graftId: 'AETHER_VALVE_GRAFT',
        role: 'ANTI_SYNERGY',
        exactRuntimeInteraction: 'Restores Flux — fights Brink residual',
        tagsAdded: [],
        tagsRemoved: [],
        tagsReplaced: [],
        eventsAdded: [],
        eventsRemoved: ['BRINK_FLUX'],
        meterEffect: 'Pushes off Brink',
        resourceEffect: 'Flux restore',
        targetingEffect: '—',
        meaningfulUpside: 'Safer Flux',
        meaningfulDownside: 'Erases Brink plan',
        phase3GDrawbackGuard: 'Brink at ≤25% must remain a deliberate choice',
        requiredClassRank: 3,
        availableWhenWeaponUnlocks: true,
        abilityInPhase3HSample: true,
        validationState: 'VALIDATED',
        playerFacingReason: 'Aether-Valve refill conflicts with Brink.',
      }),
      app({
        weaponFamilyId: 'envoy-sanguine-prism',
        abilityId: 'FLESH_WARP',
        graftId: 'PARASITIC_SEAL_GRAFT',
        role: 'ANTI_SYNERGY',
        exactRuntimeInteraction: 'Lifesteal/heal can refund sacrifice risk',
        tagsAdded: [],
        tagsRemoved: [],
        tagsReplaced: [],
        eventsAdded: [],
        eventsRemoved: [],
        meterEffect: '—',
        resourceEffect: 'Heal + max HP tax',
        targetingEffect: '—',
        meaningfulUpside: 'Sustain',
        meaningfulDownside: 'May make sacrifice free',
        phase3GDrawbackGuard: 'Sacrifice must not be functionally free',
        requiredClassRank: 3,
        availableWhenWeaponUnlocks: true,
        abilityInPhase3HSample: true,
        validationState: 'VALIDATED',
        playerFacingReason: 'Parasitic heal on Prism flex risks free sacrifice.',
      }),
    ],
    configurations: [
      {
        kind: 'EARLY_IDENTITY',
        label: 'Blood warp',
        requiredClassRank: 3,
        loadoutRef: 'IDENTITY_FORWARD',
        assignments: [
          {
            abilityId: 'FLESH_WARP',
            graftId: 'BLOOD_INK_GRAFT',
            job: 'True-damage commit',
            tradeoff: 'Self bleed',
          },
        ],
        preservesDrawback: 'Basic still pays capped sacrifice; Brink ≤25% / ×1.2 / ×1.15 rules intact',
        playerFacingSummary: 'Blood-Ink on Flesh Warp.',
      },
      {
        kind: 'MATURE_ALTERNATE',
        label: 'Null state shear',
        requiredClassRank: 17,
        loadoutRef: 'ALTERNATE_COVERAGE',
        assignments: [
          {
            abilityId: 'DIMENSIONAL_SHEAR',
            graftId: 'NULL_STATE_GRAFT',
            job: '0 AP commit into Brink window',
            tradeoff: '40% Flux dump',
          },
          {
            abilityId: 'FLESH_WARP',
            graftId: 'BLOOD_INK_GRAFT',
            job: 'True damage',
            tradeoff: 'Self bleed',
          },
        ],
        preservesDrawback: 'Flux dump is risk toward Brink, not free refill; sacrifice still paid on basic',
        playerFacingSummary: 'Null-State shear + blood warp.',
      },
    ],
    unresolvedGaps: [],
  };

  return [conduit, lantern, prism];
}

const PROFILES: Record<WeaponFamilyId, WeaponGraftRecommendationProfile> = Object.fromEntries(
  [...buildAegisProfiles(), ...buildHexProfiles(), ...buildEnvoyProfiles()].map((p) => [
    p.weaponFamilyId,
    p,
  ]),
) as Record<WeaponFamilyId, WeaponGraftRecommendationProfile>;

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
  ALL_WEAPON_FAMILY_IDS.forEach((id) => {
    const p = PROFILES[id];
    if (!p) {
      issues.push(`Missing graft recommendation profile ${id}`);
      return;
    }
    if (p.classId !== getWeaponFamily(id).classId) issues.push(`${id} class mismatch`);
    if (p.configurations.length !== 2) issues.push(`${id} needs 2 configurations`);
    const early = p.configurations[0];
    if (early.assignments.length !== 1) issues.push(`${id} early config must be exactly 1 graft`);
    if (early.requiredClassRank !== 3) issues.push(`${id} early config must validate at rank 3`);
    const mature = p.configurations[1];
    if (mature.assignments.length < 1 || mature.assignments.length > 4) {
      issues.push(`${id} mature config must have 1–4 grafts`);
    }
    if (mature.requiredClassRank < 15) {
      issues.push(`${id} mature config rank must be >= 15 (got ${mature.requiredClassRank})`);
    }
    if (mature.requiredClassRank > 20) {
      issues.push(`${id} mature config rank exceeds CLASS_RANK_MAX`);
    }
  });
  return issues;
}
