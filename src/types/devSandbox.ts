/** Dev TEST tab — isolated node previews that return to the sandbox hub on continue. */
export type DevSandboxPreset =
  | 'combat-easy'
  | 'combat-hard'
  | 'narrative-scavenge'
  | 'narrative-conceal'
  | 'narrative-shadowline'
  | 'narrative-sigil'
  | 'narrative-rite'
  | 'narrative-cipher'
  | 'narrative-ley'
  | 'narrative-signal'
  | 'narrative-tumbler'
  | 'standard-combat'
  | 'elite-combat'
  | 'sanctuary'
  | 'extraction'
  | 'black-market'
  | 'incursion-safehouse'
  | 'resource-harvest'
  | 'hostile-echo-combat';

export const DEV_SANDBOX_NARRATIVE_PRESETS = [
  'narrative-scavenge',
  'narrative-conceal',
  'narrative-shadowline',
  'narrative-sigil',
  'narrative-rite',
  'narrative-cipher',
  'narrative-ley',
  'narrative-signal',
  'narrative-tumbler',
] as const satisfies readonly DevSandboxPreset[];

export function isDevSandboxPreset(value: DevSandboxPreset | null | undefined): value is DevSandboxPreset {
  return value != null;
}
