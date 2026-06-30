import { Platform, type ViewStyle } from 'react-native';

/** Web CSS — suppress scrollbar chrome while preserving scroll/wheel behavior. */
export const HIDDEN_SCROLLBAR_VIEW_STYLE = Platform.select<ViewStyle>({
  web: {
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  default: {},
}) ?? {};

export const HIDDEN_SCROLLVIEW_PROPS = {
  showsVerticalScrollIndicator: false,
  showsHorizontalScrollIndicator: false,
  persistentScrollbar: false,
} as const;

export function mergeHiddenScrollbarStyle(style?: ViewStyle | ViewStyle[]): ViewStyle | ViewStyle[] {
  if (Platform.OS !== 'web') return style ?? {};
  const hidden = HIDDEN_SCROLLBAR_VIEW_STYLE;
  if (style == null) return hidden;
  if (Array.isArray(style)) return [...style, hidden];
  return [style, hidden];
}
