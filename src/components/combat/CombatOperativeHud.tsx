import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ClassType } from '../../types/game';
import { RUNIC_BRAND_CAP } from '../../types/aegisCombat';
import CombatTelemetryGaugeRow from './CombatHorizontalGauge';
import CombatMagazineGauge from './CombatMagazineGauge';
import {
  COMBAT_HUD_PADDING_X,
} from './combatGaugeMetrics';
import {
  formatAegisReserveLabel,
  formatAegisReserveRatio,
  formatSoulAnchorLabel,
  GAUGE_ABYSSAL,
  GAUGE_SOUL_ANCHOR,
  GAUGE_STAMINA,
  GAUGE_TRACK_BORDER,
  GAUGE_VEIL_FLUX,
} from '../../utils/combatTelemetryFormat';
import CombatRunicBrandGauge from './CombatRunicBrandGauge';

export interface CombatOperativeTelemetry {
  operativeClass: ClassType;
  operativeHp: number;
  maxSoulAnchor: number;
  stamina: number;
  maxStamina: number;
  abyssalReserve?: number;
  abyssalCap?: number;
  counterReady?: boolean;
  voidWardPrimed?: boolean;
  runicBrands?: number;
  runicBrandCap?: number;
  eviscerateReady?: boolean;
  currentAmmo?: number;
  maxAmmo?: number;
  overchargeMultiplier?: number;
  /** Aegis narrative / Demon's Lung overcharge flag. */
  overcharged?: boolean;
  zeroProtocolReady?: boolean;
  veilFlux?: number;
  fluxMaxCap?: number;
  envoyVoidSiphoned?: boolean;
  envoySilenced?: boolean;
  veilRotStacksTotal?: number;
  catalyticPayloadEstimate?: number;
}

interface CombatOperativeHudProps {
  telemetry: CombatOperativeTelemetry;
  labelColor?: string;
  primaryColor?: string;
  wide?: boolean;
  deckAligned?: boolean;
  dashboardCompact?: boolean;
  /** Semi-transparent panel for the arena upper-left vitals overlay. */
  arenaOverlay?: boolean;
}

export default function CombatOperativeHud({
  telemetry,
  labelColor = '#FF453A',
  primaryColor = '#00ff33',
  wide = false,
  deckAligned = false,
  dashboardCompact = false,
  arenaOverlay = false,
}: CombatOperativeHudProps): React.JSX.Element {
  const {
    operativeClass,
    operativeHp,
    maxSoulAnchor,
    abyssalReserve = 0,
    abyssalCap = 100,
    stamina,
    maxStamina,
    voidWardPrimed = false,
    runicBrands = 0,
    runicBrandCap = RUNIC_BRAND_CAP,
    eviscerateReady = false,
    currentAmmo = 0,
    maxAmmo = 6,
    overchargeMultiplier = 0,
    overcharged = false,
    zeroProtocolReady = false,
    veilFlux = 0,
    fluxMaxCap = 100,
    envoyVoidSiphoned = false,
    envoySilenced = false,
    veilRotStacksTotal = 0,
    catalyticPayloadEstimate = 0,
  } = telemetry;

  const soulAnchorRatio = maxSoulAnchor > 0 ? operativeHp / maxSoulAnchor : 0;
  const abyssalRatio = formatAegisReserveRatio(abyssalReserve, abyssalCap);
  const staminaRatio = maxStamina > 0 ? stamina / maxStamina : 0;
  const fluxRatio = fluxMaxCap > 0 ? Math.min(1, veilFlux / fluxMaxCap) : 0;

  const compact = deckAligned || wide || dashboardCompact;
  const rowVariant = dashboardCompact
    ? 'compact' as const
    : compact
      ? 'compact' as const
      : wide
        ? 'stacked' as const
        : 'inline' as const;

  const renderClassResource = () => {
    if (operativeClass === 'HEX_SHOT') {
      return (
        <CombatMagazineGauge
          currentAmmo={currentAmmo}
          maxAmmo={maxAmmo}
          overchargeMultiplier={overchargeMultiplier}
          markReady={zeroProtocolReady}
          labelColor="#fbbf24"
          variant={rowVariant === 'stacked' ? 'stacked' : 'compact'}
        />
      );
    }
    if (operativeClass === 'ENVOY') {
      return (
        <>
          <CombatTelemetryGaugeRow
            label={`VEIL-FLUX // ${Math.round(veilFlux)}%${envoyVoidSiphoned ? ' // VOID-SIPHONED' : ''}${envoySilenced ? ' // SILENCED' : ''}`}
            labelColor="#c084fc"
            fillColor={GAUGE_VEIL_FLUX}
            ratio={fluxRatio}
            trackBorderColor={GAUGE_TRACK_BORDER}
            variant={rowVariant}
            gaugeWidth="100%"
          />
          {veilRotStacksTotal > 0 ? (
            <CombatTelemetryGaugeRow
              label={`VEIL ROT // ${veilRotStacksTotal} STACK${veilRotStacksTotal === 1 ? '' : 'S'} — CATALYST ~${catalyticPayloadEstimate} OCCULT`}
              labelColor="#4ade80"
              fillColor="#22c55e"
              ratio={Math.min(1, veilRotStacksTotal / 12)}
              trackBorderColor={GAUGE_TRACK_BORDER}
              variant={rowVariant}
              gaugeWidth="100%"
            />
          ) : null}
        </>
      );
    }
    return (
      <>
        <CombatTelemetryGaugeRow
          label={formatAegisReserveLabel(abyssalReserve, abyssalCap, {
            voidWardPrimed,
            overcharged,
            eviscerateReady,
          })}
          labelColor="#00D2C4"
          fillColor={GAUGE_ABYSSAL}
          ratio={abyssalRatio}
          trackBorderColor={GAUGE_TRACK_BORDER}
          variant={rowVariant}
          gaugeWidth="100%"
        />
        <CombatRunicBrandGauge
          currentBrands={runicBrands}
          maxBrands={runicBrandCap}
          variant={rowVariant === 'stacked' ? 'stacked' : 'compact'}
        />
      </>
    );
  };

  return (
    <View style={[
      styles.root,
      wide ? styles.rootWide : null,
      deckAligned && !arenaOverlay ? styles.rootDeckAligned : null,
      dashboardCompact ? styles.rootDashboardCompact : null,
      arenaOverlay ? styles.rootArenaOverlay : null,
    ]} pointerEvents="none">
      <CombatTelemetryGaugeRow
        label={formatSoulAnchorLabel(operativeHp, maxSoulAnchor)}
        labelColor={labelColor}
        fillColor={GAUGE_SOUL_ANCHOR}
        ratio={soulAnchorRatio}
        trackBorderColor={GAUGE_TRACK_BORDER}
        variant={rowVariant}
        gaugeWidth="100%"
      />
      {renderClassResource()}
      {operativeClass !== 'AEGIS' ? (
        <CombatTelemetryGaugeRow
          label={`STM // ${stamina}/${maxStamina}`}
          labelColor={primaryColor}
          fillColor={GAUGE_STAMINA}
          ratio={staminaRatio}
          trackBorderColor={GAUGE_TRACK_BORDER}
          variant={rowVariant}
          gaugeWidth="100%"
        />
      ) : null}
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
  rootDashboardCompact: {
    gap: 1,
    paddingHorizontal: 4,
    paddingVertical: 3,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 51, 0.2)',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  rootArenaOverlay: {
    gap: 1,
    paddingHorizontal: COMBAT_HUD_PADDING_X,
    paddingVertical: 4,
    width: '100%',
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
});
