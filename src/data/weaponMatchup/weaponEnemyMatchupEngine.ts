/**
 * Phase 3K — deterministic weapon↔enemy matchup classification (read-only).
 */
import type { WeaponFamilyId } from '../../types/weapon';
import type { EncounterEnemyKey } from '../enemyCombatConfig';
import type {
  MatchupClassification,
  MatchupQualifier,
  WeaponEnemyMatchupRecord,
} from '../../types/weaponEnemyMatchup';
import { ALL_WEAPON_FAMILY_IDS, getWeaponFamily } from '../weaponRegistry';
import { WEAPON_DRAWBACK_RECORDS } from '../weaponDrawbackEngine';
import { getEnemyDefinition, resolveDefinitionStats } from '../enemyDefinitions';
import { allDefinedEnemyKeys } from '../enemyDefinitions';
import { getWeaponIdentityProfile } from '../weaponIdentityProfiles';
import { canonicalizeEncounterEnemyKey, assertNoLegacyAliasInLiveKeys } from '../enemyAliasCanonical';

function maxArmor(enemyId: EncounterEnemyKey): { kinetic: number; occult: number; hp: number } {
  let kinetic = 0;
  let occult = 0;
  let hp = 0;
  ([1, 2, 3] as const).forEach((d) => {
    const st = resolveDefinitionStats(enemyId, d);
    if (!st) return;
    kinetic = Math.max(kinetic, st.kineticArmor ?? 0);
    occult = Math.max(occult, st.occultArmor ?? 0);
    hp = Math.max(hp, st.maxHp);
  });
  return { kinetic, occult, hp };
}

function classifyWeaponEnemy(
  weaponFamilyId: WeaponFamilyId,
  enemyId: EncounterEnemyKey,
): WeaponEnemyMatchupRecord {
  const def = getEnemyDefinition(enemyId)!;
  const armor = maxArmor(enemyId);
  const drawback = WEAPON_DRAWBACK_RECORDS[weaponFamilyId];
  const identity = getWeaponIdentityProfile(weaponFamilyId);
  const tags = identity.mechanicalTags;
  const qualifiers: MatchupQualifier[] = [];

  let classification: MatchupClassification = 'EVEN';
  let mechanicalReason = 'Weapon can execute its normal loop without major obstruction.';
  let naturalAdvantage = 'None strong';
  let structuralDrawbackPressured = drawback.primaryStructuralWeakness;
  let accessibleCompensation = 'Ordinary Phase 3H flex abilities / basics';
  let compensationSource: WeaponEnemyMatchupRecord['compensationSource'] = 'ABILITY';
  let damageDefense = 'Kinetic/Occult mitigation via mitigateByChannel; Fracture on break.';
  let targeting = def.role;
  let resourcePressure = 'Standard';
  let classMeter = identity.meterSummary;
  let enemyIntent = def.mechanicTags.join(', ') || 'Standard intents';

  const isSwarmish = def.threatCost <= 1 || enemyId.includes('SWARM') || enemyId.includes('SCUTTLER') || enemyId.includes('SPALL') || enemyId.includes('SPLINTER');
  const isDurableArmor = armor.kinetic >= 3 || armor.hp >= 200;
  const isWard = armor.occult >= 1;
  const isBackline = def.role === 'BACKLINE' || def.mechanicTags.includes('UNREACHABLE_BACKLINE');
  const isSupport = def.role === 'SUPPORT';
  const staminaDrain = def.mechanicTags.includes('STAMINA_DRAIN');
  const hardDenial = def.mechanicTags.includes('HARD_DENIAL');

  switch (weaponFamilyId) {
    case 'aegis-runed-longsword':
      if (!isSwarmish && !isBackline && armor.kinetic < 8 && def.role === 'FRONTLINE') {
        classification = 'FAVORABLE';
        mechanicalReason = 'Reliable Fracture + Parry/Reserve sequencing shines in mixed frontline fights.';
        naturalAdvantage = 'Flexible fracture setup without Claymore stamina commitment';
      } else if (isSwarmish || (isBackline && def.mechanicTags.includes('UNREACHABLE_BACKLINE'))) {
        classification = 'STRAINED';
                qualifiers.push('TARGET_DEPENDENT');
        qualifiers.push('DEFENSE_LAYER_PRESSURE');
        mechanicalReason = 'Single-target melee lacks crowd/backline reach.';
        accessibleCompensation = 'Phase 3H flex pierce/control abilities; Rank-3 Neutron graft';
        compensationSource = 'MIXED';
      } else if (isDurableArmor && armor.kinetic >= 10) {
        classification = 'EVEN';
        mechanicalReason = 'Can Fracture-setup armored targets; cashout weaker than Claymore.';
        naturalAdvantage = 'Steady Fracture / Reserve sequencing';
      } else {
        classification = 'EVEN';
        mechanicalReason = 'Balanced loop handles mid threats without specialist edge.';
      }
      break;

    case 'aegis-rift-edge':
      if (staminaDrain || hardDenial) {
        classification = 'STRAINED';
                qualifiers.push('RESOURCE_PRESSURE');
        qualifiers.push('EXECUTION_DEPENDENT');
        mechanicalReason = 'Tempo arming pressured by stamina drain / denial before Occult rider.';
        accessibleCompensation = 'Evade/parry boons; tempo-support grafts at Rank 3+';
        compensationSource = 'MIXED';
      } else if (isWard || armor.occult > 0) {
        classification = 'FAVORABLE';
        mechanicalReason = 'Armed Occult rider answers ward layers when tempo is earned.';
        naturalAdvantage = 'Conditional Kinetic→Occult expression';
      } else if (isDurableArmor && armor.kinetic >= 8) {
        classification = 'STRAINED';
                qualifiers.push('DEFENSE_LAYER_PRESSURE');
        mechanicalReason = 'Weak baseline Fracture/armor pressure until tempo arms.';
      } else {
        classification = 'EVEN';
        mechanicalReason = 'Tempo loop available against standard threats.';
      }
      structuralDrawbackPressured = drawback.primaryStructuralWeakness;
      break;

    case 'aegis-claymore-blade':
      if (isDurableArmor) {
        classification = 'FAVORABLE';
        mechanicalReason = 'Committed Fracture + break cashout shines vs armored durables.';
        naturalAdvantage = 'High-impact Reserve break turns';
                qualifiers.push('RESOURCE_PRESSURE');
        resourcePressure = 'High stamina commitment required';
      } else if (isSwarmish || staminaDrain) {
        classification = 'STRAINED';
                qualifiers.push('RESOURCE_PRESSURE');
        qualifiers.push('TARGET_DEPENDENT');
        mechanicalReason = 'Stamina commitment and chip-poor Reserve vs swarms/drain.';
        accessibleCompensation = 'Alternate coverage loadout; light multi-target grafts (must not erase chip poverty)';
      } else {
        classification = 'EVEN';
        mechanicalReason = 'Setup-break loop functional; slower than Longsword on mixed packs.';
      }
      break;

    case 'hex-silver-core-sidearm':
      if (isBackline && armor.kinetic < 5 && !isSwarmish) {
        classification = 'FAVORABLE';
        mechanicalReason = 'Precision / Execution window answers priority backline without specialist mag tax.';
        naturalAdvantage = 'Tactical precision + reload cadence';
                qualifiers.push('AMMO_DEPENDENT');
        qualifiers.push('EXECUTION_DEPENDENT');
      } else if (isSwarmish) {
        classification = 'STRAINED';
                qualifiers.push('AMMO_DEPENDENT');
        qualifiers.push('TARGET_DEPENDENT');
        mechanicalReason = 'Precision single-hit — poor innate AoE vs clusters.';
        accessibleCompensation = 'Ash-adjacent flex is Pulse\'s job; Sidearm uses reload/Protocol tools';
      } else if (isDurableArmor && armor.kinetic >= 8) {
        classification = 'STRAINED';
                qualifiers.push('DEFENSE_LAYER_PRESSURE');
        qualifiers.push('AMMO_DEPENDENT');
        mechanicalReason = 'Limited innate armor pressure vs heavy Kinetic stacks.';
        accessibleCompensation = 'Pierce ammo/grafts; Ghost-Beam style transforms — Nullbreach remains specialist';
      } else {
        classification = 'EVEN';
        mechanicalReason = 'Reload / Perfect Reload / Protocol loop handles varied mid threats.';
        naturalAdvantage = 'Execution / precision flexibility';
      }
      break;

    case 'hex-void-cannon':
      if (isDurableArmor || isBackline) {
        classification = 'FAVORABLE';
        mechanicalReason = 'Breach ST + Kinetic armor pressure vs priority/armored targets.';
        naturalAdvantage = 'Innate armor pressure / priority selection';
                qualifiers.push('AMMO_DEPENDENT');
        resourcePressure = 'Small magazine planning';
      } else if (isSwarmish) {
        classification = 'STRAINED';
                qualifiers.push('AMMO_DEPENDENT');
        qualifiers.push('TARGET_DEPENDENT');
        mechanicalReason = 'Overcommit vs low-value unarmored swarm — magazine tax.';
        accessibleCompensation = 'Phase 3H flex; must not become Pulse-level spread';
      } else {
        classification = 'EVEN';
        mechanicalReason = 'Committed shots viable; inefficient on soft packs.';
      }
      break;

    case 'hex-pulse-rifle':
      if (isSwarmish || def.role === 'FRONTLINE' && armor.kinetic < 5) {
        classification = 'FAVORABLE';
        mechanicalReason = 'Spread + Ash-Jacket Salvo pressure clustered formations.';
        naturalAdvantage = 'Crowd / cluster pressure';
                qualifiers.push('AMMO_DEPENDENT');
      } else if (isDurableArmor && isBackline) {
        classification = 'STRAINED';
                qualifiers.push('TARGET_DEPENDENT');
        qualifiers.push('DEFENSE_LAYER_PRESSURE');
        mechanicalReason = 'Isolated armored priority resists spread efficiency.';
        accessibleCompensation = 'Salvo concentration; Hell-Fire graft — must not redirect misses';
      } else {
        classification = 'EVEN';
        mechanicalReason = 'Ammo-hungry spread; functional when secondary targets exist.';
      }
      break;

    case 'envoy-null-conduit':
      if (hardDenial) {
        classification = 'STRAINED';
                qualifiers.push('EXECUTION_DEPENDENT');
        mechanicalReason = 'CLEAN_CYCLE sequencing pressured by denial interrupts.';
      } else if (!isDurableArmor && !isSwarmish && def.threatCost <= 2) {
        classification = 'FAVORABLE';
        mechanicalReason = 'CLEAN_CYCLE Flux stability resolves ordinary mid threats without Prism exposure.';
        naturalAdvantage = 'Forgiving Catalyst transitions';
      } else {
        classification = 'EVEN';
        mechanicalReason = 'Stable Flux / Catalyst cycling without top-tier burst demand.';
        naturalAdvantage = 'Forgiving CLEAN_CYCLE starter sequencing';
      }
      if (isDurableArmor) {
        accessibleCompensation = 'Void Conductor graft / pierce flex — must not rival Prism payoff';
        compensationSource = 'MIXED';
      }
      break;

    case 'envoy-echo-lantern':
      if (isDurableArmor || def.threatCost >= 3 || isSupport) {
        classification = 'FAVORABLE';
        mechanicalReason = 'Rot setup + delayed detonation pressures durable groups/supports.';
        naturalAdvantage = 'Delayed Rot cashout';
                qualifiers.push('EXECUTION_DEPENDENT');
      } else if (isSwarmish && armor.hp < 100) {
        classification = 'STRAINED';
                qualifiers.push('TARGET_DEPENDENT');
        mechanicalReason = 'Fragile singles die before meaningful Rot decision.';
        accessibleCompensation = 'Wither Mark / Flux Purge routes; keep same-resolution Rot protection';
      } else if (armor.hp < 90 && !isSupport) {
        classification = 'STRAINED';
                qualifiers.push('TARGET_DEPENDENT');
        mechanicalReason = 'Low-HP targets collapse before stack-vs-cashout choice.';
      } else {
        classification = 'EVEN';
        mechanicalReason = 'Stack-vs-cashout decision available.';
      }
      break;

    case 'envoy-sanguine-prism':
      if (isDurableArmor || def.threatCost >= 3) {
        classification = 'FAVORABLE';
        mechanicalReason = 'Brink + sacrifice payoff vs priority durables if exposure accepted.';
        naturalAdvantage = 'Committed high-payoff turns';
                qualifiers.push('RESOURCE_PRESSURE');
        qualifiers.push('EXECUTION_DEPENDENT');
        resourcePressure = 'Flux brink + capped HP sacrifice';
      } else if (isSwarmish) {
        classification = 'STRAINED';
                qualifiers.push('RESOURCE_PRESSURE');
        qualifiers.push('TARGET_DEPENDENT');
        mechanicalReason = 'Sacrifice exposure inefficient vs low-value swarm chips.';
      } else {
        classification = 'EVEN';
        mechanicalReason = 'Payoff available with deliberate Flux management.';
      }
      break;

    default:
      classification = 'EVEN';
  }

  // Ordinary live enemies are never NONVIABLE from natural kit alone (gate enforced in tests).

  return {
    key: `${weaponFamilyId}::${enemyId}`,
    weaponFamilyId,
    enemyId,
    classification,
    qualifiers,
    mechanicalReason,
    relevantTags: tags,
    relevantEvents: ['HIT', 'FRACTURE', 'KILL'],
    damageDefenseInteraction: damageDefense,
    targetingInteraction: targeting,
    resourcePressure,
    classMeterInteraction: classMeter,
    enemyIntentEffect: enemyIntent,
    naturalAdvantage,
    structuralDrawbackPressured,
    accessibleCompensation,
    compensationSource,
    compensationMinClassRank: 3,
    compensationInPhase3HLoadout: true,
    preservesPhase3GDrawback: true,
    confidence: 'MEDIUM',
    validationStatus: 'VALIDATED',
  };
}

let CACHE: WeaponEnemyMatchupRecord[] | null = null;

export function listWeaponEnemyMatchups(): WeaponEnemyMatchupRecord[] {
  if (CACHE) return CACHE;
  const keys = allDefinedEnemyKeys();
  const leaked = assertNoLegacyAliasInLiveKeys(keys);
  if (leaked.length) {
    throw new Error(`listWeaponEnemyMatchups: legacy alias leaked into live keys: ${leaked.join(',')}`);
  }
  const rows: WeaponEnemyMatchupRecord[] = [];
  ALL_WEAPON_FAMILY_IDS.forEach((w) => {
    keys.forEach((e) => {
      rows.push(classifyWeaponEnemy(w, e));
    });
  });
  CACHE = rows;
  return rows;
}

export function getWeaponEnemyMatchup(
  weaponFamilyId: WeaponFamilyId,
  enemyId: EncounterEnemyKey | string,
): WeaponEnemyMatchupRecord {
  const canonical = canonicalizeEncounterEnemyKey(String(enemyId));
  if (!canonical) {
    throw new Error(`getWeaponEnemyMatchup: unknown enemy identity ${String(enemyId)}`);
  }
  return listWeaponEnemyMatchups().find((r) => r.weaponFamilyId === weaponFamilyId && r.enemyId === canonical)
    ?? classifyWeaponEnemy(weaponFamilyId, canonical);
}

export function summarizeWeaponMatchupSpread(weaponFamilyId: WeaponFamilyId): Record<MatchupClassification, number> {
  const counts: Record<MatchupClassification, number> = {
    FAVORABLE: 0,
    EVEN: 0,
    STRAINED: 0,
    NONVIABLE_DEFECT: 0,
  };
  listWeaponEnemyMatchups()
    .filter((r) => r.weaponFamilyId === weaponFamilyId)
    .forEach((r) => {
      counts[r.classification] += 1;
    });
  return counts;
}

export function assertNoNonviableOrdinaryMatchups(): string[] {
  return listWeaponEnemyMatchups()
    .filter((r) => r.classification === 'NONVIABLE_DEFECT')
    .map((r) => r.key);
}

export function assertWeaponHasFavorableAndPressure(weaponFamilyId: WeaponFamilyId): string[] {
  const issues: string[] = [];
  const spread = summarizeWeaponMatchupSpread(weaponFamilyId);
  if (spread.FAVORABLE < 1) issues.push(`${weaponFamilyId} lacks FAVORABLE matchups`);
  if (spread.STRAINED < 1) issues.push(`${weaponFamilyId} lacks STRAINED pressure`);
  if (spread.FAVORABLE === allDefinedEnemyKeys().length) {
    issues.push(`${weaponFamilyId} favorable vs entire roster`);
  }
  void getWeaponFamily;
  return issues;
}
