import React from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import { IconBadge } from './VeilFrontUiPrimitives';
import { useVeilFrontLayout } from './useVeilFrontLayout';
import { useWorldState } from '../../context/WorldStateContext';
import { getRecentlySuppressedAnchor } from '../../data/anchorLifecycleEngine';
import type { SectorState } from '../../types/worldState';
import { TerminalTheme } from '../../types/theme';
import { describeAnchorInRunPressure } from '../../utils/veilFrontSectorUi';

interface ActiveAnchorCardProps {
  theme: TerminalTheme;
  sector: SectorState;
}

export default function ActiveAnchorCard({
  theme,
  sector,
}: ActiveAnchorCardProps): React.JSX.Element {
  const { scaleSpacing, scaleSize, scaleFont } = useVeilFrontLayout();
  const { persisted } = useWorldState();
  const suppressed = getRecentlySuppressedAnchor(persisted, sector.id);
  const pressureLines = sector.activeAnchor
    ? describeAnchorInRunPressure(sector.activeAnchor)
    : [];

  return (
    <View
      style={[
        styles.card,
        {
          padding: scaleSpacing(14),
          borderColor: 'rgba(168, 85, 247, 0.35)',
          gap: scaleSpacing(8),
        },
      ]}
    >
      <TerminalText
        size={scaleFont(7)}
        letterSpacing={1}
        style={{ color: '#a855f7', fontWeight: '700' }}
      >
        ACTIVE ANCHOR
      </TerminalText>

      <View style={styles.bodyContent}>
        {sector.activeAnchor ? (
          <>
            <View style={[styles.titleRow, { gap: scaleSpacing(8) }]}>
              <IconBadge icon="◈" accentColor="#a855f7" size={scaleSize(22)} />
              <View style={styles.titleText}>
                <TerminalText
                  size={scaleFont(10)}
                  letterSpacing={0.4}
                  style={{ color: theme.textColor, fontWeight: '700' }}
                  numberOfLines={1}
                >
                  {sector.activeAnchor.displayName}
                </TerminalText>
                <TerminalText
                  size={scaleFont(7.5)}
                  style={{ color: theme.mutedColor, marginTop: scaleSpacing(3), lineHeight: scaleSize(12) }}
                  numberOfLines={3}
                >
                  {sector.activeAnchor.description}
                </TerminalText>
              </View>
            </View>
            {pressureLines.length > 0 ? (
              <>
                <TerminalText
                  size={scaleFont(6.5)}
                  letterSpacing={0.7}
                  style={{ color: theme.mutedColor, marginTop: scaleSpacing(4) }}
                >
                  IN-RUN PRESSURE
                </TerminalText>
                {pressureLines.map((line) => (
                  <TerminalText
                    key={line}
                    size={scaleFont(7)}
                    style={{ color: theme.textColor, lineHeight: scaleSize(12) }}
                  >
                    {`• ${line}`}
                  </TerminalText>
                ))}
              </>
            ) : null}
            {suppressed && suppressed.remainingRuns > 0 ? (
              <TerminalText
                size={scaleFont(6.5)}
                style={{ color: theme.mutedColor, marginTop: scaleSpacing(4), lineHeight: scaleSize(11) }}
              >
                {`Aftermath: ${suppressed.displayName} suppressed for ${suppressed.remainingRuns} run(s).`}
              </TerminalText>
            ) : null}
          </>
        ) : (
          <>
            <TerminalText size={scaleFont(9)} style={{ color: theme.mutedColor, fontWeight: '700' }}>
              No Active Anchor
            </TerminalText>
            <TerminalText size={scaleFont(7.5)} style={{ color: theme.mutedColor, lineHeight: scaleSize(12) }}>
              Sector instability is low. Standard breach conditions apply.
            </TerminalText>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    borderWidth: 1,
    backgroundColor: 'rgba(18, 28, 44, 0.88)',
    overflow: 'hidden',
  },
  bodyContent: {
    flex: 1,
    minHeight: 0,
    gap: 4,
    overflow: 'hidden',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  titleText: {
    flex: 1,
    minWidth: 0,
  },
});
