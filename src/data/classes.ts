import { ClassType } from '../types/game';

export interface ClassDefinition {
  id: ClassType;
  displayName: string;
  protocolLabel: string;
  weaponLine: string;
  interactionLine: string;
  unlocked: boolean;
}

export const CLASS_DEFINITIONS: Record<ClassType, Omit<ClassDefinition, 'unlocked'>> = {
  AEGIS: {
    id: 'AEGIS',
    displayName: 'AEGIS SLAYER',
    protocolLabel: 'OPERATIVE PROTOCOL: BRANDED AEGIS SLAYER [ACTIVE]',
    weaponLine: 'WEAPON: ANOMALY-TREATED SWORD',
    interactionLine: 'INTERACTION: KINETIC SCAR BRAND',
  },
  RIFTSHOT: {
    id: 'RIFTSHOT',
    displayName: 'RIFTSHOT',
    protocolLabel: 'OPERATIVE PROTOCOL: RIFTSHOT [RESTRICTED]',
    weaponLine: 'WEAPON: PHASE-BOLT CARBINE',
    interactionLine: 'INTERACTION: RIFT MARK SMITE',
  },
  ENVOY: {
    id: 'ENVOY',
    displayName: 'ENVOY',
    protocolLabel: 'OPERATIVE PROTOCOL: ENVOY [RESTRICTED]',
    weaponLine: 'WEAPON: DIPLOMATIC SIGIL ARRAY',
    interactionLine: 'INTERACTION: VEIL NEGOTIATION FIELD',
  },
};

export const RESTRICTED_CLASS_TAG =
  '[SYSTEM ENCRYPTION RESTRICTED // AGENCY ARCHIVE LEVEL 2]';
