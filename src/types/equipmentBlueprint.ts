import type { ClassType } from './game';

export type BlueprintId =
  | 'aegis_claymore'
  | 'riftshot_pulse_rifle'
  | 'envoy_hex';

export interface BlueprintDefinition {
  id: BlueprintId;
  name: string;
  classId: ClassType;
  description: string;
}

export const BLUEPRINT_DEFINITIONS: Record<BlueprintId, BlueprintDefinition> = {
  aegis_claymore: {
    id: 'aegis_claymore',
    name: 'Anomaly-Treated Claymore',
    classId: 'AEGIS',
    description: 'On hit vs fractured hostiles — grant +10 shield for 1 turn.',
  },
  riftshot_pulse_rifle: {
    id: 'riftshot_pulse_rifle',
    name: 'Pulse Shot Rifle',
    classId: 'HEX_SHOT',
    description: 'On fire — self 5% HP. Spectral targets take 2× damage.',
  },
  envoy_hex: {
    id: 'envoy_hex',
    name: 'Diplomatic Hex Sigil',
    classId: 'ENVOY',
    description: 'Combat start — one random hostile gains Vulnerable (+15% damage taken).',
  },
};

export const CLASS_WEAPON_BLUEPRINTS: BlueprintId[] = [
  'aegis_claymore',
  'riftshot_pulse_rifle',
  'envoy_hex',
];

export function blueprintForClass(classId: ClassType): BlueprintId | null {
  const match = CLASS_WEAPON_BLUEPRINTS.find((id) => BLUEPRINT_DEFINITIONS[id].classId === classId);
  return match ?? null;
}

export function isBlueprintId(id: string): id is BlueprintId {
  return id in BLUEPRINT_DEFINITIONS;
}
