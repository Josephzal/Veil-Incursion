import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COMBAT_HUD_TYPE } from '../../constants/combatHudTypography';
import { OTT, OTT_LAYOUT } from '../../constants/occultTacticalTerminalTheme';

const HOSTILE_RED = OTT.soulRed;
const HOSTILE_BORDER = 'rgba(255, 90, 98, 0.72)';
const HOSTILE_FILL = 'rgba(255, 90, 98, 0.06)';

interface CombatHostileTurnPanelProps {
  /** Formatted enemy intent readout (e.g. PAVEMENT CRUSHER CHARGE). */
  intentLabel: string;
  /** Wind-up vs resolving strike. */
  stage: 'reading' | 'executing';
}

/**
 * Replaces the ability deck during hostile turns —
 * red title, thin OTT framing, deck clearly offline.
 * Bottom-aligns with the ultimate module baseline.
 */
export default function CombatHostileTurnPanel({
  intentLabel,
  stage,
}: CombatHostileTurnPanelProps): React.JSX.Element {
  const isReading = stage === 'reading';
  const channelLabel = isReading ? 'HOSTILE CHANNEL' : 'HOSTILE ATTACK';
  const hint = isReading
    ? 'Read incoming intent — command deck offline'
    : 'Strike channel active — brace for impact';

  return (
    <View style={styles.host} pointerEvents="none">
      <View style={styles.main}>
        <View style={styles.offlineBand}>
          <Text style={styles.offlineLabel}>DECK // OFFLINE</Text>
          <View style={styles.offlinePips}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.offlinePip,
                  i === 0 && isReading ? styles.offlinePipHot : null,
                  i === 1 && !isReading ? styles.offlinePipHot : null,
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.accentBar} />
          <View style={styles.body}>
            <Text style={styles.eyebrow}>HOSTILE TURN</Text>
            <View style={styles.rule} />
            <Text style={styles.title} numberOfLines={2}>
              {`>> ${channelLabel} // ${intentLabel}`}
            </Text>
            <Text style={styles.hint} numberOfLines={2}>
              {hint}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.turnColumnSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    justifyContent: 'flex-start',
  },
  main: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    paddingBottom: 0,
  },
  turnColumnSpacer: {
    width: OTT_LAYOUT.consoleSideWidth,
    flexShrink: 0,
  },
  offlineBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 24,
    width: '100%',
    maxWidth: 920,
    paddingHorizontal: 4,
    flexShrink: 0,
  },
  offlineLabel: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.caption,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: OTT.textMuted,
  },
  offlinePips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  offlinePip: {
    width: 7,
    height: 7,
    transform: [{ rotate: '45deg' }],
    borderWidth: 1,
    borderColor: OTT.borderMuted,
    backgroundColor: 'transparent',
  },
  offlinePipHot: {
    borderColor: HOSTILE_RED,
    backgroundColor: 'rgba(255, 90, 98, 0.45)',
    shadowColor: HOSTILE_RED,
    shadowOpacity: 0.7,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  panel: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    maxWidth: 920,
    // Fill remaining console height so the bottom shares the ultimate baseline.
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 120,
    maxHeight: 168,
    borderWidth: 1.25,
    borderColor: HOSTILE_BORDER,
    borderRadius: 2,
    backgroundColor: HOSTILE_FILL,
    overflow: 'hidden',
    shadowColor: HOSTILE_RED,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  accentBar: {
    width: 3,
    backgroundColor: HOSTILE_RED,
  },
  body: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
    backgroundColor: 'rgba(8, 12, 14, 0.82)',
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.caption,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: HOSTILE_RED,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    width: '42%',
    backgroundColor: 'rgba(255, 90, 98, 0.45)',
    marginBottom: 2,
  },
  title: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.emphasis,
    fontWeight: '800',
    letterSpacing: 0.55,
    lineHeight: COMBAT_HUD_TYPE.lineLabel + 2,
    color: HOSTILE_RED,
  },
  hint: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.body,
    fontWeight: '600',
    letterSpacing: 0.35,
    color: OTT.textSecondary,
  },
});
