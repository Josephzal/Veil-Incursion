import { BossRuntimeProfile } from '../types/game';
import { EnemyCombatProfile, EnemyIntent, SectorDefinition } from '../types/run';
import { getTierScale } from './descentEngine';

export function spawnBossEnemyProfile(
  boss: BossRuntimeProfile,
  sector: SectorDefinition,
  nodeIndex: number,
): EnemyCombatProfile {
  const scale = getTierScale(boss.tier);
  const baseDamage = boss.tier === 1 ? 8 : boss.tier === 2 ? 12 : 14;
  return {
    class: 'ABOMINATION',
    designation: boss.name,
    maxHp: boss.maxHp,
    currentHp: boss.currentHp,
    baseDamage: Math.floor(baseDamage * scale),
    intent: 'STRIKE',
    chargeTurns: 0,
    evadeActive: false,
    nodeIndex,
    scale,
    isBoss: true,
    bossPhase: boss.currentPhase,
    bossTier: boss.tier,
  };
}

export function bossIntentLabel(
  boss: BossRuntimeProfile,
  phase: number,
): string {
  if (phase >= 2) {
    return `>> INTENT: OVERDRIVE DISCHARGE (18 DMG, unblockable unless Counter Stance)`;
  }
  if (boss.tier === 1) {
    return `>> INTENT: CONDUIT STRIKE (8 DMG)`;
  }
  if (boss.tier === 2) {
    return `>> INTENT: COMMANDER LANCET (12 DMG)`;
  }
  return `>> INTENT: PRIME VECTOR STRIKE (14 DMG)`;
}

export function rollBossIntent(phase: number): EnemyIntent {
  if (phase >= 2) return 'OVERDRIVE_DISCHARGE';
  return Math.random() < 0.35 ? 'STRIKE' : 'STRIKE';
}

export function bossStrikeDamage(boss: BossRuntimeProfile, phase: number): number {
  if (phase >= 2) return 18;
  if (boss.tier === 1) return 8;
  if (boss.tier === 2) return 12;
  return 14;
}

export function shouldShiftBossPhase(boss: BossRuntimeProfile, currentHp: number): boolean {
  if (boss.currentPhase >= 2) return false;
  const pct = (currentHp / boss.maxHp) * 100;
  return pct <= 50;
}
