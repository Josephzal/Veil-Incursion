import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ClassType } from '../../types/game';
import { RUNIC_BRAND_CAP } from '../../types/aegisCombat';
import CombatTelemetryGaugeRow from './CombatHorizontalGauge';
import CombatMagazineGauge from './CombatMagazineGauge';
import CombatVeilRotGauge from './CombatVeilRotGauge';
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
import { useCombatDesktopLayout } from '../../hooks/useCombatDesktopLayout';
import ResourceRail from './ui/ResourceRail';
import { OTT } from '../../constants/occultTacticalTerminalTheme';

export interface CombatOperativeTelemetry {
  operativeClass: ClassType;
  operativeHp: number;
  maxSoulAnchor: number;
  maxAnchorDebt?: number;
  trueMaxSoulAnchor?: number;
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
  /** Hex Shot ammo-type refactor v1. */
  hexAmmoType?: import('../../types/hexAmmo').HexAmmoType;
  hexProtocolCharges?: number;
  hexMaxProtocolCharges?: number;
  hexNextShotOvercharged?: boolean;
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
  /** Bottom-console operative status (Occult Tactical Terminal). */
  consolePanel?: boolean;
}

export default function CombatOperativeHud({
  telemetry,
  labelColor = OTT.soulRed,
  primaryColor = OTT.terminalGreenMuted,
  wide = false,
  deckAligned = false,
  dashboardCompact = false,
  arenaOverlay = false,
  consolePanel = false,
}: CombatOperativeHudProps): React.JSX.Element {
  const { isCombatDesktop, fontScale, scaleCombatSize } = useCombatDesktopLayout();
  const desktopArena = arenaOverlay && isCombatDesktop;
  const labelScale = desktopArena ? fontScale : 1;
  const gaugeHeight = desktopArena ? scaleCombatSize(14) : undefined;
  const {
    operativeClass,
    operativeHp,
    maxSoulAnchor,
    maxAnchorDebt = 0,
    trueMaxSoulAnchor,
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
    hexAmmoType,
    hexProtocolCharges = 0,
    hexMaxProtocolCharges = 0,
    hexNextShotOvercharged = false,
  } = telemetry;

  const effectiveMax = maxSoulAnchor;
  const soulAnchorRatio = effectiveMax > 0 ? operativeHp / effectiveMax : 0;
  const abyssalRatio = formatAegisReserveRatio(abyssalReserve, abyssalCap);
  const staminaRatio = maxStamina > 0 ? stamina / maxStamina : 0;
  const fluxRatio = fluxMaxCap > 0 ? Math.min(1, veilFlux / fluxMaxCap) : 0;

  const compact = deckAligned || wide || dashboardCompact || consolePanel;
  const rowVariant = desktopArena
    ? 'stacked' as const
    : dashboardCompact || consolePanel
      ? 'compact' as const
      : compact
        ? 'compact' as const
        : wide
          ? 'stacked' as const
          : 'inline' as const;
  const resourceVariant = desktopArena ? 'stacked' as const : rowVariant === 'stacked' ? 'stacked' as const : 'compact' as const;
  const gaugeProps = {
    labelFontScale: labelScale,
    trackHeight: gaugeHeight,
    gaugeWidth: '100%' as const,
  };

  if (consolePanel) {
    const className =
      operativeClass === 'HEX_SHOT' ? 'HEX SHOT' : operativeClass === 'ENVOY' ? 'ENVOY' : 'AEGIS';
    const secondaryLabel = operativeClass === 'ENVOY'
      ? 'FLUX'
      : operativeClass === 'HEX_SHOT'
        ? 'STM'
        : 'GUARD';
    const secondaryValue = operativeClass === 'ENVOY'
      ? `${Math.round(veilFlux)}/${fluxMaxCap}`
      : operativeClass === 'HEX_SHOT'
        ? `${stamina}/${maxStamina}`
        : `${Math.round(abyssalReserve)}/${abyssalCap}`;
    const secondaryRatio = operativeClass === 'ENVOY'
      ? fluxRatio
      : operativeClass === 'HEX_SHOT'
        ? staminaRatio
        : abyssalRatio;
    const secondaryColor = operativeClass === 'ENVOY'
      ? OTT.fluxViolet
      : operativeClass === 'HEX_SHOT'
        ? OTT.terminalGreenMuted
        : '#9BB0B8';
    const passiveLine = operativeClass === 'AEGIS'
      ? 'Gain Guard after successful Guard.'
      : operativeClass === 'HEX_SHOT'
        ? 'Chamber bonus after tactical reload.'
        : 'Veil Rot escalates occult pressure.';
    return (
      <View style={styles.rootConsole} pointerEvents="none">
        <Text style={styles.consoleClass}>{className}</Text>
        <Text style={styles.consoleSubtitle}>VEIL RUNNER</Text>
        <ResourceRail
          label="HP"
          valueLabel={`${operativeHp}/${effectiveMax} HP`}
          ratio={soulAnchorRatio}
          fillColor={OTT.soulRed}
        />
        <ResourceRail
          label={secondaryLabel}
          valueLabel={`${secondaryValue} ${secondaryLabel}`}
          ratio={secondaryRatio}
          fillColor={secondaryColor}
        />
        {operativeClass === 'AEGIS' ? (
          <CombatRunicBrandGauge currentBrands={runicBrands} maxBrands={runicBrandCap} variant="compact" />
        ) : null}
        {operativeClass === 'HEX_SHOT' ? (
          <CombatMagazineGauge
            currentAmmo={currentAmmo}
            maxAmmo={maxAmmo}
            overchargeMultiplier={overchargeMultiplier}
            markReady={zeroProtocolReady}
            labelColor={OTT.warningAmber}
            variant="compact"
            ammoType={hexAmmoType}
            protocolCharges={hexProtocolCharges}
            maxProtocolCharges={hexMaxProtocolCharges}
            nextShotOvercharged={hexNextShotOvercharged}
          />
        ) : null}
        {operativeClass === 'ENVOY' ? (
          <CombatVeilRotGauge totalStacks={veilRotStacksTotal} variant="compact" />
        ) : null}
        <View style={styles.passiveBlock}>
          <Text style={styles.passiveHeader}>PASSIVE</Text>
          <Text style={styles.passiveBody} numberOfLines={2}>{passiveLine}</Text>
        </View>
      </View>
    );
  }

  const renderClassResource = () => {
    if (operativeClass === 'HEX_SHOT') {
      return (
        <CombatMagazineGauge
          currentAmmo={currentAmmo}
          maxAmmo={maxAmmo}
          overchargeMultiplier={overchargeMultiplier}
          markReady={zeroProtocolReady}
          labelColor="#fbbf24"
          variant={resourceVariant}
          labelFontScale={labelScale}
          ammoType={hexAmmoType}
          protocolCharges={hexProtocolCharges}
          maxProtocolCharges={hexMaxProtocolCharges}
          nextShotOvercharged={hexNextShotOvercharged}
        />
      );
    }
    if (operativeClass === 'ENVOY') {
      return (
        <>
          <CombatTelemetryGaugeRow
            label={`FLUX // ${Math.round(veilFlux)}%${envoyVoidSiphoned ? ' // VOID-SIPHONED' : ''}${envoySilenced ? ' // SILENCED' : ''}`}
            labelColor="#c084fc"
            fillColor={GAUGE_VEIL_FLUX}
            ratio={fluxRatio}
            trackBorderColor={GAUGE_TRACK_BORDER}
            variant={rowVariant}
            {...gaugeProps}
          />
          <CombatVeilRotGauge
            totalStacks={veilRotStacksTotal}
            variant={resourceVariant}
            labelFontScale={labelScale}
          />
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
          {...gaugeProps}
        />
        <CombatRunicBrandGauge
          currentBrands={runicBrands}
          maxBrands={runicBrandCap}
          variant={resourceVariant}
          labelFontScale={labelScale}
          sigilScale={desktopArena ? fontScale : 1}
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
      desktopArena ? styles.rootArenaOverlayDesktop : null,
    ]} pointerEvents="none">
      <CombatTelemetryGaugeRow
        label={formatSoulAnchorLabel(operativeHp, effectiveMax, {
          debt: maxAnchorDebt,
          trueMax: trueMaxSoulAnchor ?? effectiveMax,
        })}
        labelColor={labelColor}
        fillColor={GAUGE_SOUL_ANCHOR}
        ratio={soulAnchorRatio}
        trackBorderColor={GAUGE_TRACK_BORDER}
        variant={rowVariant}
        {...gaugeProps}
      />
      {renderClassResource()}
      {operativeClass === 'HEX_SHOT' ? (
        <CombatTelemetryGaugeRow
          label={`STM // ${stamina}/${maxStamina}`}
          labelColor={primaryColor}
          fillColor={GAUGE_STAMINA}
          ratio={staminaRatio}
          trackBorderColor={GAUGE_TRACK_BORDER}
          variant={rowVariant}
          {...gaugeProps}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rootConsole: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    gap: 5,
    paddingHorizontal: 2,
    paddingTop: 0,
    justifyContent: 'center',
  },
  consoleClass: {
    fontFamily: OTT.mono,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: OTT.textPrimary,
  },
  consoleSubtitle: {
    fontFamily: OTT.mono,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1,
    color: OTT.textSecondary,
    marginBottom: 2,
  },
  passiveBlock: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: OTT.borderMuted,
    gap: 2,
  },
  passiveHeader: {
    fontFamily: OTT.mono,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: OTT.terminalGreenMuted,
  },
  passiveBody: {
    fontFamily: OTT.mono,
    fontSize: 7,
    lineHeight: 9,
    color: OTT.textSecondary,
  },
  root: {
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    borderWidth: 1,
    borderColor: OTT.borderSubtle,
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
    gap: 2,
    paddingHorizontal: COMBAT_HUD_PADDING_X,
    paddingVertical: 4,
    width: '100%',
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  rootArenaOverlayDesktop: {
    gap: 4,
    paddingVertical: 6,
  },
});
