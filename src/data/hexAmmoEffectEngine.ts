/**
 * Hex Shot ammo-effect pipeline (v1 refactor).
 *
 * Centralized, pure computation of what the current ammo type does to a BALLISTIC
 * hit. The combat hub feeds primitive facts about the hit + target and receives a
 * structured effect plan (damage modifiers + secondary effects). The hub is
 * responsible for actually applying strips/AP-reduction/marks through the existing
 * armor/ward/AP/debuff systems.
 *
 * Per-cast caps (armor/ward strip once per cast, AP reduction ≤ 2 per target per
 * cast) are enforced via a caller-owned tracker so multi-hit abilities can't abuse
 * powerful effects.
 */

import { HEX_MAGAZINE_CONFIG, type HexAmmoType } from '../types/hexAmmo';

export interface HexAmmoCastTracker {
  strippedArmor: boolean;
  strippedWard: boolean;
  apReducedByTarget: Record<string, number>;
}

export function createHexAmmoCastTracker(): HexAmmoCastTracker {
  return { strippedArmor: false, strippedWard: false, apReducedByTarget: {} };
}

export interface HexAmmoEffectInput {
  ammoType: HexAmmoType;
  /** ARMOR_PIERCE-tagged or otherwise flagged heavy shot. */
  isHeavyShot: boolean;
  /** 0-based hit index for multi-hit abilities. */
  hitIndex: number;
  isBackline: boolean;
  isBoss: boolean;
  targetId: string;
  targetHasKineticArmor: boolean;
  targetHasOccultWard: boolean;
  targetHasVoidMark: boolean;
  /** Target is charging / lock-on / sniping / artillery / telegraphing. */
  targetTelegraphing: boolean;
  /** Perfect-reload Overcharged first shot is being consumed by this cast. */
  overcharged: boolean;
  /** Boon: Silver Discipline — first Silver-Core shot after Perfect reload strips +1 armor / +15 Fracture. */
  boonSilverDiscipline?: boolean;
  /** Boon: Wraithglass Etching — Wraithglass hit vs Void-Marked target adds +8 Occult. */
  boonWraithglassEtching?: boolean;
  /** Boon: Cold Chamber — first Stasis-Lock shot after Perfect reload applies AP −2 instead of −1. */
  boonColdChamber?: boolean;
  tracker: HexAmmoCastTracker;
}

export interface HexAmmoEffectResult {
  /** Multiplier on the outgoing damage packet (e.g. Stasis-Lock −20%). */
  damageMultiplier: number;
  /** Flat OCCULT damage added (Wraithglass fallback rider). */
  flatOccultBonus: number;
  /** Fraction of BALLISTIC damage re-typed to OCCULT (Wraithglass). */
  occultConversionPct: number;
  /** Fracture bonus % (Silver-Core). */
  fractureBonusPct: number;
  /** Flat Fracture points added (Silver-Core Overcharged rider). */
  flatFractureBonus: number;
  /** Extra damage % vs backline (Wraithglass). */
  backlineBonusPct: number;
  stripArmor: boolean;
  stripWard: boolean;
  /** AP to remove from target this hit (already capped). */
  apReduction: number;
  applyVoidMark: boolean;
  voidMarkTurns: number;
  applyStasisLock: boolean;
  stasisTurns: number;
  /** Weaken/interrupt a telegraphed incoming attack. */
  interruptIntent: boolean;
  notes: string[];
}

function emptyResult(): HexAmmoEffectResult {
  return {
    damageMultiplier: 1,
    flatOccultBonus: 0,
    occultConversionPct: 0,
    fractureBonusPct: 0,
    flatFractureBonus: 0,
    backlineBonusPct: 0,
    stripArmor: false,
    stripWard: false,
    apReduction: 0,
    applyVoidMark: false,
    voidMarkTurns: 0,
    applyStasisLock: false,
    stasisTurns: 0,
    interruptIntent: false,
    notes: [],
  };
}

/** Remaining AP reduction allowed for a target this cast, given the cap. */
function remainingApBudget(tracker: HexAmmoCastTracker, targetId: string): number {
  const used = tracker.apReducedByTarget[targetId] ?? 0;
  return Math.max(0, HEX_MAGAZINE_CONFIG.maxApReductionPerTargetPerCast - used);
}

export function applyHexAmmoEffect(input: HexAmmoEffectInput): HexAmmoEffectResult {
  const cfg = HEX_MAGAZINE_CONFIG;
  const out = emptyResult();

  switch (input.ammoType) {
    case 'SILVER_CORE': {
      out.fractureBonusPct = cfg.silverFractureBonusPct;
      // Heavy/AP shots crack one layer of Kinetic Armor (once per cast).
      if (
        input.isHeavyShot
        && input.targetHasKineticArmor
        && !input.tracker.strippedArmor
      ) {
        out.stripArmor = true;
        out.notes.push('SILVER-CORE // 1 Kinetic Armor cracked');
      }
      if (input.overcharged) {
        out.flatFractureBonus += 10;
        out.notes.push('OVERCHARGED // +10 Fracture');
        // Silver Discipline: first Silver-Core shot after a Perfect reload.
        if (input.boonSilverDiscipline) {
          out.flatFractureBonus += 15;
          if (input.targetHasKineticArmor && !input.tracker.strippedArmor) {
            out.stripArmor = true;
          }
          out.notes.push('SILVER DISCIPLINE // +15 Fracture');
        }
      }
      break;
    }

    case 'WRAITHGLASS': {
      out.occultConversionPct = cfg.wraithglassOccultConversionPct;
      out.flatOccultBonus = cfg.wraithglassFlatOccult;
      out.applyVoidMark = true;
      out.voidMarkTurns = cfg.wraithglassVoidMarkTurns + (input.overcharged ? 1 : 0);
      if (input.isBackline) out.backlineBonusPct = cfg.wraithglassBacklineDamagePct;
      // Wraithglass Etching: bonus Occult when the target is already Void-Marked.
      if (input.boonWraithglassEtching && input.targetHasVoidMark) {
        out.flatOccultBonus += 8;
        out.notes.push('WRAITHGLASS ETCHING // +8 Occult');
      }
      // Heavy shots strip an Occult Ward (once per cast).
      if (
        input.isHeavyShot
        && input.targetHasOccultWard
        && !input.tracker.strippedWard
      ) {
        out.stripWard = true;
        out.notes.push('WRAITHGLASS // 1 Occult Ward pierced');
      }
      out.notes.push(input.overcharged ? 'OVERCHARGED // Void-Mark +1 turn' : 'WRAITHGLASS // Void-Marked');
      break;
    }

    case 'STASIS_LOCK': {
      out.damageMultiplier = 1 - cfg.stasisDamagePenaltyPct / 100;
      out.applyStasisLock = true;
      out.stasisTurns = cfg.stasisLockedTurns;
      let desiredAp: number = input.isHeavyShot ? cfg.stasisApReductionHeavy : cfg.stasisApReductionNormal;
      if (input.overcharged) desiredAp += 1;
      // Cold Chamber: first Stasis-Lock shot after Perfect reload applies AP −2 min.
      if (input.overcharged && input.boonColdChamber) {
        desiredAp = Math.max(desiredAp, cfg.stasisApReductionHeavy);
      }
      const budget = remainingApBudget(input.tracker, input.targetId);
      out.apReduction = Math.min(desiredAp, budget);
      if (input.targetTelegraphing) {
        // Bosses are weakened/delayed, never skipped.
        out.interruptIntent = true;
        out.notes.push(input.isBoss ? 'STASIS-LOCK // intent weakened' : 'STASIS-LOCK // intent interrupted');
      }
      if (out.apReduction > 0) out.notes.push(`STASIS-LOCK // −${out.apReduction} AP`);
      break;
    }

    default:
      break;
  }

  return out;
}

/** Record applied effects into the cast tracker (caller invokes after applying). */
export function recordHexAmmoEffect(
  tracker: HexAmmoCastTracker,
  targetId: string,
  result: HexAmmoEffectResult,
): void {
  if (result.stripArmor) tracker.strippedArmor = true;
  if (result.stripWard) tracker.strippedWard = true;
  if (result.apReduction > 0) {
    tracker.apReducedByTarget[targetId] = (tracker.apReducedByTarget[targetId] ?? 0) + result.apReduction;
  }
}
