import { Platform, type ViewStyle } from 'react-native';

export const TERMINAL_HOVER_FILL = 'rgba(255, 255, 255, 0.05)';

/** Web-only hover highlight for terminal cards and rows. */
export function terminalHoverStyle(hovered: boolean, pressed = false): ViewStyle | null {
  if (Platform.OS !== 'web') return null;
  if (hovered || pressed) {
    return { backgroundColor: TERMINAL_HOVER_FILL };
  }
  return null;
}

export function readPressableHover(state: { pressed: boolean; hovered?: boolean }): boolean {
  return state.hovered === true;
}
