import type { ViewStyle } from 'react-native';
import { viewShadow } from '../utils/adaptiveStyles';

/**
 * Combat console button chrome — mirrors HubPrimaryCta `glow` (tint + border + bloom)
 * but keeps fills denser so arena/dock readability stays intact.
 */

export type CombatChromeTone = 'rest' | 'awake' | 'disabled';

export function withCombatAccentAlpha(color: string, alphaHex: string): string {
  if (color.startsWith('#') && color.length === 7) {
    return `${color}${alphaHex}`;
  }
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${Number.parseInt(alphaHex, 16) / 255})`);
  }
  if (color.startsWith('rgba(')) {
    return color.replace(/,\s*[\d.]+\)$/, `, ${Number.parseInt(alphaHex, 16) / 255})`);
  }
  return color;
}

/**
 * Subtle translucent fill + accent border + soft zero-offset glow.
 * Rest fill uses ~16% accent (hub uses ~9%); awake ~28% (hub ~20%).
 * `ink` — near-black ability-card panels (not grey steel).
 */
export function combatConsoleChromeStyle(opts: {
  accent: string;
  tone?: CombatChromeTone;
  borderWidth?: number;
  /** Near-black rest/disabled surfaces for ability cards. */
  ink?: boolean;
}): ViewStyle {
  const accent = opts.accent;
  const tone = opts.tone ?? 'rest';
  const borderWidth = opts.borderWidth ?? 2;

  if (opts.ink && (tone === 'rest' || tone === 'disabled')) {
    const disabled = tone === 'disabled';
    return {
      backgroundColor: disabled ? 'rgba(2, 3, 4, 0.88)' : 'rgba(4, 5, 7, 0.94)',
      borderColor: disabled ? 'rgba(90, 100, 108, 0.28)' : 'rgba(110, 122, 130, 0.32)',
      borderWidth,
      ...viewShadow({
        color: '#000000',
        opacity: disabled ? 0.35 : 0.55,
        radius: disabled ? 7 : 9,
        offset: { width: 0, height: 0 },
      }),
    };
  }

  if (tone === 'disabled') {
    return {
      backgroundColor: withCombatAccentAlpha(accent, '16'),
      borderColor: withCombatAccentAlpha(accent, '40'),
      borderWidth,
      ...viewShadow({
        color: accent,
        opacity: 0.22,
        radius: 7,
        offset: { width: 0, height: 0 },
      }),
    };
  }

  if (tone === 'awake') {
    return {
      backgroundColor: withCombatAccentAlpha(accent, '48'),
      borderColor: accent,
      borderWidth,
      ...viewShadow({
        color: accent,
        opacity: 0.68,
        radius: 12,
        offset: { width: 0, height: 0 },
      }),
    };
  }

  return {
    backgroundColor: withCombatAccentAlpha(accent, '2A'),
    borderColor: withCombatAccentAlpha(accent, '8A'),
    borderWidth,
    ...viewShadow({
      color: accent,
      opacity: 0.42,
      radius: 9,
      offset: { width: 0, height: 0 },
    }),
  };
}
