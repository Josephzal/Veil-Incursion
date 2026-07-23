import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../../HapticPressable';
import InstabilityProtocol from './InstabilityProtocol';
import GridCipher from './GridCipher';
import CipherRite from './CipherRite';
import LeyCircuitBreach from './LeyCircuitBreach';
import ScannerSweep from './ScannerSweep';
import ShadowlineAscent from './ShadowlineAscent';
import RiteOfConcordance from './RiteOfConcordance';
import SignalAlignment from './SignalAlignment';
import SigilTumbler from './SigilTumbler';
import TensionMechanicModal from './TensionMechanicModal';
import {
  formatTensionMechanicLabel,
  type TensionMechanicHostProps,
} from './tensionMechanicTypes';
import { isKnownTensionMechanic } from '../../../data/narrative/tensionMechanicRouting';
import {
  logNarrativeMinigameStarted,
  logNarrativeMinigameUnknownId,
} from '../../../data/narrative/narrativeMinigameTelemetry';
import { VEIL } from '../../../theme/veilTerminalTokens';

const TERMINAL_ACCENT: string = VEIL.mint;
const WARN_ACCENT: string = VEIL.occultPale;
const FAIL_ACCENT: string = VEIL.blood;
const TENSION_MUTED = VEIL.textDim;
const TENSION_PANEL = VEIL.surface3;

const isDevBuild = typeof __DEV__ !== 'undefined' && __DEV__;

/**
 * Empty / missing mechanic — narrative intentionally has no tension protocol.
 * Callers should usually skip TENSION phase; this is a safe last resort.
 */
function NoTensionMechanicPanel({
  onContinue,
  borderColor = VEIL.line,
  mutedColor = VEIL.textMuted,
  primaryColor = '#f8fafc',
}: {
  onContinue: () => void;
  borderColor?: string;
  mutedColor?: string;
  primaryColor?: string;
}): React.JSX.Element {
  return (
    <View style={styles.fallbackCol}>
      <Text style={[styles.fallbackHeader, { color: mutedColor }]}>
        TENSION PROTOCOL // NONE
      </Text>
      <View style={[styles.fallbackPanel, { borderColor }]}>
        <Text style={[styles.fallbackTitle, { color: primaryColor }]}>
          NO TENSION MECHANIC
        </Text>
        <Text style={[styles.fallbackBody, { color: TENSION_MUTED }]}>
          This encounter has no assigned tension minigame. Continue to resolve the choice.
        </Text>
      </View>
      <HapticPressable
        onPress={onContinue}
        style={({ pressed }) => [
          styles.fallbackCompleteBtn,
          { borderColor: TERMINAL_ACCENT, opacity: pressed ? 0.75 : 1 },
        ]}
      >
        <Text style={[styles.fallbackCompleteBtnText, { color: TERMINAL_ACCENT }]}>
          [ CONTINUE — NO PROTOCOL ]
        </Text>
      </HapticPressable>
    </View>
  );
}

/**
 * Unknown non-empty mechanic ID — never silently auto-succeed.
 * Dev: loud warning + fail primary CTA (+ optional force-success).
 * Prod: safe failure path.
 */
function UnknownTensionMechanicPanel({
  mechanicId,
  penaltyPreview,
  onFailure,
  onForceSuccess,
  borderColor = '#7f1d1d',
  mutedColor = VEIL.textMuted,
  primaryColor = '#f8fafc',
}: {
  mechanicId: string;
  penaltyPreview?: string;
  onFailure: () => void;
  onForceSuccess?: () => void;
  borderColor?: string;
  mutedColor?: string;
  primaryColor?: string;
}): React.JSX.Element {
  return (
    <View style={styles.fallbackCol}>
      <Text style={[styles.fallbackHeader, { color: WARN_ACCENT }]}>
        TENSION PROTOCOL // UNWIRED
      </Text>
      <View style={[styles.fallbackPanel, { borderColor, borderWidth: 2 }]}>
        <Text style={[styles.fallbackTitle, { color: WARN_ACCENT }]}>
          UNKNOWN TENSION MECHANIC
        </Text>
        <Text style={[styles.mechanicIdLine, { color: primaryColor }]}>
          {`Mechanic ID: ${mechanicId}`}
        </Text>
        <Text style={[styles.fallbackBody, { color: TENSION_MUTED }]}>
          This mechanic is not wired into TensionMechanicHost. Silent auto-success is disabled.
          {isDevBuild
            ? ' Fix the catalog entry or wire a new case before shipping.'
            : ' Protocol aborted to avoid granting an unearned success.'}
        </Text>
        {penaltyPreview ? (
          <Text style={[styles.fallbackPenalty, { color: '#9ca3af' }]}>
            {penaltyPreview}
          </Text>
        ) : null}
      </View>
      <HapticPressable
        onPress={onFailure}
        style={({ pressed }) => [
          styles.fallbackCompleteBtn,
          { borderColor: FAIL_ACCENT, opacity: pressed ? 0.75 : 1 },
        ]}
      >
        <Text style={[styles.fallbackCompleteBtnText, { color: FAIL_ACCENT }]}>
          [ ABORT PROTOCOL — FAILURE ]
        </Text>
      </HapticPressable>
      {isDevBuild && onForceSuccess ? (
        <HapticPressable
          onPress={onForceSuccess}
          style={({ pressed }) => [
            styles.fallbackCompleteBtn,
            { borderColor: mutedColor, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Text style={[styles.fallbackCompleteBtnText, { color: mutedColor }]}>
            [ DEV ONLY — FORCE SUCCESS ]
          </Text>
        </HapticPressable>
      ) : null}
    </View>
  );
}

export default function TensionMechanicHost({
  tensionMechanic,
  onSuccess,
  onFailure,
  defaultPenalty,
  difficulty,
  narrativeEventId,
  fallbackLabel,
  penaltyPreview,
  borderColor,
  mutedColor,
  primaryColor,
}: TensionMechanicHostProps): React.JSX.Element {
  const mechanicProps = { onSuccess, onFailure, defaultPenalty, difficulty, narrativeEventId };
  const rawId = tensionMechanic == null ? '' : String(tensionMechanic).trim();

  useEffect(() => {
    if (!rawId) {
      console.warn(
        '[TensionMechanicHost] Empty tension mechanic — narrative should skip TENSION phase when none is assigned.',
      );
      return;
    }
    if (!isKnownTensionMechanic(rawId)) {
      logNarrativeMinigameUnknownId(rawId, narrativeEventId);
      console.error(
        `[TensionMechanicHost] Unknown tension mechanic ID "${rawId}". `
        + 'Silent auto-success is disabled. Wire the mechanic or fix the catalog.',
        { tensionMechanic: rawId, fallbackLabel, narrativeEventId },
      );
    } else {
      logNarrativeMinigameStarted({
        mechanicId: rawId,
        difficulty,
        narrativeEventId,
      });
    }
  }, [rawId, fallbackLabel, difficulty, narrativeEventId]);

  // Each mechanic pops in a centered modal over a darkened stage — mirroring the
  // in-combat cargo/inventory overlay pattern.
  const modalLabel = formatTensionMechanicLabel(rawId || undefined).toUpperCase();

  let content: React.JSX.Element;
  let accentColor = TERMINAL_ACCENT;

  if (!rawId) {
    accentColor = mutedColor ?? VEIL.textMuted;
    content = (
      <NoTensionMechanicPanel
        onContinue={onSuccess}
        borderColor={borderColor}
        mutedColor={mutedColor}
        primaryColor={primaryColor}
      />
    );
  } else {
    switch (rawId as typeof tensionMechanic) {
      case 'Mechanic_SigilTrace':
        // Deprecated in-game Ritual Echo — retained for DevTest force + legacy nodes.
        content = <GridCipher {...mechanicProps} />;
        break;
      case 'Mechanic_RiteOfConcordance':
        // Player-facing: Rite of Concordance (three-thread ritual waveform cleanse) — the in-game ritual.
        content = <RiteOfConcordance {...mechanicProps} />;
        break;
      case 'Mechanic_ScavengeBar':
        // Deprecated for new generation — still supported for legacy + DevTest force.
        content = <InstabilityProtocol {...mechanicProps} />;
        break;
      case 'Mechanic_ConcealSlider':
        // Deprecated in-game Scanner Sweep — retained for DevTest force + legacy nodes.
        content = <ScannerSweep {...mechanicProps} />;
        break;
      case 'Mechanic_ShadowlineAscent':
        // Player-facing: Shadowline Ascent (turn-based 3-lane stealth shaft) — the in-game stealth.
        content = <ShadowlineAscent {...mechanicProps} />;
        break;
      case 'Mechanic_CipherRite':
        // Deprecated in-game hacking — retained for DevTest force + legacy nodes.
        content = <CipherRite {...mechanicProps} />;
        break;
      case 'Mechanic_LeyCircuitBreach':
        // Player-facing: Ley Circuit Breach (6×6 polarity routing) — the in-game hack.
        content = <LeyCircuitBreach {...mechanicProps} />;
        break;
      case 'Mechanic_SignalAlignment':
        // Deprecated in-game Veil Lock — retained for DevTest force + legacy nodes.
        content = <SignalAlignment {...mechanicProps} />;
        break;
      case 'Mechanic_SigilTumbler':
        // Player-facing: Sigil Tumbler (resonance-angle + rhythm lockpick) — the in-game lock.
        content = <SigilTumbler {...mechanicProps} />;
        break;
      default:
        accentColor = FAIL_ACCENT;
        content = (
          <UnknownTensionMechanicPanel
            mechanicId={fallbackLabel ? `${rawId} (${fallbackLabel})` : rawId}
            penaltyPreview={penaltyPreview}
            onFailure={onFailure}
            onForceSuccess={isDevBuild ? onSuccess : undefined}
            borderColor={borderColor ?? '#7f1d1d'}
            mutedColor={mutedColor}
            primaryColor={primaryColor}
          />
        );
        break;
    }
  }

  return (
    <TensionMechanicModal accentColor={accentColor} label={modalLabel}>
      <View style={styles.mechanicHost}>{content}</View>
    </TensionMechanicModal>
  );
}

const styles = StyleSheet.create({
  mechanicHost: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  fallbackCol: {
    gap: 8,
  },
  fallbackHeader: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 1,
  },
  fallbackPanel: {
    borderWidth: 1,
    backgroundColor: TENSION_PANEL,
    padding: 14,
    gap: 10,
  },
  fallbackTitle: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  mechanicIdLine: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  fallbackBody: {
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 15,
  },
  fallbackPenalty: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  fallbackCompleteBtn: {
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  fallbackCompleteBtnText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});
