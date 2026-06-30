import { Platform, type ViewStyle } from 'react-native';

export const TERMINAL_HOVER_FILL = 'rgba(255, 255, 255, 0.05)';

/** Web-only hover highlight + pointer for interactive terminal cards. */
export function terminalHoverStyle(hovered: boolean, pressed = false): ViewStyle | null {
  if (Platform.OS !== 'web') return null;
  const pointer = { cursor: 'pointer' } as ViewStyle;
  if (hovered || pressed) {
    return { ...pointer, backgroundColor: TERMINAL_HOVER_FILL };
  }
  return pointer;
}

export function readPressableHover(state: { pressed: boolean; hovered?: boolean }): boolean {
  return state.hovered === true;
}
