import React from 'react';
import { StyleSheet, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import { useHubLayout } from '../../context/HubLayoutContext';
import { SELECT_ACCENT, CARD_BLACK } from '../../constants/dossierSurface';
import { HUB_DATA_DIVIDER } from '../../styles/hubTerminalUi';
import { readPressableHover, terminalHoverStyle } from '../../utils/terminalHoverStyle';

interface HubCommandBarProps {
  /** Left-aligned status message, e.g. "LOADOUT SAVED". */
  statusLabel: string;
  /** Status text + dot color. Defaults to spectral green. */
  statusColor?: string;
  /** Dot color override (defaults to statusColor). */
  dotColor?: string;
  /** Optional primary action label (bracketed), e.g. "[ READY FOR DESCENT ]". */
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  /** Action accent — defaults to spectral green. */
  actionAccent?: string;
}

/**
 * Shared bottom command bar for hub screens.
 * Renders `● STATUS` on the left and an optional primary action on the right,
 * giving every terminal screen the same "command terminal" footer.
 */
export default function HubCommandBar({
  statusLabel,
  statusColor = SELECT_ACCENT,
  dotColor,
  actionLabel,
  onAction,
  actionDisabled = false,
  actionAccent = SELECT_ACCENT,
}: HubCommandBarProps): React.JSX.Element {
  const { scaleFont, scaleSpacing } = useHubLayout();
  const resolvedDot = dotColor ?? statusColor;

  return (
    <View
      style={[
        styles.bar,
        {
          paddingHorizontal: scaleSpacing(12),
          paddingVertical: scaleSpacing(9),
          gap: scaleSpacing(10),
        },
      ]}
    >
      <View style={[styles.statusGroup, { gap: scaleSpacing(7) }]}>
        <View style={[styles.dot, { backgroundColor: resolvedDot }]} />
        <TerminalText
          size={scaleFont(5.6)}
          letterSpacing={1}
          numberOfLines={1}
          style={{ color: statusColor, fontWeight: '700' }}
        >
          {statusLabel}
        </TerminalText>
      </View>

      {actionLabel ? (
        <HapticPressable
          onPress={onAction}
          disabled={actionDisabled || !onAction}
          style={(state) => [
            styles.action,
            {
              paddingHorizontal: scaleSpacing(16),
              paddingVertical: scaleSpacing(9),
              borderColor: actionDisabled ? HUB_DATA_DIVIDER : actionAccent,
              backgroundColor: actionDisabled ? 'rgba(0, 0, 0, 0.4)' : `${actionAccent}1f`,
              opacity: actionDisabled ? 0.45 : 1,
            },
            terminalHoverStyle(readPressableHover(state), state.pressed),
          ]}
        >
          <TerminalText
            size={scaleFont(5.8)}
            letterSpacing={1}
            style={{ color: actionDisabled ? HUB_DATA_DIVIDER : actionAccent, fontWeight: '800' }}
          >
            {actionLabel}
          </TerminalText>
        </HapticPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: HUB_DATA_DIVIDER,
    backgroundColor: CARD_BLACK,
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  action: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
