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

/** Combat sandbox presets — used for ultimate-primed start and combat-only tooling. */
export const DEV_SANDBOX_COMBAT_PRESETS = [
  'standard-combat',
  'elite-combat',
  'combat-easy',
  'combat-hard',
  'hostile-echo-combat',
] as const satisfies readonly DevSandboxPreset[];

export function isDevSandboxPreset(value: DevSandboxPreset | null | undefined): value is DevSandboxPreset {
  return value != null;
}

export function isDevSandboxCombatPreset(
  value: DevSandboxPreset | null | undefined,
): value is typeof DEV_SANDBOX_COMBAT_PRESETS[number] {
  return value != null && (DEV_SANDBOX_COMBAT_PRESETS as readonly string[]).includes(value);
}
