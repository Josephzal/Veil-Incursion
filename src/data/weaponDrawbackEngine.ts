import type { WeaponFamilyId } from '../types/weapon';
import type { EnemyCombatProfile } from '../types/run';
import { getWeaponIdentityProfile } from './weaponIdentityProfiles';

/**
 * Phase 3G — structural drawback / weakness pass (enforced, not −5% fluff).
 * Boon weighting / graft rebalance deferred to 3H+.
 */
export interface WeaponDrawbackRecord {
  familyId: WeaponFamilyId;
  primaryStructuralWeakness: string;
  secondaryMatchupWeakness: string;
  mechanicalEnforcement: string;
  playerFacingSignal: string;
  amplifyBoonCategory: string;
  compensateBoonOrGraftCategory: string;
  compensationMustNotErase: string;
  testId: string;
}

export const WEAPON_DRAWBACK_RECORDS: Record<WeaponFamilyId, WeaponDrawbackRecord> = {
  'aegis-runed-longsword': {
    familyId: 'aegis-runed-longsword',
    primaryStructuralWeakness: 'Single-target melee only — no innate AoE or backline reach.',
    secondaryMatchupWeakness: 'Never best burst or hard control vs specialists.',
    mechanicalEnforcement: 'STRIKE basic always one target; no spread/column hits; mid Fracture/Reserve.',
    playerFacingSignal: 'Logs Steady Fracture strike; UI role Balanced fracture setup.',
    amplifyBoonCategory: 'Fracture / Reserve / melee sustain',
    compensateBoonOrGraftCategory: 'Reach / interrupt / secondary hit grafts',
    compensationMustNotErase: 'Must remain worse at burst and crowd clear than Claymore/Pulse specialists.',
    testId: 'drawback-longsword-single-target',
  },
  'aegis-rift-edge': {
    familyId: 'aegis-rift-edge',
    primaryStructuralWeakness: 'Weak baseline Fracture/armor pressure without earned tempo.',
    secondaryMatchupWeakness: 'Below-par damage until evade/parry arms Occult rider; tempo consumed once.',
    mechanicalEnforcement: 'occultRiderDamage=0 without riftEdgeTempoArmed; consumeTempo clears armed state; tempo does not persist across encounters.',
    playerFacingSignal: 'Cold cut log vs Tempo payoff — Occult rider armed.',
    amplifyBoonCategory: 'Evade / Parry / crit tempo',
    compensateBoonOrGraftCategory: 'Baseline damage grafts',
    compensationMustNotErase: 'Must still require a tempo event for Occult rider; no free perma-rider.',
    testId: 'drawback-rift-edge-tempo-gated',
  },
  'aegis-claymore-blade': {
    familyId: 'aegis-claymore-blade',
    primaryStructuralWeakness: 'High stamina commitment; little Reserve from ordinary chip hits.',
    secondaryMatchupWeakness: 'Poor vs evasive swarms and stamina pressure.',
    mechanicalEnforcement: 'staminaCost ≫ Longsword; chip reserveGain low; large Reserve only on Fracture-break cashout.',
    playerFacingSignal: 'Heavy Fracture commitment log; break cashout log.',
    amplifyBoonCategory: 'Stamina / Fracture break payoffs',
    compensateBoonOrGraftCategory: 'Stamina refund / multi-target light grafts',
    compensationMustNotErase: 'Chip hits must stay Reserve-poor vs break cashout.',
    testId: 'drawback-claymore-stamina-chip',
  },
  'hex-silver-core-sidearm': {
    familyId: 'hex-silver-core-sidearm',
    primaryStructuralWeakness: 'Poor AoE; limited innate armor pressure.',
    secondaryMatchupWeakness: 'Flexible but not the strongest specialist.',
    mechanicalEnforcement: 'PRECISION delivery — single hit; no innateArmorPressureLayers.',
    playerFacingSignal: 'Efficient ballistic / Execution window logs.',
    amplifyBoonCategory: 'Reload / Protocol / execute',
    compensateBoonOrGraftCategory: 'Pierce / multi-hit grafts',
    compensationMustNotErase: 'Must remain weaker at crowds than Pulse and weaker at armor than Nullbreach.',
    testId: 'drawback-sidearm-no-aoe',
  },
  'hex-void-cannon': {
    familyId: 'hex-void-cannon',
    primaryStructuralWeakness: 'Small magazine, high commitment, weak crowd handling.',
    secondaryMatchupWeakness: 'Inefficient vs low-value unarmored targets.',
    mechanicalEnforcement: 'BREACH single-target only; staminaCost; magazineSizeBonus negative; overcommit log when unarmored.',
    playerFacingSignal: 'Breach round armor pressure / overcommit risk logs.',
    amplifyBoonCategory: 'Armor break / heavy ballistic',
    compensateBoonOrGraftCategory: 'Magazine / stamina grafts',
    compensationMustNotErase: 'Must stay single-target; cannot become Pulse-like spread.',
    testId: 'drawback-nullbreach-crowd-and-mag',
  },
  'hex-pulse-rifle': {
    familyId: 'hex-pulse-rifle',
    primaryStructuralWeakness: 'Ammunition-hungry spread; poor isolated-target efficiency.',
    secondaryMatchupWeakness: 'Naturally weak when enemies are not clustered.',
    mechanicalEnforcement: 'SPREAD primary+≤2 adjacent; missing splash never redirects to primary; isolated → 1 hit.',
    playerFacingSignal: 'Spread finds only the primary — poor isolated precision.',
    amplifyBoonCategory: 'Reload / AoE ballistic',
    compensateBoonOrGraftCategory: 'Single-target damage grafts',
    compensationMustNotErase: 'Isolated fights must remain inefficient vs Sidearm/Nullbreach.',
    testId: 'drawback-pulse-isolated',
  },
  'envoy-null-conduit': {
    familyId: 'envoy-null-conduit',
    primaryStructuralWeakness: 'Safe/consistent but lower burst without Catalyst sequencing.',
    secondaryMatchupWeakness: 'Best output requires Clean Catalyst cycle (NULL/BLOOD → Splinter).',
    mechanicalEnforcement: 'cleanCatalystCycle false without previousCatalyst NULL/BLOOD; no sacrifice/Rot specialist payoffs.',
    playerFacingSignal: 'Clean Flux cycle vs Clean Catalyst cycle logs.',
    amplifyBoonCategory: 'Flux gen / Catalyst',
    compensateBoonOrGraftCategory: 'Raw occult damage grafts',
    compensationMustNotErase: 'Must still reward sequencing — no automatic always-on Clean Cycle.',
    testId: 'drawback-conduit-needs-sequence',
  },
  'envoy-echo-lantern': {
    familyId: 'envoy-echo-lantern',
    primaryStructuralWeakness: 'Low immediate damage; setup time before Rot pays off.',
    secondaryMatchupWeakness: 'Lost value when targets die or cleanse before detonation.',
    mechanicalEnforcement: 'Basic applies Rot only (no same-cast detonate); payoff via FLUX_PURGE/Catalytic; reduced occultDamage.',
    playerFacingSignal: 'Echo brand setup log; Flux-Purge Rot siphon detonation log.',
    amplifyBoonCategory: 'Debuff duration / Rot / Flux dump',
    compensateBoonOrGraftCategory: 'Immediate damage grafts',
    compensationMustNotErase: 'Basic must never auto-detonate the Rot it just applied.',
    testId: 'drawback-lantern-setup-delay',
  },
  'envoy-sanguine-prism': {
    familyId: 'envoy-sanguine-prism',
    primaryStructuralWeakness: 'Real HP attrition each basic; depends on reaching Brink Flux.',
    secondaryMatchupWeakness: 'No sacrifice-dependent bonus if full HP cost cannot be paid.',
    mechanicalEnforcement: 'hpSacrifice charged once; sacrificePaidFully gates payoff; never kills; healReceivedPct penalty on weapon.',
    playerFacingSignal: 'Brink / Blood price / payoff withheld logs.',
    amplifyBoonCategory: 'Sacrifice / Flux dump / Brink',
    compensateBoonOrGraftCategory: 'Heal / sustain grafts',
    compensationMustNotErase: 'Must still pay HP for full sacrifice payoff; healReceivedPct must remain punitive.',
    testId: 'drawback-prism-hp-and-brink',
  },
};

export function getWeaponDrawbackRecord(id: WeaponFamilyId): WeaponDrawbackRecord {
  return WEAPON_DRAWBACK_RECORDS[id];
}

/** Soft targeting hint used by UI/logs — Nullbreach overcommit on trash. */
export function nullbreachOvercommitPenalty(
  target: EnemyCombatProfile | null | undefined,
): { inefficient: boolean; note: string | null } {
  if (!target) return { inefficient: true, note: null };
  const armored = (target.kineticArmor ?? 0) > 0;
  const elite = (target.maxHp ?? 0) >= 80 || Boolean((target as { isBoss?: boolean }).isBoss);
  if (!armored && !elite) {
    return {
      inefficient: true,
      note: '[NULLBREACH] >> Overcommit — low-value unarmored target.',
    };
  }
  return { inefficient: false, note: null };
}

export function formatWeaponDrawbackDebug(id: WeaponFamilyId): string {
  const d = WEAPON_DRAWBACK_RECORDS[id];
  const p = getWeaponIdentityProfile(id);
  return [
    `weapon=${id}`,
    `primary=${d.primaryStructuralWeakness}`,
    `secondary=${d.secondaryMatchupWeakness}`,
    `enforce=${d.mechanicalEnforcement}`,
    `ui=${d.playerFacingSignal}`,
    `identityDrawback=${p.drawbackSummary}`,
  ].join(' // ');
}
