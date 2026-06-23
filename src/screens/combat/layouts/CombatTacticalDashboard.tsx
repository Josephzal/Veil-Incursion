import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  TACTICAL_DASHBOARD_PANEL_BORDER_COLOR,
  TACTICAL_DASHBOARD_PANEL_CONTENT_PADDING_TOP,
  TACTICAL_DASHBOARD_PANEL_PADDING,
} from '../../../constants/combatLayout';

interface CombatTacticalDashboardProps {
  commandDeck: React.ReactNode;
  macroLog: React.ReactNode;
  hostileIntel: React.ReactNode;
}

function DashboardPanelContent({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View style={styles.panelContent}>{children}</View>;
}

/** Fixed bottom 30% — strict 3-column command / log / intel layout. */
export default function CombatTacticalDashboard({
  commandDeck,
  macroLog,
  hostileIntel,
}: CombatTacticalDashboardProps): React.JSX.Element {
  return (
    <View style={styles.dashboard}>
      <View style={[styles.panel, styles.panelLeft]}>
        <DashboardPanelContent>{commandDeck}</DashboardPanelContent>
      </View>
      <View style={[styles.panel, styles.panelCenter]}>
        <DashboardPanelContent>{macroLog}</DashboardPanelContent>
      </View>
      <View style={[styles.panel, styles.panelRight]}>
        <DashboardPanelContent>{hostileIntel}</DashboardPanelContent>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dashboard: {
    height: '30%',
    flexShrink: 0,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: 'rgba(10, 10, 15, 0.95)',
    borderTopWidth: 2,
    borderTopColor: '#333',
  },
  panel: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    paddingHorizontal: TACTICAL_DASHBOARD_PANEL_PADDING,
    paddingBottom: TACTICAL_DASHBOARD_PANEL_PADDING,
    paddingTop: 0,
    borderRightWidth: 1,
    borderRightColor: '#222',
    overflow: 'hidden',
  },
  panelContent: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: TACTICAL_DASHBOARD_PANEL_BORDER_COLOR,
    paddingTop: TACTICAL_DASHBOARD_PANEL_CONTENT_PADDING_TOP,
  },
  panelLeft: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  panelCenter: {
    flexDirection: 'column',
  },
  panelRight: {
    borderRightWidth: 0,
    flexDirection: 'column',
  },
});
