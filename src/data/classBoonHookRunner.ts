import type { EnvoyBoonId, HexShotBoonId } from '../types/classBoon';
import {
  boonMatchesHexAction,
  hasEnvoyBoon,
  hasHexShotBoon,
} from './classBoonEngine';
import type { EnvoyAbilityId, HexShotAbilityId } from '../types/operativeClass';

export interface ClassBoonKillContext {
  abilityId: string | null;
  log: (msg: string) => void;
  refundAmmo?: (amount: number) => void;
  refundAp?: () => void;
  healOperative?: (amount: number) => void;
  restoreStamina?: () => void;
  fillMagazine?: () => void;
  maxHp: number;
  currentHp: number;
}

export function runHexShotKillBoons(
  boons: readonly HexShotBoonId[],
  ctx: ClassBoonKillContext,
): void {
  const abilityId = ctx.abilityId as HexShotAbilityId | null;
  if (!abilityId) return;

  if (boonMatchesHexAction(boons, 'HAIR_TRIGGER', abilityId)) {
    ctx.refundAmmo?.(1);
    ctx.log('[HAIR-TRIGGER] >> Ballistic kill — 1 Ammo refunded.');
  }
  if (boonMatchesHexAction(boons, 'ZERO_POINT_EXTRACTION', abilityId)) {
    ctx.fillMagazine?.();
    ctx.restoreStamina?.();
    ctx.log('[ZERO-POINT EXTRACTION] >> Ultimate kill — magazine and stamina restored.');
  }
}

export function runEnvoyTurnStartBoons(
  boons: readonly EnvoyBoonId[],
  cursedEnemyCount: number,
  log: (msg: string) => void,
  healOperative?: (amount: number) => void,
): void {
  if (hasEnvoyBoon(boons, 'PARASITIC_LINK') && cursedEnemyCount > 0) {
    const heal = cursedEnemyCount * 2;
    healOperative?.(heal);
    log(`[PARASITIC LINK] >> ${heal} HP leeched from ${cursedEnemyCount} cursed hostiles.`);
  }
}

export interface EnvoyRiftWardBoonContext {
  boons: readonly EnvoyBoonId[];
  log: (msg: string) => void;
  applyVeilFlux: (delta: number) => void;
  refundAp: (amount?: number) => void;
  grantUntargetable: (turns: number) => void;
}

export function runEnvoyRiftWardSuccessBoons(ctx: EnvoyRiftWardBoonContext): void {
  if (!hasEnvoyBoon(ctx.boons, 'PERFECTED_WARD')) return;
  ctx.applyVeilFlux(-50);
  ctx.refundAp(1);
  ctx.log('[PERFECTED WARD] >> Perfect ward — 50 Flux vented, +1 AP restored.');
}

export function runEnvoyRiftWardFailBoons(ctx: EnvoyRiftWardBoonContext): void {
  if (!hasEnvoyBoon(ctx.boons, 'RIFT_WALKER')) return;
  ctx.grantUntargetable(1);
  ctx.log('[RIFT-WALKER] >> Ward shattered — operative phased to safe bearing.');
}

export interface ClassTakeDamageBoonContext {
  hexBoons: readonly HexShotBoonId[];
  envoyBoons: readonly EnvoyBoonId[];
  damageDealt: number;
  log: (msg: string) => void;
  applyVeilFlux: (delta: number) => void;
  grantReactiveCamo: () => boolean;
}

export function runClassTakeDamageBoons(ctx: ClassTakeDamageBoonContext): void {
  if (ctx.damageDealt <= 0) return;
  if (hasHexShotBoon(ctx.hexBoons, 'REACTIVE_CAMO') && ctx.grantReactiveCamo()) {
    ctx.log('[REACTIVE CAMO] >> Hit registered — operative untargetable 1 turn.');
  }
  if (hasEnvoyBoon(ctx.envoyBoons, 'ADRENALINE_CHANNEL')) {
    ctx.applyVeilFlux(-20);
    ctx.log('[ADRENALINE CHANNEL] >> Pain converts to void — −20 Flux.');
  }
}

export function runEnvoyEvadeSuccessBoons(
  boons: readonly EnvoyBoonId[],
  log: (msg: string) => void,
  refundAp: (amount?: number) => void,
): void {
  if (!hasEnvoyBoon(boons, 'PHASE_SHIFT')) return;
  refundAp(1);
  log('[PHASE-SHIFT] >> Evade successful — +1 AP restored.');
}
