import type { HostileIntentSnapshot } from '../../types/counterfate';
import { positionRankForSlot } from './intentIdentity';

export function hostileSnapshotInput(args: {
  unitId: string;
  intentKind: string;
  countdown?: number;
  hostileTurnOrder: number;
  slot?: string;
  concealed?: boolean;
  hp?: number;
  maxHp?: number;
  alive?: boolean;
  phased?: boolean;
  protectedPhase?: boolean;
  authoredCounter?: boolean;
  designation?: string;
  severity?: HostileIntentSnapshot['severity'];
  invulnerable?: boolean;
  kineticArmor?: number;
  occultWards?: number;
  kineticArmorBrokenThisCombat?: boolean;
  occultWardsBrokenThisCombat?: boolean;
  combatTags?: readonly string[];
}): Omit<HostileIntentSnapshot, 'intentInstanceId'> {
  return {
    unitId: args.unitId,
    intentKind: args.intentKind,
    severity: args.severity ?? 'MODERATE',
    countdown: args.countdown ?? 1,
    hostileTurnOrder: args.hostileTurnOrder,
    positionRank: positionRankForSlot(args.slot),
    concealed: args.concealed === true,
    hp: args.hp ?? 40,
    maxHp: args.maxHp ?? 40,
    alive: args.alive !== false,
    phased: args.phased === true,
    protectedPhase: args.protectedPhase,
    authoredCounter: args.authoredCounter,
    designation: args.designation ?? args.unitId,
    invulnerable: args.invulnerable,
    kineticArmor: args.kineticArmor,
    occultWards: args.occultWards,
    kineticArmorBrokenThisCombat: args.kineticArmorBrokenThisCombat,
    occultWardsBrokenThisCombat: args.occultWardsBrokenThisCombat,
    combatTags: args.combatTags,
  };
}
