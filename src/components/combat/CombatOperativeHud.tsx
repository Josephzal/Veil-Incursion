import React from 'react';
import { StyleSheet, View } from 'react-native';
import CombatTelemetryGaugeRow from './CombatHorizontalGauge';
import {
  GAUGE_ABYSSAL,
  GAUGE_SOUL_ANCHOR,
  GAUGE_STAMINA,
  GAUGE_TRACK_BORDER,
} from '../../utils/combatTelemetryFormat';

export interface CombatOperativeTelemetry {
  operativeHp: number;
  maxSoulAnchor: number;
  abyssalReserve: number;
  stamina: number;
  maxStamina: number;
  counterReady: boolean;
}

interface CombatOperativeHudProps {
  telemetry: CombatOperativeTelemetry;
  labelColor?: string;
  primaryColor?: string;
  wide?: boolean;
  deckAligned?: boolean;
}

export default function CombatOperativeHud({
  telemetry,
  labelColor = '#FF453A',
  primaryColor = '#00ff33',
  wide = false,
  deckAligned = false,
}: CombatOperativeHudProps): React.JSX.Element {
  const {
    operativeHp,
    maxSoulAnchor,
    abyssalReserve,
    stamina,
    maxStamina,
    counterReady,
  } = telemetry;

  const soulAnchorRatio = maxSoulAnchor > 0 ? operativeHp / maxSoulAnchor : 0;
  const abyssalRatio = abyssalReserve / 100;
  const staminaRatio = maxStamina > 0 ? stamina / maxStamina : 0;

  const compact = deckAligned || wide;
  const rowVariant = compact ? 'compact' as const : wide ? 'stacked' as const : 'inline' as const;

  return (
    <View style={[
      styles.root,
      wide ? styles.rootWide : null,
      deckAligned ? styles.rootDeckAligned : null,
    ]} pointerEvents="none">
      <CombatTelemetryGaugeRow
        label={`SOUL // ${operativeHp}/${maxSoulAnchor}`}
        labelColor={labelColor}
        fillColor={GAUGE_SOUL_ANCHOR}
        ratio={soulAnchorRatio}
        trackBorderColor={GAUGE_TRACK_BORDER}
        variant={rowVariant}
        gaugeWidth="100%"
      />
      <CombatTelemetryGaugeRow
        label={`AR // ${abyssalReserve}%${counterReady ? ' • CTR' : ''}`}
        labelColor="#00D2C4"
        fillColor={GAUGE_ABYSSAL}
        ratio={abyssalRatio}
        trackBorderColor={GAUGE_TRACK_BORDER}
        variant={rowVariant}
        gaugeWidth="100%"
      />
      <CombatTelemetryGaugeRow
        label={`STM // ${stamina}/${maxStamina}`}
        labelColor={primaryColor}
        fillColor={GAUGE_STAMINA}
        ratio={staminaRatio}
        trackBorderColor={GAUGE_TRACK_BORDER}
        variant={rowVariant}
        gaugeWidth="100%"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 51, 0.25)',
  },
  rootWide: {
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  rootDeckAligned: {
    gap: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
    width: '100%',
  },
});
