import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ClassType } from '../../types/game';
import CombatTelemetryGaugeRow from './CombatHorizontalGauge';
import CombatMagazineGauge from './CombatMagazineGauge';
import {
  GAUGE_ABYSSAL,
  GAUGE_SOUL_ANCHOR,
  GAUGE_STAMINA,
  GAUGE_TRACK_BORDER,
  GAUGE_VEIL_FLUX,
} from '../../utils/combatTelemetryFormat';

export interface CombatOperativeTelemetry {
  operativeClass: ClassType;
  operativeHp: number;
  maxSoulAnchor: number;
  stamina: number;
  maxStamina: number;
  abyssalReserve?: number;
  counterReady?: boolean;
  currentAmmo?: number;
  maxAmmo?: number;
  overcharged?: boolean;
  veilFlux?: number;
  envoyOverloaded?: boolean;
  envoySilenced?: boolean;
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
    operativeClass,
    operativeHp,
    maxSoulAnchor,
    abyssalReserve = 0,
    stamina,
    maxStamina,
    counterReady = false,
    currentAmmo = 0,
    maxAmmo = 6,
    overcharged = false,
    veilFlux = 0,
    envoyOverloaded = false,
    envoySilenced = false,
  } = telemetry;

  const soulAnchorRatio = maxSoulAnchor > 0 ? operativeHp / maxSoulAnchor : 0;
  const abyssalRatio = abyssalReserve / 100;
  const staminaRatio = maxStamina > 0 ? stamina / maxStamina : 0;
  const fluxRatio = Math.min(1, veilFlux / 100);

  const compact = deckAligned || wide;
  const rowVariant = compact ? 'compact' as const : wide ? 'stacked' as const : 'inline' as const;

  const renderClassResource = () => {
    if (operativeClass === 'HEX_SHOT') {
      return (
        <CombatMagazineGauge
          currentAmmo={currentAmmo}
          maxAmmo={maxAmmo}
          overcharged={overcharged}
          labelColor="#fbbf24"
          variant={rowVariant === 'stacked' ? 'stacked' : 'compact'}
        />
      );
    }
    if (operativeClass === 'ENVOY') {
      return (
        <CombatTelemetryGaugeRow
          label={`VEIL-FLUX // ${Math.round(veilFlux)}%${envoyOverloaded ? ' // OVERLOADED' : ''}${envoySilenced ? ' // SILENCED' : ''}`}
          labelColor="#c084fc"
          fillColor={GAUGE_VEIL_FLUX}
          ratio={fluxRatio}
          trackBorderColor={GAUGE_TRACK_BORDER}
          variant={rowVariant}
          gaugeWidth="100%"
        />
      );
    }
    return (
      <CombatTelemetryGaugeRow
        label={`AR // ${abyssalReserve}%${counterReady ? ' • CTR' : ''}`}
        labelColor="#00D2C4"
        fillColor={GAUGE_ABYSSAL}
        ratio={abyssalRatio}
        trackBorderColor={GAUGE_TRACK_BORDER}
        variant={rowVariant}
        gaugeWidth="100%"
      />
    );
  };

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
      {renderClassResource()}
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
