import React from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import { useHubLayout } from '../../context/HubLayoutContext';
import { SELECT_ACCENT } from '../../constants/dossierSurface';
import { VEIL } from '../../theme/veilTerminalTokens';
import { HUB_DATA_DIVIDER } from '../../styles/hubTerminalUi';
import { readPressableHover, terminalHoverStyle } from '../../utils/terminalHoverStyle';

interface HubCommandBarProps {
  /** Left-aligned status message, e.g. "LOADOUT SAVED". */
  statusLabel: string;
  /** Optional compact warning title above the detail line. */
  statusTitle?: string;
  /** Optional wrapped detail under statusTitle (max ~2 lines). */
  statusDetail?: string;
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
  /** Wider / taller primary CTA. */
  prominentAction?: boolean;
}

/**
 * Shared bottom command bar for hub screens.
 * Renders `● STATUS` on the left and an optional primary action on the right,
 * giving every terminal screen the same "command terminal" footer.
 */
export default function HubCommandBar({
  statusLabel,
  statusTitle,
  statusDetail,
  statusColor = SELECT_ACCENT,
  dotColor,
  actionLabel,
  onAction,
  actionDisabled = false,
  actionAccent = SELECT_ACCENT,
  prominentAction = false,
}: HubCommandBarProps): React.JSX.Element {
  const { scaleFont, scaleSpacing } = useHubLayout();
  const resolvedDot = dotColor ?? statusColor;
  const useCompactWarning = Boolean(statusTitle && statusDetail);

  return (
    <View
      style={[
        styles.bar,
        {
          paddingHorizontal: scaleSpacing(12),
          paddingVertical: scaleSpacing(prominentAction ? 10 : 9),
          gap: scaleSpacing(10),
        },
      ]}
    >
      <View
        style={[
          styles.statusGroup,
          {
            gap: scaleSpacing(7),
            maxWidth: prominentAction ? '46%' : '70%',
            alignItems: useCompactWarning ? 'flex-start' : 'center',
          },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: resolvedDot, marginTop: useCompactWarning ? 4 : 0 }]} />
        {useCompactWarning ? (
          <View style={{ flexShrink: 1, minWidth: 0, gap: scaleSpacing(2) }}>
            <TerminalText
              size={scaleFont(5.4)}
              letterSpacing={1}
              numberOfLines={1}
              style={{ color: statusColor, fontWeight: '800' }}
            >
              {statusTitle}
            </TerminalText>
            <TerminalText
              size={scaleFont(5.2)}
              letterSpacing={0.2}
              numberOfLines={2}
              style={{ color: 'rgba(170, 178, 185, 0.82)', fontWeight: '600', lineHeight: scaleFont(7.4) }}
            >
              {statusDetail}
            </TerminalText>
          </View>
        ) : (
          <TerminalText
            size={scaleFont(5.6)}
            letterSpacing={1}
            numberOfLines={1}
            style={{ color: statusColor, fontWeight: '700', flexShrink: 1 }}
          >
            {statusLabel}
          </TerminalText>
        )}
      </View>

      {actionLabel ? (
        <HapticPressable
          onPress={onAction}
          disabled={actionDisabled || !onAction}
          style={(state) => {
            const actionStyle: ViewStyle = {
              paddingHorizontal: scaleSpacing(prominentAction ? 28 : 16),
              paddingVertical: scaleSpacing(prominentAction ? 12 : 9),
              minWidth: prominentAction ? scaleSpacing(220) : undefined,
              borderColor: actionDisabled ? 'rgba(119, 130, 125, 0.28)' : actionAccent,
              backgroundColor: actionDisabled ? 'rgba(8, 12, 16, 0.55)' : 'transparent',
              opacity: 1,
            };
            if (Platform.OS === 'web') {
              Object.assign(actionStyle, {
                cursor: actionDisabled ? 'not-allowed' : 'pointer',
              });
            }
            return [
              styles.action,
              actionStyle,
              actionDisabled ? null : terminalHoverStyle(readPressableHover(state), state.pressed),
            ];
          }}
        >
          <TerminalText
            size={scaleFont(prominentAction ? 6.6 : 5.8)}
            letterSpacing={1.2}
            style={{
              color: actionDisabled ? 'rgba(210, 218, 222, 0.48)' : actionAccent,
              fontWeight: '800',
            }}
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: VEIL.lineFaint,
    backgroundColor: VEIL.bgSoft,
  },
  statusGroup: {
    flexDirection: 'row',
    flexShrink: 1,
    minWidth: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  action: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
