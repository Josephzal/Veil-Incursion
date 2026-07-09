import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import TacticalButton from '../TacticalButton';
import CargoPressurePanel from '../CargoPressurePanel';
import { useCargoOverlay } from '../../context/CargoOverlayContext';
import { useRunStatusOverlay } from '../../context/RunStatusOverlayContext';
import { useRun } from '../../context/RunContext';
import { useTerminal } from '../../context/TerminalContext';
import { hasActiveCarriedCargoEffects } from '../../data/unstableCargoEffectsEngine';

const STARK_WHITE = '#F8FAFC';
const MUTED_SLATE = '#94A3B8';
const HEADER_BORDER = '#334155';

export interface RunEventNodeHeaderProps {
  title: string;
  subtitle?: string;
  fontScale: number;
  /** Pin STATUS / CARGO controls to the bottom-right of the header strip. */
  showRunChrome?: boolean;
}

function RunEventHeaderChrome(): React.JSX.Element | null {
  const { theme } = useTerminal();
  const cargo = useCargoOverlay();
  const status = useRunStatusOverlay();

  if (!cargo && !status) {
    return null;
  }

  return (
    <View style={styles.headerChromeRow}>
      {status ? (
        <TacticalButton
          label="STATUS"
          active={false}
          onPress={status.openStatus}
          accentColor={theme.statusColor}
          mutedColor={theme.mutedColor}
          variant="inline"
          disabled={!status.statusEnabled}
        />
      ) : null}
      {cargo ? (
        <TacticalButton
          label="CARGO"
          active={false}
          onPress={cargo.openCargo}
          accentColor={theme.statusColor}
          mutedColor={theme.mutedColor}
          variant="inline"
          disabled={!cargo.cargoEnabled}
        />
      ) : null}
    </View>
  );
}

/** Upper-left run event title strip — matches evac / extraction screen styling. */
export default function RunEventNodeHeader({
  title,
  subtitle,
  fontScale,
  showRunChrome = false,
}: RunEventNodeHeaderProps): React.JSX.Element {
  const { theme } = useTerminal();
  const { activeIncursion } = useRun();
  const showCargoPressure = showRunChrome
    && hasActiveCarriedCargoEffects(activeIncursion.cargo);
  const titleSize = 16 * fontScale;
  const subtitleSize = 9 * fontScale;
  const headerPadBottom = 14 * fontScale;
  const headerMarginBottom = 18 * fontScale;

  return (
    <View
      style={[
        styles.header,
        {
          borderBottomColor: HEADER_BORDER,
          paddingBottom: headerPadBottom,
          marginBottom: headerMarginBottom,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text
            style={[
              styles.title,
              {
                color: STARK_WHITE,
                fontSize: titleSize,
                lineHeight: titleSize * 1.25,
              },
            ]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[
                styles.subtitle,
                {
                  color: MUTED_SLATE,
                  fontSize: subtitleSize,
                  lineHeight: subtitleSize * 1.4,
                },
              ]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {showRunChrome ? (
          <View style={styles.headerChrome}>
            <RunEventHeaderChrome />
          </View>
        ) : null}
      </View>
      {showCargoPressure ? (
        <CargoPressurePanel
          cargo={activeIncursion.cargo}
          accentColor="#f59e0b"
          mutedColor={theme.mutedColor}
          compact
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    borderBottomWidth: 1,
    flexShrink: 0,
    alignSelf: 'stretch',
    zIndex: 3,
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
    alignItems: 'flex-start',
  },
  headerChrome: {
    flexShrink: 0,
    alignSelf: 'flex-end',
    zIndex: 4,
  },
  headerChromeRow: {
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0,
  },
  title: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'left',
  },
  subtitle: {
    fontFamily: 'monospace',
    fontWeight: '600',
    letterSpacing: 0.8,
    textAlign: 'left',
  },
});
