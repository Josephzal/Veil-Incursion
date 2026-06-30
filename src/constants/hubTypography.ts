/** Hub monospace type scale — base px before desktop `scaleFont()`. */

export const HUB_TYPE = {
  screenTitle: 10,
  section: 9,
  panelTitle: 9,
  body: 8,
  caption: 7,
  micro: 6,
  /** Emphasis readouts (staging values, operative name). */
  display: 11,
} as const;

export type HubTypeToken = keyof typeof HUB_TYPE;

export const HUB_LINE_HEIGHT: Record<HubTypeToken, number> = {
  screenTitle: 13,
  section: 12,
  panelTitle: 12,
  body: 11,
  caption: 10,
  micro: 8,
  display: 14,
};
