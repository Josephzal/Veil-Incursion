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
import WeaponCombatCalloutStrip from './WeaponCombatCalloutStrip';
import { resolveWeaponCombatCallouts } from '../../data/weaponPlayerFacing/weaponPlayerFacingEngine';
import { useCombatDesktopLayout } from '../../hooks/useCombatDesktopLayout';
import ResourceRail from './ui/ResourceRail';
import AbyssalVerdictUltimateModule from './AbyssalVerdictUltimateModule';
import type { AbyssalVerdictHudSnapshot } from '../../data/abyssalVerdictReadyUi';
import { OTT } from '../../constants/occultTacticalTerminalTheme';
import { COMBAT_HUD_TYPE } from '../../constants/combatHudTypography';

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
  /** Equipped weapon ultimate ready (any class meter + WIRED gate). */
  weaponUltimateReady?: boolean;
  /** Player-facing ultimate display name for HUD chips. */
  weaponUltimateDisplayName?: string;
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
  /** Phase 3L — weapon-loop HUD fields (optional; omit when unknown). */
  activeWeaponFamilyId?: import('../../types/weapon').WeaponFamilyId;
  riftEdgeTempoArmed?: boolean;
  claymoreStaminaCommitted?: boolean;
  perfectReloadWindow?: boolean;
  pulseSpreadSecondaryCount?: number;
  previousCatalyst?: 'NULL' | 'ECHO' | 'BLOOD' | 'ASH' | null;
  cleanCatalystCycleReady?: boolean;
  lanternDetonationReady?: boolean;
  prismBrinkActive?: boolean;
  prismSacrificePreview?: number;
  prismCanPayFullSacrifice?: boolean;
  /** Phase D.2 — Martyr / Juggernaut hit-absorb charges for status strip. */
  hitAbsorbProtectionLabel?: string | null;
  hitAbsorbProtectionHits?: number;
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
  /** Console ultimate module under status (all classes / weapon families). */
  abyssalVerdictUi?: AbyssalVerdictHudSnapshot | null;
  onAbyssalVerdictPrime?: () => void;
  onAbyssalVerdictCancel?: () => void;
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
  abyssalVerdictUi = null,
  onAbyssalVerdictPrime,
  onAbyssalVerdictCancel,
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
    weaponUltimateReady = false,
    weaponUltimateDisplayName,
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

  const ultimateReady = weaponUltimateReady
    || eviscerateReady
    || zeroProtocolReady;
  const ultimateLabel = weaponUltimateDisplayName ?? undefined;

  const effectiveMax = maxSoulAnchor;
  const soulAnchorRatio = effectiveMax > 0 ? operativeHp / effectiveMax : 0;
  const abyssalRatio = formatAegisReserveRatio(abyssalReserve, abyssalCap);
  const staminaRatio = maxStamina > 0 ? stamina / maxStamina : 0;
  const fluxRatio = fluxMaxCap > 0 ? Math.min(1, veilFlux / fluxMaxCap) : 0;

  const weaponCallouts = telemetry.activeWeaponFamilyId
    ? resolveWeaponCombatCallouts({
      weaponFamilyId: telemetry.activeWeaponFamilyId,
      operativeClass,
      abyssalReserve,
      stamina,
      maxStamina,
      riftEdgeTempoArmed: telemetry.riftEdgeTempoArmed,
      claymoreStaminaCommitted: telemetry.claymoreStaminaCommitted,
      currentAmmo,
      maxAmmo,
      hexProtocolCharges,
      hexMaxProtocolCharges,
      zeroProtocolReady: ultimateReady && operativeClass === 'HEX_SHOT',
      weaponUltimateReady: ultimateReady,
      weaponUltimateDisplayName: ultimateLabel,
      hexNextShotOvercharged,
      perfectReloadWindow: telemetry.perfectReloadWindow,
      pulseSpreadSecondaryCount: telemetry.pulseSpreadSecondaryCount,
      veilFlux,
      fluxMaxCap,
      previousCatalyst: telemetry.previousCatalyst,
      cleanCatalystCycleReady: telemetry.cleanCatalystCycleReady,
      veilRotStacksTotal,
      lanternDetonationReady: telemetry.lanternDetonationReady,
      prismBrinkActive: telemetry.prismBrinkActive,
      prismSacrificePreview: telemetry.prismSacrificePreview,
      prismCanPayFullSacrifice: telemetry.prismCanPayFullSacrifice,
    })
    : [];
  const protectionHits = telemetry.hitAbsorbProtectionHits ?? 0;
  const protectionLabel = telemetry.hitAbsorbProtectionLabel ?? null;
  const statusCallouts = [
    ...(protectionHits > 0 && protectionLabel
      ? [{
        id: 'hit-absorb-protection',
        label: `${protectionLabel} ×${protectionHits}`,
        tone: 'ready' as const,
      }]
      : []),
    ...weaponCallouts,
  ];

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
        : 'AR';
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
    const showConsoleUltimate = abyssalVerdictUi != null;
    // Console ultimate module owns reserve/protocol/rot meter + READY CTA —
    // drop duplicate informational chips so the crimson button is the only ultimate UI.
    const consoleCallouts = showConsoleUltimate
      ? statusCallouts.filter((c) => (
        c.id !== 'weapon-ultimate'
        && c.id !== 'aegis-reserve'
        && c.id !== 'protocol'
      ))
      : statusCallouts;
    return (
      <View style={styles.rootConsole} pointerEvents="box-none">
        <Text style={styles.consoleClass} pointerEvents="none">{className}</Text>
        <Text style={styles.consoleSubtitle} pointerEvents="none">VEIL RUNNER</Text>
        <View pointerEvents="none">
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
              markReady={ultimateReady}
              readyUltimateLabel={ultimateLabel}
              labelColor={OTT.warningAmber}
              variant="compact"
              ammoType={hexAmmoType}
              protocolCharges={hexProtocolCharges}
              maxProtocolCharges={hexMaxProtocolCharges}
              nextShotOvercharged={hexNextShotOvercharged}
            />
          ) : null}
          {operativeClass === 'ENVOY' ? (
            <CombatVeilRotGauge
              totalStacks={veilRotStacksTotal}
              variant="compact"
              ultimateReady={ultimateReady}
              readyUltimateLabel={ultimateLabel}
            />
          ) : null}
          <WeaponCombatCalloutStrip callouts={consoleCallouts} />
        </View>
        {showConsoleUltimate ? (
          <AbyssalVerdictUltimateModule
            state={abyssalVerdictUi.state}
            reserve={abyssalVerdictUi.reserve}
            cap={abyssalVerdictUi.cap}
            disabled={!abyssalVerdictUi.canInteract}
            reducedMotion={abyssalVerdictUi.reducedMotion}
            displayName={abyssalVerdictUi.displayName}
            meterHeader={abyssalVerdictUi.meterHeader}
            onPrime={() => onAbyssalVerdictPrime?.()}
            onCancel={() => onAbyssalVerdictCancel?.()}
          />
        ) : null}
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
          markReady={ultimateReady}
          readyUltimateLabel={ultimateLabel}
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
            ultimateReady={ultimateReady}
            readyUltimateLabel={ultimateLabel}
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
            eviscerateReady: ultimateReady,
            ultimateReadyLabel: ultimateReady ? ultimateLabel : null,
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
      <WeaponCombatCalloutStrip callouts={statusCallouts} />
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
    gap: 6,
    paddingHorizontal: 2,
    paddingTop: 0,
    // Keep vitals + ultimate docked to the command-rail baseline.
    justifyContent: 'flex-end',
  },
  consoleClass: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.hero + 1,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: OTT.textPrimary,
  },
  consoleSubtitle: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.label,
    fontWeight: '600',
    letterSpacing: 1,
    color: OTT.textSecondary,
    marginBottom: 4,
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
