import type { CabalEmployerId } from '../types/worldState';

export interface SponsorIdentity {
  /** Faction emblem glyph. */
  emblem: string;
  /** Short faction descriptor line. */
  descriptor: string;
  /** Thematic stamp shown when a contract is accepted/bound. */
  sealLabel: string;
  /** One-line consequence copy shown under the seal. */
  sealSubline: string;
}

export const SPONSOR_IDENTITY: Record<CabalEmployerId, SponsorIdentity> = {
  TERRAN_GRID: {
    emblem: '▣',
    descriptor: 'Containment / Infrastructure / Ordered Extraction',
    sealLabel: 'MANDATE SEALED',
    sealSubline: 'Terran Grid has marked this route for extraction.',
  },
  LEGION: {
    emblem: '⬢',
    descriptor: 'Militant / Blood Debt / High-Risk Combat',
    sealLabel: 'BLOOD DEBT BOUND',
    sealSubline: 'Legion claims this route. Failure to deliver is debt owed.',
  },
  SOLARIS: {
    emblem: '◉',
    descriptor: 'Research / Occult Tech / Strange Rewards',
    sealLabel: 'BOUNTY LOGGED',
    sealSubline: 'Solaris will observe and reward your recovery.',
  },
};
