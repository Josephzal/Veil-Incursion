import React from 'react';
import { StyleSheet, View } from 'react-native';
import CombatConsoleDockFade from '../../../components/combat/ui/CombatConsoleDockFade';
import { OTT_LAYOUT } from '../../../constants/occultTacticalTerminalTheme';

interface CombatTacticalDashboardProps {
  operativeStatus: React.ReactNode;
  commandDeck: React.ReactNode;
  /** Soft-dim the console during end-of-encounter resolution (no solid black wash). */
  resolutionDimmed?: boolean;
  /** ABYSSAL VERDICT peripheral HUD dim (does not scale with world camera). */
  cinematicOpacity?: number;
}

/**
 * Unified bottom combat console — equal side rails | centered command deck.
 * No top rule; dock fade only.
 */
export default function CombatTacticalDashboard({
  operativeStatus,
  commandDeck,
  resolutionDimmed = false,
  cinematicOpacity = 1,
}: CombatTacticalDashboardProps): React.JSX.Element {
  const dimmed = resolutionDimmed || cinematicOpacity < 0.5;
  return (
    <View
      style={[
        styles.dashboard,
        resolutionDimmed ? styles.dashboardDimmed : null,
        !resolutionDimmed && cinematicOpacity < 1 ? { opacity: cinematicOpacity } : null,
      ]}
      pointerEvents={dimmed ? 'none' : 'box-none'}
    >
      {resolutionDimmed ? null : <CombatConsoleDockFade />}
      <View
        style={styles.row}
        pointerEvents={resolutionDimmed ? 'none' : 'box-none'}
      >
        <View style={styles.sidePanel} pointerEvents="box-none">
          <View style={styles.sideContent} pointerEvents="box-none">
            {operativeStatus}
          </View>
        </View>
        <View style={styles.deckPanel} pointerEvents="box-none">
          <View style={styles.deckContent}>{commandDeck}</View>
        </View>
      </View>
    </View>
  );
}

const SIDE = OTT_LAYOUT.consoleSideWidth;

const styles = StyleSheet.create({
  dashboard: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: OTT_LAYOUT.consoleHeightPercent,
    zIndex: 28,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  dashboardDimmed: {
    opacity: 0.28,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 0,
    position: 'relative',
    zIndex: 1,
  },
  sidePanel: {
    width: SIDE,
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 0,
    backgroundColor: 'transparent',
  },
  sideContent: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    /** Match deck: paddingTop 4 + AP band 24 + gap 6 → ability of ability cards. */
    paddingTop: 34,
    paddingBottom: 8,
    paddingHorizontal: 8,
    justifyContent: 'flex-start',
  },
  deckPanel: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    backgroundColor: 'transparent',
  },
  deckContent: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    paddingTop: 4,
    paddingBottom: 12,
    paddingRight: 8,
    paddingLeft: 4,
    overflow: 'hidden',
  },
});
