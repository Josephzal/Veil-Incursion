/**
 * WU-4 — art-independent staged skill prompts for the six new ultimates.
 */
import type { WeaponUltimateId } from './weaponUltimateRegistry';

export interface WeaponUltimateStageDef {
  id: string;
  label: string;
  instruction: string;
}

export interface WeaponUltimateStagedScript {
  ultimateId: WeaponUltimateId;
  title: string;
  durationMs: number;
  stages: readonly WeaponUltimateStageDef[];
}

const MS = 2800;

export const WU4_STAGED_SCRIPTS: Record<
  Exclude<
    WeaponUltimateId,
    'THREEFOLD_BRAND' | 'ZERO_PROTOCOL' | 'NULL_CIRCUIT'
  >,
  WeaponUltimateStagedScript
> = {
  REND_THE_VEIL: {
    ultimateId: 'REND_THE_VEIL',
    title: '[ REND THE VEIL ]',
    durationMs: MS,
    stages: [
      { id: 'trace-a', label: 'TRACE A', instruction: 'Hold — left diagonal mirror cut' },
      { id: 'trace-b', label: 'TRACE B', instruction: 'Hold — right diagonal mirror cut' },
      { id: 'rupture', label: 'RUPTURE', instruction: 'Hold — central veil pull-out' },
    ],
  },
  GRAVEFALL: {
    ultimateId: 'GRAVEFALL',
    title: '[ GRAVEFALL ]',
    durationMs: MS,
    stages: [
      { id: 'raise', label: 'RAISE', instruction: 'Hold — lift the Unmaker' },
      { id: 'strain', label: 'STRAIN', instruction: 'Hold — keep the strain band' },
      { id: 'slam', label: 'SLAM', instruction: 'Hold — drive the blade down' },
    ],
  },
  SIXTH_SEAL: {
    ultimateId: 'SIXTH_SEAL',
    title: '[ SIXTH SEAL ]',
    durationMs: MS,
    stages: [
      { id: 'align', label: 'ALIGN', instruction: 'Hold — cylinder chamber align' },
      { id: 'seat', label: 'SEAT', instruction: 'Hold — seat the sealed round' },
      { id: 'close', label: 'CLOSE', instruction: 'Hold — close the rail' },
    ],
  },
  LAST_KNOCK: {
    ultimateId: 'LAST_KNOCK',
    title: '[ LAST KNOCK ]',
    durationMs: MS,
    stages: [
      { id: 'pump', label: 'PUMP', instruction: 'Hold — pump the breach open' },
      { id: 'rings', label: 'RINGS', instruction: 'Hold — stabilize impact rings' },
      { id: 'slam', label: 'SLAM', instruction: 'Hold — drive the knock forward' },
    ],
  },
  FUNERAL_KNOT: {
    ultimateId: 'FUNERAL_KNOT',
    title: '[ FUNERAL KNOT ]',
    durationMs: MS,
    stages: [
      { id: 'wind', label: 'WIND', instruction: 'Hold — wind Rot into quadrants' },
      { id: 'tighten', label: 'TIGHTEN', instruction: 'Hold — cinch the knot' },
      { id: 'tear', label: 'TEAR', instruction: 'Hold — tear the weave' },
    ],
  },
  CRIMSON_REFRACTION: {
    ultimateId: 'CRIMSON_REFRACTION',
    title: '[ CRIMSON REFRACTION ]',
    durationMs: MS,
    stages: [
      { id: 'align', label: 'ALIGN', instruction: 'Hold — align sanguine rays' },
      { id: 'offer', label: 'OFFER', instruction: 'Hold — channel the HP offering' },
      { id: 'commit', label: 'COMMIT', instruction: 'Hold — refract through the wound' },
    ],
  },
};

export function getWu4StagedScript(id: WeaponUltimateId): WeaponUltimateStagedScript | null {
  if (id === 'THREEFOLD_BRAND' || id === 'ZERO_PROTOCOL' || id === 'NULL_CIRCUIT') return null;
  return WU4_STAGED_SCRIPTS[id];
}
