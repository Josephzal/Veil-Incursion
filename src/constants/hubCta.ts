import type { StyleProp, ViewStyle } from 'react-native';

/** Inset so bordered panels + CTA glow are not clipped by hub shells. */
export const HUB_BORDER_INSET = 2;

export function resolveHubCtaFill(accentColor: string): string {
  return `${accentColor}33`;
}

export function hubCtaMetrics(
  scaleSize: (value: number) => number,
  scaleSpacing: (value: number) => number,
): Pick<ViewStyle, 'minHeight' | 'paddingVertical' | 'paddingHorizontal'> {
  return {
    minHeight: scaleSize(48),
    paddingVertical: scaleSpacing(14),
    paddingHorizontal: scaleSpacing(16),
  };
}

export function hubCtaButtonStyle(
  accentColor: string,
  scaleSize: (value: number) => number,
  scaleSpacing: (value: number) => number,
  disabled = false,
): StyleProp<ViewStyle> {
  return [
    {
      width: '100%',
      alignSelf: 'stretch',
      backgroundColor: resolveHubCtaFill(accentColor),
      borderColor: accentColor,
      borderWidth: 2,
      opacity: disabled ? 0.4 : 1,
    },
    hubCtaMetrics(scaleSize, scaleSpacing),
  ];
}
