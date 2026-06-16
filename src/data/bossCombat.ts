import type { BossRuntimeProfile } from '../types/game';
import type { CombatGridSlotId } from '../types/combatGrid';
import { EnemyCombatProfile, EnemyIntent, SectorDefinition } from '../types/run';
import { getDepthScale } from './descentScaling';
import { districtBossDefinitionForDepth } from './districtBosses';
import { districtBossRosterId } from './enemyRoster';
import { initEnemyCombatLayers } from './combatFractureEngine';
import { normalizeSquad, squadFromSingleEnemy } from './combatSpawnEngine';

export function spawnBossEnemyProfile(
  boss: BossRuntimeProfile,
  sector: SectorDefinition,
  nodeIndex: number,
  gateDepth?: number,
): EnemyCombatProfile {
  const scale = getDepthScale(boss.depth);
  const def = gateDepth != null ? districtBossDefinitionForDepth(gateDepth) : null;
  const baseDamage = def?.baseDamage ?? (boss.depth === 1 ? 8 : boss.depth === 2 ? 12 : 16);
  const base: EnemyCombatProfile = {
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
    bossDepth: boss.depth,
    affinity: 'CORPOREAL',
    rosterId: gateDepth != null ? districtBossRosterId(gateDepth) : undefined,
  };
  return initEnemyCombatLayers(base, {
    kineticArmor: def?.kineticArmor ?? 2,
    occultWards: def?.occultWards ?? 1,
  });
}

const CHOIR_SLOTS: CombatGridSlotId[] = ['FL_0', 'FL_1', 'BL_0'];

export function spawnDistrictBossSquad(
  boss: BossRuntimeProfile,
  sector: SectorDefinition,
  nodeIndex: number,
  gateDepth: number,
): EnemyCombatProfile[] {
  if (boss.variant === 'SHARED_CHOIR' && (boss.bodyCount ?? 1) > 1) {
    const base = spawnBossEnemyProfile(boss, sector, nodeIndex, gateDepth);
    const def = districtBossDefinitionForDepth(gateDepth);
    return normalizeSquad(
      CHOIR_SLOTS.slice(0, boss.bodyCount ?? 3).map((slot, index) =>
        initEnemyCombatLayers({
          ...base,
          designation: `${boss.name} // ANCHOR ${index + 1}`,
          gridSlot: slot,
          lane: slot.startsWith('FL') ? 'FRONTLINE' : 'BACKLINE',
          sharedBossPool: true,
          unitId: `boss-anchor-${index + 1}`,
        }, {
          kineticArmor: def.kineticArmor,
          occultWards: def.occultWards,
        }),
      ),
    );
  }
  return squadFromSingleEnemy(spawnBossEnemyProfile(boss, sector, nodeIndex, gateDepth));
}

export function bossIntentLabel(
  boss: BossRuntimeProfile,
  phase: number,
): string {
  if (phase >= 2) {
    return `>> INTENT: OVERDRIVE DISCHARGE (18 DMG, unblockable unless Counter Stance)`;
  }
  if (boss.depth === 1) {
    return `>> INTENT: GATE WARDEN STRIKE (11 DMG)`;
  }
  if (boss.depth === 2) {
    return `>> INTENT: CHOIR LANCET (10 DMG)`;
  }
  return `>> INTENT: RIFT-WALKER STRIKE (16 DMG)`;
}

export function rollBossIntent(phase: number): EnemyIntent {
  if (phase >= 2) return 'OVERDRIVE_DISCHARGE';
  return Math.random() < 0.35 ? 'STRIKE' : 'STRIKE';
}

export function bossStrikeDamage(boss: BossRuntimeProfile, phase: number): number {
  if (phase >= 2) return 18;
  if (boss.depth === 1) return 11;
  if (boss.depth === 2) return 10;
  return 16;
}

export function shouldShiftBossPhase(boss: BossRuntimeProfile, currentHp: number): boolean {
  if (boss.currentPhase >= 2) return false;
  const pct = (currentHp / boss.maxHp) * 100;
  return pct <= 50;
}
