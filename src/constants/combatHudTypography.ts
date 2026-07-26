/**
 * Shared combat HUD type sizes — arena-legible mono scale.
 * Prefer these over ad-hoc literals in combat UI.
 */
export const COMBAT_HUD_TYPE = {
  micro: 9,
  caption: 10,
  body: 11,
  label: 12,
  title: 13,
  emphasis: 14,
  hero: 17,
  lineMicro: 12,
  lineCaption: 14,
  lineBody: 15,
  lineLabel: 16,
} as const;
