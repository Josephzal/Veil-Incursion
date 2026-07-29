/**
 * Phase 3K — defense-layer runtime validation helpers (read-only proofs).
 */
import type { DamageChannel } from '../../types/aegisCombat';
import type { EnemyCombatProfile } from '../../types/run';
import {
  mitigateByChannel,
  stripKineticArmor,
  stripOccultWards,
} from '../combatDefenseLayerEngine';
import { isEnemyFractured } from '../combatFractureEngine';
import { COMBAT_DEFENSE_BALANCE } from '../balance/combatDefenseBalanceConfig';

export function makeDefenseProbeEnemy(
  partial: Partial<EnemyCombatProfile> & { designation: string },
): EnemyCombatProfile {
  const { designation, ...rest } = partial;
  return {
    class: 'GREMLIN',
    designation,
    maxHp: 100,
    currentHp: 100,
    baseDamage: 10,
    intent: 'STRIKE',
    chargeTurns: 0,
    evadeActive: false,
    nodeIndex: 0,
    scale: 1,
    kineticArmor: 0,
    occultWards: 0,
    baseKineticArmor: 0,
    baseOccultWards: 0,
    fractureGauge: 0,
    fractureMax: 50,
    combatTags: [],
    ...rest,
  };
}

export type DefenseRoutingProof = {
  channel: DamageChannel;
  kineticStacks: number;
  occultStacks: number;
  raw: number;
  afterMitigation: number;
  reduced: number;
  pierceBypass: boolean;
};

export function proveMitigationRouting(
  channel: DamageChannel,
  kineticStacks: number,
  occultStacks: number,
  raw: number,
  options?: { pierce?: boolean },
): DefenseRoutingProof {
  const enemy = makeDefenseProbeEnemy({
    designation: 'Probe',
    kineticArmor: kineticStacks,
    occultWards: occultStacks,
    baseKineticArmor: kineticStacks,
    baseOccultWards: occultStacks,
  });
  const result = mitigateByChannel(enemy, raw, channel, options);
  return {
    channel,
    kineticStacks,
    occultStacks,
    raw,
    afterMitigation: result.damageAfter,
    reduced: result.damageReduced,
    pierceBypass: Boolean(options?.pierce),
  };
}

export function proveArmorBreakAppliesFracture(): { broke: boolean; fractured: boolean } {
  const enemy = makeDefenseProbeEnemy({
    designation: 'Probe',
    kineticArmor: 1,
    baseKineticArmor: 1,
  });
  const stripped = stripKineticArmor(enemy, 1);
  return {
    broke: stripped.broke,
    fractured: stripped.appliedFracture && isEnemyFractured(stripped.enemy),
  };
}

export function proveWardBreakAppliesFracture(): { broke: boolean; fractured: boolean } {
  const enemy = makeDefenseProbeEnemy({
    designation: 'Probe',
    occultWards: 1,
    baseOccultWards: 1,
  });
  const stripped = stripOccultWards(enemy, 1);
  return {
    broke: stripped.broke,
    fractured: stripped.appliedFracture && isEnemyFractured(stripped.enemy),
  };
}

export function proveTrueDamageIgnoresLayers(): boolean {
  const p = proveMitigationRouting('TRUE', 3, 3, 50);
  return p.afterMitigation === 50 && p.reduced === 0;
}

export function proveKineticDoesNotHitWards(): boolean {
  const p = proveMitigationRouting('KINETIC', 0, 3, 50);
  return p.reduced === 0 && p.afterMitigation === 50;
}

export function proveOccultDoesNotHitArmor(): boolean {
  const p = proveMitigationRouting('OCCULT', 3, 0, 50);
  return p.reduced === 0 && p.afterMitigation === 50;
}

export function defaultMitigationPercent(): number {
  return COMBAT_DEFENSE_BALANCE.defaultKineticArmorReductionPercent;
}
