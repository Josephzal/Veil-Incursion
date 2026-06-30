import React from 'react';
import { StyleSheet, View } from 'react-native';
import CombatOperativeHud, {
  type CombatOperativeTelemetry,
} from '../../../components/combat/CombatOperativeHud';
import {
  OPERATIVE_VITALS_OVERLAY_TOP,
  TACTICAL_DASHBOARD_COLUMN_WIDTH_PERCENT,
} from '../../../constants/combatLayout';
import { useCombatDesktopLayout } from '../../../hooks/useCombatDesktopLayout';

interface CombatOperativeVitalsOverlayProps {
  telemetry: CombatOperativeTelemetry | null;
  primaryColor: string;
}

/** Player SOUL / class resource / STM gauges pinned to the arena upper-left. */
export default function CombatOperativeVitalsOverlay({
  telemetry,
  primaryColor,
}: CombatOperativeVitalsOverlayProps): React.JSX.Element | null {
  const { isCombatDesktop, scaleCombatSize } = useCombatDesktopLayout();

  if (!telemetry) return null;

  return (
    <View
      style={[
        styles.host,
        isCombatDesktop ? { paddingHorizontal: scaleCombatSize(10) } : null,
      ]}
      pointerEvents="none"
    >
      <CombatOperativeHud
        telemetry={telemetry}
        primaryColor={primaryColor}
        deckAligned
        arenaOverlay
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: OPERATIVE_VITALS_OVERLAY_TOP,
    left: 0,
    width: TACTICAL_DASHBOARD_COLUMN_WIDTH_PERCENT,
    zIndex: 25,
    elevation: 25,
    overflow: 'hidden',
  },
});
