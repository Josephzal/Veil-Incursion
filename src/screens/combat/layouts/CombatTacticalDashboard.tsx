import React from 'react';
import { StyleSheet, View } from 'react-native';

interface CombatTacticalDashboardProps {
  commandDeck: React.ReactNode;
  macroLog: React.ReactNode;
  hostileIntel: React.ReactNode;
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
        {commandDeck}
      </View>
      <View style={[styles.panel, styles.panelCenter]}>
        {macroLog}
      </View>
      <View style={[styles.panel, styles.panelRight]}>
        {hostileIntel}
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
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: '#222',
    overflow: 'hidden',
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
