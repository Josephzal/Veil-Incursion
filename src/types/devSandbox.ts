/** Dev TEST tab — isolated node previews that return to the sandbox hub on continue. */
export type DevSandboxPreset =
  | 'combat-easy'
  | 'combat-hard'
  | 'narrative-scavenge'
  | 'narrative-conceal'
  | 'narrative-sigil'
  | 'standard-combat'
  | 'elite-combat'
  | 'sanctuary'
  | 'extraction'
  | 'black-market'
  | 'incursion-safehouse'
  | 'resource-harvest';

export const DEV_SANDBOX_NARRATIVE_PRESETS = [
  'narrative-scavenge',
  'narrative-conceal',
  'narrative-sigil',
] as const satisfies readonly DevSandboxPreset[];

export function isDevSandboxPreset(value: DevSandboxPreset | null | undefined): value is DevSandboxPreset {
  return value != null;
}
