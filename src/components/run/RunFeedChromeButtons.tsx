import React from 'react';
import { StyleSheet, View } from 'react-native';
import TacticalButton from '../TacticalButton';
import { useCargoOverlay } from '../../context/CargoOverlayContext';
import { useRunStatusOverlay } from '../../context/RunStatusOverlayContext';

interface RunFeedChromeButtonsProps {
  accent: string;
  mutedColor: string;
}

/** STATUS / CARGO controls — shared by scanner data feed and run global chrome. */
export default function RunFeedChromeButtons({
  accent,
  mutedColor,
}: RunFeedChromeButtonsProps): React.JSX.Element | null {
  const cargo = useCargoOverlay();
  const status = useRunStatusOverlay();
  const showStatus = status?.statusEnabled ?? false;
  const showCargo = cargo?.cargoEnabled ?? false;

  if (!showStatus && !showCargo) return null;

  return (
    <View style={styles.row}>
      {showStatus ? (
        <TacticalButton
          label="STATUS"
          active={false}
          onPress={status!.openStatus}
          accentColor={accent}
          mutedColor={mutedColor}
          variant="inline"
        />
      ) : null}
      {showCargo ? (
        <TacticalButton
          label="CARGO"
          active={false}
          onPress={cargo!.openCargo}
          accentColor={accent}
          mutedColor={mutedColor}
          variant="inline"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0,
  },
});
