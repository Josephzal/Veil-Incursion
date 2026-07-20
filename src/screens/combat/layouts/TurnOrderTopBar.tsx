import React, { useMemo } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
import CombatTurnOrderTimeline from '../../../components/combat/CombatTurnOrderTimeline';
import type { ClassType } from '../../../types/game';
import type { CombatTurnOrderSnapshot } from '../../../utils/combatTurnOrder';
import { OTT, OTT_LAYOUT } from '../../../constants/occultTacticalTerminalTheme';

interface TurnOrderTopBarProps {
  turnOrder?: CombatTurnOrderSnapshot | null;
  gridUnits: readonly { unitId: string; portraitSource: ImageSourcePropType }[];
  operativeClass?: ClassType;
  primaryColor?: string;
  mutedColor?: string;
  selectedUnitId?: string | null;
  onHostilePress?: (unitId: string) => void;
}

/** Top-center compact diamond turn-order timeline. */
export default function TurnOrderTopBar({
  turnOrder,
  gridUnits,
  primaryColor = OTT.terminalGreen,
  mutedColor = OTT.textMuted,
}: TurnOrderTopBarProps): React.JSX.Element {
  const portraitsById = useMemo(() => {
    const map: Record<string, ImageSourcePropType> = {};
    for (const unit of gridUnits) {
      map[unit.unitId] = unit.portraitSource;
    }
    return map;
  }, [gridUnits]);

  return (
    <View style={styles.host} pointerEvents="box-none">
      <CombatTurnOrderTimeline
        turnOrder={turnOrder}
        primaryColor={primaryColor}
        mutedColor={mutedColor}
        portraitsById={portraitsById}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: OTT_LAYOUT.turnOrderTop,
    left: 0,
    right: 0,
    zIndex: 24,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
});
