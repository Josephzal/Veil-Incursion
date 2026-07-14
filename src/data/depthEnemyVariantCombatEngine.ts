import type { EnemyCombatProfile } from '../types/run';
import type { EnemyRosterId } from './enemyRoster';
import {
  ANCHOR_HUSK_ALLY_DAMAGE_BONUS,
  PHASE_SCUTTLER_ACCURACY_PENALTY,
  STATIC_CALLER_MELEE_STAMINA_MULT,
  TAR_CHOIR_MARK_DAMAGE_BONUS,
  WEEPING_FRACTURE_PULSE_DAMAGE,
} from './depthEnemyVariantCatalog';

export interface DepthVariantCombatRuntime {
  tarChoirMarkActive: boolean;
  phaseScuttlerAccuracyPenaltyUnitIds: Set<string>;
  weepingPulseUsedUnitIds: Set<string>;
}

export function createDepthVariantCombatRuntime(): DepthVariantCombatRuntime {
  return {
    tarChoirMarkActive: false,
    phaseScuttlerAccuracyPenaltyUnitIds: new Set(),
    weepingPulseUsedUnitIds: new Set(),
  };
}

export function squadHasStaticCaller(squad: readonly Pick<EnemyCombatProfile, 'rosterId' | 'currentHp'>[]): boolean {
  return squad.some((unit) => unit.currentHp > 0 && unit.rosterId === 'static-caller');
}

export function resolveStaticCallerMeleeStaminaMultiplier(
  squad: readonly Pick<EnemyCombatProfile, 'rosterId' | 'currentHp'>[],
): number {
  return squadHasStaticCaller(squad) ? STATIC_CALLER_MELEE_STAMINA_MULT : 1;
}

export function resolveAnchorHuskAllyDamageMultiplier(
  squad: readonly Pick<EnemyCombatProfile, 'rosterId' | 'currentHp' | 'unitId'>[],
  attackerUnitId: string | undefined,
): number {
  const huskAlive = squad.some(
    (unit) => unit.rosterId === 'anchor-husk' && unit.currentHp > 0 && unit.unitId !== attackerUnitId,
  );
  return huskAlive ? 1 + ANCHOR_HUSK_ALLY_DAMAGE_BONUS : 1;
}

export function resolveTarChoirOutgoingDamageMultiplier(runtime: DepthVariantCombatRuntime): number {
  return runtime.tarChoirMarkActive ? 1 + TAR_CHOIR_MARK_DAMAGE_BONUS : 1;
}

export function consumeTarChoirMark(runtime: DepthVariantCombatRuntime): DepthVariantCombatRuntime {
  if (!runtime.tarChoirMarkActive) return runtime;
  return { ...runtime, tarChoirMarkActive: false };
}

export function markTarChoirOnHit(
  runtime: DepthVariantCombatRuntime,
  rosterId: EnemyRosterId | string | undefined,
): { runtime: DepthVariantCombatRuntime; logLine: string | null } {
  if (rosterId !== 'tar-choir') {
    return { runtime, logLine: null };
  }
  return {
    runtime: { ...runtime, tarChoirMarkActive: true },
    logLine: '>> TAR CHOIR — operative marked. Next Veil strike bites harder.',
  };
}

export function applyPhaseScuttlerHitReaction(
  runtime: DepthVariantCombatRuntime,
  unit: Pick<EnemyCombatProfile, 'rosterId' | 'unitId' | 'currentHp'>,
): { runtime: DepthVariantCombatRuntime; evadeActive: boolean; logLine: string | null } {
  if (unit.rosterId !== 'phase-scuttler' || !unit.unitId || unit.currentHp <= 0) {
    return { runtime, evadeActive: false, logLine: null };
  }
  const next = new Set(runtime.phaseScuttlerAccuracyPenaltyUnitIds);
  next.add(unit.unitId);
  return {
    runtime: { ...runtime, phaseScuttlerAccuracyPenaltyUnitIds: next },
    evadeActive: true,
    logLine: '>> PHASE SCUTTLER — silhouette folds out of phase.',
  };
}

export function resolvePhaseScuttlerAccuracyMultiplier(
  runtime: DepthVariantCombatRuntime,
  targetUnitId: string | undefined,
): number {
  if (!targetUnitId || !runtime.phaseScuttlerAccuracyPenaltyUnitIds.has(targetUnitId)) return 1;
  return 1 - PHASE_SCUTTLER_ACCURACY_PENALTY;
}

export function clearPhaseScuttlerPenalty(
  runtime: DepthVariantCombatRuntime,
  targetUnitId: string | undefined,
): DepthVariantCombatRuntime {
  if (!targetUnitId || !runtime.phaseScuttlerAccuracyPenaltyUnitIds.has(targetUnitId)) {
    return runtime;
  }
  const next = new Set(runtime.phaseScuttlerAccuracyPenaltyUnitIds);
  next.delete(targetUnitId);
  return { ...runtime, phaseScuttlerAccuracyPenaltyUnitIds: next };
}

export function resolveWeepingGargoyleFracturePulse(
  runtime: DepthVariantCombatRuntime,
  unit: Pick<EnemyCombatProfile, 'rosterId' | 'unitId'>,
): { runtime: DepthVariantCombatRuntime; damage: number; logLine: string | null } {
  if (unit.rosterId !== 'weeping-gargoyle' || !unit.unitId) {
    return { runtime, damage: 0, logLine: null };
  }
  if (runtime.weepingPulseUsedUnitIds.has(unit.unitId)) {
    return { runtime, damage: 0, logLine: null };
  }
  const next = new Set(runtime.weepingPulseUsedUnitIds);
  next.add(unit.unitId);
  return {
    runtime: { ...runtime, weepingPulseUsedUnitIds: next },
    damage: WEEPING_FRACTURE_PULSE_DAMAGE,
    logLine: `>> WEEPING GARGOYLE — occult pulse (${WEEPING_FRACTURE_PULSE_DAMAGE}).`,
  };
}

export function formatDepthVariantCombatIntro(
  squad: readonly Pick<EnemyCombatProfile, 'rosterId' | 'designation' | 'currentHp'>[],
): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const unit of squad) {
    if (unit.currentHp <= 0 || !unit.rosterId || seen.has(unit.rosterId)) continue;
    seen.add(unit.rosterId);
    switch (unit.rosterId) {
      case 'weeping-gargoyle':
        lines.push('>> VARIANT — Weeping Gargoyle. Fracture may retaliate.');
        break;
      case 'phase-scuttler':
        lines.push('>> VARIANT — Phase Scuttler. Hits force a phasing slip.');
        break;
      case 'remembering-thrall':
        lines.push('>> VARIANT — Remembering Thrall. May reform unless overkilled.');
        break;
      case 'tar-choir':
        lines.push('>> VARIANT — Tar Choir. Marks amplify the next Veil strike.');
        break;
      case 'static-caller':
        lines.push('>> VARIANT — Static Caller. Frontline melee costs more stamina.');
        break;
      case 'blood-rusted-golem':
        lines.push('>> VARIANT — Blood-Rusted Golem. Heat vents harder.');
        break;
      case 'rootbound-weeper':
        lines.push('>> VARIANT — Rootbound Weeper. Bad kills root; clean occult softens blast.');
        break;
      case 'anchor-husk':
        lines.push('>> VARIANT — Anchor Husk. Allies hit harder while it lives.');
        break;
      case 'core-sick-amalgam':
        lines.push('>> DEEP TAG — Core-Sick Amalgam. Anchor-fused bruiser.');
        break;
      case 'void-lock-memory-leech':
        lines.push('>> DEEP TAG — Void-Lock Memory Leech. Temporary ability lock.');
        break;
      case 'grave-engine-churn':
        lines.push('>> DEEP TAG — Grave-Engine Churn. Feeds on fragile allies.');
        break;
      case 'null-crown-shade':
        lines.push('>> DEEP TAG — Null-Crown Shade. Occult channels struggle.');
        break;
      case 'choir-bound-resonance-caster':
        lines.push('>> DEEP TAG — Choir-Bound Resonance Caster. Escalation primed.');
        break;
      case 'rift-spike-sniper':
        lines.push('>> DEEP TAG — Rift-Spike Sniper. Longer lock-on telegraph.');
        break;
      default:
        break;
    }
  }
  return lines;
}
