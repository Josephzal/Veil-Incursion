import React from 'react';
import { StyleSheet, View } from 'react-native';
import TurnOrderColumn from '../../../components/combat/readout/TurnOrderColumn';
import type { ClassType } from '../../../types/game';
import type { CombatTurnOrderSnapshot } from '../../../utils/combatTurnOrder';
import type { ImageSourcePropType } from 'react-native';
import {
  OPERATIVE_VITALS_OVERLAY_TOP,
} from '../../../constants/combatLayout';
import { useCombatDesktopLayout } from '../../../hooks/useCombatDesktopLayout';

interface TurnOrderSidebarProps {
  turnOrder?: CombatTurnOrderSnapshot | null;
  gridUnits: readonly { unitId: string; portraitSource: ImageSourcePropType }[];
  operativeClass?: ClassType;
  primaryColor: string;
  mutedColor: string;
  selectedUnitId?: string | null;
  onHostilePress?: (unitId: string) => void;
}

/** Arena overlay — vertical turn order centered above the dashboard intel column. */
export default function TurnOrderSidebar({
  turnOrder,
  gridUnits,
  operativeClass,
  primaryColor,
  mutedColor,
  selectedUnitId,
  onHostilePress,
}: TurnOrderSidebarProps): React.JSX.Element {
  const { isCombatDesktop, scaleCombatSize } = useCombatDesktopLayout();

  return (
    <View
      style={[
        styles.sidebar,
        isCombatDesktop ? { width: scaleCombatSize(80), paddingHorizontal: scaleCombatSize(6) } : null,
      ]}
      pointerEvents="box-none"
    >
      <TurnOrderColumn
        turnOrder={turnOrder}
        gridUnits={gridUnits}
        operativeClass={operativeClass}
        primaryColor={primaryColor}
        mutedColor={mutedColor}
        overlay
        selectedUnitId={selectedUnitId}
        onHostilePress={onHostilePress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    position: 'absolute',
    right: 0,
    top: OPERATIVE_VITALS_OVERLAY_TOP,
    width: 60,
    zIndex: 20,
    elevation: 20,
    pointerEvents: 'box-none',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingHorizontal: 4,
  },
});
