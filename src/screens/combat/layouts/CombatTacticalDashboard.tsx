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
 * Unified bottom combat console — left status/ultimate | centered command rail | turn chrome.
 * Content is bottom-anchored so cards and ultimate share one baseline.
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
    zIndex: 40,
    // Visible so ability hover panels can extend above the dock without clipping.
    overflow: 'visible',
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
    overflow: 'visible',
  },
  sideContent: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    paddingTop: 2,
    paddingBottom: 10,
    paddingHorizontal: 10,
    // Shared baseline with command dock / End Turn (~8–12px from viewport edge).
    justifyContent: 'flex-end',
  },
  deckPanel: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  deckContent: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    paddingTop: 0,
    paddingBottom: 10,
    paddingRight: 8,
    paddingLeft: 4,
    overflow: 'visible',
    justifyContent: 'flex-end',
  },
});
