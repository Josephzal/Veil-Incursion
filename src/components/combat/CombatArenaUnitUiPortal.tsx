/**
 * Publishes enemy response callouts into the arena combat-UI plane during Warden
 * so text composites above the moving player without ReactNode state loops.
 *
 * Only the immutable result target may portal — other enemies must never reuse
 * this target's host coordinates or remount stale CRITICAL labels.
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import type { StatusFloatTone } from '../../utils/combatTelemetryFormat';
import { useCombatArenaCombatUiOptional } from '../../context/CombatArenaCombatUiContext';
import {
  getWardenStrikeActiveTargetId,
  subscribeWardenStrikePresentation,
  type WardenStrikePresentationPhase,
} from '../../data/wardenStrikePresentation';
import {
  mayPublishCriticalCallout,
  reportWardenCallout,
} from '../../data/wardenCalloutOwnership';

interface CombatArenaUnitUiPortalProps {
  unitId: string;
  damageSeq?: number;
  damageLabel?: string;
  statusSeq?: number;
  statusLabel?: string;
  statusTone?: StatusFloatTone;
  critImpactSeq?: number;
  critImpactChannel?: 'KINETIC' | 'OCCULT' | 'TRUE';
  evadeImpactSeq?: number;
  children: React.ReactNode;
}

type PortalGate = {
  active: boolean;
  critical: boolean;
  damage: number;
  phase: WardenStrikePresentationPhase;
  presentationId: string | null;
  playerActionId: string | null;
  resolvedResultId: string | null;
  sourceActionKind: string | null;
  sourceAbilityId: string | null;
};

export default function CombatArenaUnitUiPortal({
  unitId,
  damageSeq = 0,
  damageLabel = '',
  statusSeq = 0,
  statusLabel = '',
  statusTone = 'neutral',
  critImpactSeq = 0,
  critImpactChannel,
  evadeImpactSeq = 0,
  children,
}: CombatArenaUnitUiPortalProps): React.JSX.Element {
  const ui = useCombatArenaCombatUiOptional();
  const setEntryRef = useRef(ui?.setEntry);
  setEntryRef.current = ui?.setEntry;
  const anchorRef = useRef<View>(null);
  const [gate, setGate] = useState<PortalGate>({
    active: false,
    critical: false,
    damage: 0,
    phase: 'idle',
    presentationId: null,
    playerActionId: null,
    resolvedResultId: null,
    sourceActionKind: null,
    sourceAbilityId: null,
  });
  const lastWin = useRef<{ x: number; y: number; width: number } | null>(null);
  const reportedKeys = useRef<Set<string>>(new Set());
  const gateRef = useRef(gate);
  gateRef.current = gate;

  useEffect(() => subscribeWardenStrikePresentation((event) => {
    const isOwnerTarget = event.result.targetId === unitId
      || getWardenStrikeActiveTargetId() === unitId;
    const nextActive = event.phase !== 'done'
      && event.phase !== 'idle'
      && !event.result.replayOnly
      && isOwnerTarget;
    setGate((prev) => {
      const next: PortalGate = {
        active: nextActive,
        critical: event.result.critical === true && event.result.damage > 0,
        damage: event.result.damage,
        phase: event.phase,
        presentationId: event.presentationId,
        playerActionId: event.result.playerActionId ?? null,
        resolvedResultId: event.result.resolvedResultId ?? null,
        sourceActionKind: event.result.sourceActionKind ?? null,
        sourceAbilityId: event.result.sourceAbilityId ?? null,
      };
      if (
        prev.active === next.active
        && prev.critical === next.critical
        && prev.damage === next.damage
        && prev.phase === next.phase
        && prev.presentationId === next.presentationId
      ) {
        return prev;
      }
      return next;
    });
    if (event.phase === 'done' || event.phase === 'idle') {
      reportedKeys.current.clear();
    }
  }), [unitId]);

  const contactOrLater = gate.phase === 'feedback'
    || gate.phase === 'contact'
    || gate.phase === 'hold'
    || gate.phase === 'recovery';
  const criticalAuthorized = mayPublishCriticalCallout({
    resultTargetId: unitId,
    resultCritical: gate.critical && contactOrLater,
    calloutTargetId: unitId,
    resultDamage: gate.damage,
  });
  const publishedCritSeq = criticalAuthorized ? critImpactSeq : 0;

  const propsRef = useRef({
    damageSeq,
    damageLabel,
    statusSeq,
    statusLabel,
    statusTone,
    publishedCritSeq,
    critImpactChannel,
    evadeImpactSeq,
    criticalAuthorized,
  });
  propsRef.current = {
    damageSeq,
    damageLabel,
    statusSeq,
    statusLabel,
    statusTone,
    publishedCritSeq,
    critImpactChannel,
    evadeImpactSeq,
    criticalAuthorized,
  };

  const writeEntry = (x: number, y: number, width: number) => {
    const g = gateRef.current;
    if (!g.active) return;
    const p = propsRef.current;
    lastWin.current = { x, y, width };
    setEntryRef.current?.(`unit-ui-${unitId}`, {
      unitId,
      left: x,
      top: y,
      width: Math.max(width, 72),
      damageSeq: p.damageSeq,
      damageLabel: p.damageLabel ?? '',
      statusSeq: p.statusSeq,
      statusLabel: p.statusLabel ?? '',
      statusTone: p.statusTone ?? 'neutral',
      critImpactSeq: p.publishedCritSeq,
      critImpactChannel: p.criticalAuthorized ? p.critImpactChannel : undefined,
      evadeImpactSeq: p.evadeImpactSeq,
      criticalAuthorized: p.criticalAuthorized,
      presentationId: g.presentationId,
      playerActionId: g.playerActionId,
      resolvedResultId: g.resolvedResultId,
      sourceActionKind: g.sourceActionKind,
      sourceAbilityId: g.sourceAbilityId,
    });

    const anchor = { x, y };
    const base = {
      presentationInstanceId: g.presentationId,
      playerActionId: g.playerActionId,
      resolvedResultId: g.resolvedResultId,
      sourceActionKind: g.sourceActionKind,
      sourceAbilityId: g.sourceAbilityId,
      targetId: unitId,
      critical: p.criticalAuthorized,
      portalHost: `arena-unit-ui-${unitId}`,
      targetAnchor: anchor,
    };
    if (p.damageSeq > 0 && p.damageLabel) {
      const key = `DAMAGE:${p.damageSeq}`;
      if (!reportedKeys.current.has(key)) {
        reportedKeys.current.add(key);
        reportWardenCallout({ ...base, calloutType: 'DAMAGE' });
      }
    }
    if (p.statusSeq > 0 && p.statusLabel) {
      const key = `DEFENSE:${p.statusSeq}`;
      if (!reportedKeys.current.has(key)) {
        reportedKeys.current.add(key);
        reportWardenCallout({ ...base, calloutType: 'DEFENSE', critical: false });
      }
    }
    if (p.publishedCritSeq > 0 && p.criticalAuthorized) {
      const key = `CRITICAL:${p.publishedCritSeq}`;
      if (!reportedKeys.current.has(key)) {
        reportedKeys.current.add(key);
        reportWardenCallout({ ...base, calloutType: 'CRITICAL', critical: true });
      }
    }
  };

  const publish = () => {
    if (!gateRef.current.active) return;
    // Use cached window coords immediately so contact-beat floats aren't gated on measure.
    if (lastWin.current) {
      writeEntry(lastWin.current.x, lastWin.current.y, lastWin.current.width);
    }
    const node = anchorRef.current as (View & {
      measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
    }) | null;
    node?.measureInWindow?.((x, y, width) => {
      writeEntry(x, y, width);
    });
  };

  // Keep entry in sync while active. Do NOT put context `ui` in deps — setEntry updates
  // entries and would retrigger cleanup(null) → publish → infinite setState loop.
  useLayoutEffect(() => {
    if (!gate.active) {
      setEntryRef.current?.(`unit-ui-${unitId}`, null);
      return undefined;
    }
    publish();
    const handle = setInterval(publish, 80);
    return () => {
      clearInterval(handle);
    };
  // Primitive deps only — never depend on `children` or context value identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    unitId,
    gate.active,
    gate.critical,
    gate.damage,
    gate.phase,
    gate.presentationId,
    damageSeq,
    damageLabel,
    statusSeq,
    statusLabel,
    statusTone,
    publishedCritSeq,
    critImpactChannel,
    evadeImpactSeq,
    criticalAuthorized,
  ]);

  // Clear portal entry on unmount or when leaving the owning target.
  useEffect(() => () => {
    setEntryRef.current?.(`unit-ui-${unitId}`, null);
  }, [unitId]);

  const warmAnchor = () => {
    const node = anchorRef.current as (View & {
      measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
    }) | null;
    node?.measureInWindow?.((x, y, width) => {
      lastWin.current = { x, y, width };
      if (gateRef.current.active) writeEntry(x, y, width);
    });
  };

  return (
    <View
      ref={anchorRef}
      style={styles.anchor}
      pointerEvents="none"
      collapsable={false}
      onLayout={() => {
        warmAnchor();
      }}
    >
      {gate.active ? <View style={styles.spacer} /> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '42%',
    alignItems: 'center',
    zIndex: 30,
  },
  spacer: {
    width: 1,
    height: 1,
  },
});
