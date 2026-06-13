import { StyleSheet, TextStyle, ViewStyle } from 'react-native';

/** Hairline divider between static data lanes — never a full box. */
export const HUB_DATA_DIVIDER = 'rgba(255, 255, 255, 0.15)';

export function formatBracketHeader(title: string): string {
  const normalized = title.replace(/^\[\s*|\s*\]$/g, '').trim();
  return `[ ${normalized.toUpperCase()} ]`;
}

/** ~3% accent fill at rest, ~5% when pressed (8-digit hex on #RRGGBB). */
export function accentButtonFill(accentColor: string, pressed = false): string {
  const alpha = pressed ? '0D' : '08';
  if (accentColor.startsWith('#') && accentColor.length >= 7) {
    return `${accentColor.slice(0, 7)}${alpha}`;
  }
  return pressed ? 'rgba(0, 255, 51, 0.05)' : 'rgba(0, 255, 51, 0.03)';
}

export const hubTerminalUi = StyleSheet.create({
  dataSection: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: HUB_DATA_DIVIDER,
    gap: 10,
  },
  dataSectionLeading: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  sectionHeader: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
  },
  sectionHeaderLg: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  interactiveButton: {
    borderWidth: 1,
    borderStyle: 'solid',
    alignItems: 'center',
    justifyContent: 'center',
  },
  interactiveButtonSm: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  interactiveButtonMd: {
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  interactiveButtonLg: {
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'flex-start',
  },
  interactiveButtonText: {
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  interactiveButtonTextSm: {
    fontSize: 7,
    letterSpacing: 0.4,
  },
  interactiveButtonTextMd: {
    fontSize: 9,
    letterSpacing: 0.7,
  },
  interactiveButtonTextLg: {
    fontSize: 12,
    letterSpacing: 1.2,
  },
});

export type HubInteractiveButtonSize = 'sm' | 'md' | 'lg';

export function getInteractiveButtonStyle(
  accentColor: string,
  opts?: { pressed?: boolean; disabled?: boolean; size?: HubInteractiveButtonSize },
): ViewStyle {
  const size = opts?.size ?? 'md';
  const sizeStyle =
    size === 'sm'
      ? hubTerminalUi.interactiveButtonSm
      : size === 'lg'
        ? hubTerminalUi.interactiveButtonLg
        : hubTerminalUi.interactiveButtonMd;

  return {
    ...hubTerminalUi.interactiveButton,
    ...sizeStyle,
    borderColor: accentColor,
    backgroundColor: accentButtonFill(accentColor, opts?.pressed),
    opacity: opts?.disabled ? 0.4 : 1,
  };
}

export function getInteractiveButtonTextStyle(size: HubInteractiveButtonSize = 'md'): TextStyle {
  const sizeStyle =
    size === 'sm'
      ? hubTerminalUi.interactiveButtonTextSm
      : size === 'lg'
        ? hubTerminalUi.interactiveButtonTextLg
        : hubTerminalUi.interactiveButtonTextMd;

  return {
    ...hubTerminalUi.interactiveButtonText,
    ...sizeStyle,
  };
}
