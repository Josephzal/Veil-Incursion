/**
 * Target-local Warden contact host.
 * Registers the approach contact anchor at portrait center and owns
 * burst / incision / Fracture VFX on successful contact.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import {
  clearWardenEnemyContactAnchor,
  registerWardenEnemyContactAnchor,
} from '../../data/wardenStrikeApproach';
import {
  AEGIS_LONGSWORD_POSE_REGISTRATION,
} from '../../utils/combatPoseRegistration';
import {
  subscribeWardenStrikePresentation,
  wardenContactVfxTailMs,
  WARDEN_STRIKE_VFX_LAYER_TOGGLES,
  type WardenStrikeResolvedResult,
} from '../../data/wardenStrikePresentation';
import WardenStrikeContactFx from './WardenStrikeContactFx';

interface WardenStrikeEnemyContactHostProps {
  unitId: string;
}

export default function WardenStrikeEnemyContactHost({
  unitId,
}: WardenStrikeEnemyContactHostProps): React.JSX.Element {
  const hostRef = useRef<View>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [contactResult, setContactResult] = useState<WardenStrikeResolvedResult | null>(null);
  const [reducedFlash, setReducedFlash] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const publishAnchor = useCallback(() => {
    const node = hostRef.current as (View & {
      measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
    }) | null;
    node?.measureInWindow?.((x, y, w, h) => {
      registerWardenEnemyContactAnchor(unitId, {
        x: x + w / 2,
        y: y + h / 2,
      });
    });
  }, [unitId]);

  useEffect(() => {
    publishAnchor();
    const handle = setInterval(publishAnchor, 480);
    return () => {
      clearInterval(handle);
      clearWardenEnemyContactAnchor(unitId);
    };
  }, [publishAnchor, unitId]);

  useEffect(() => subscribeWardenStrikePresentation((event) => {
    if (event.result.targetId === unitId
      && (event.phase === 'anticipation' || event.phase === 'release' || event.phase === 'contact')) {
      publishAnchor();
    }

    if (event.phase === 'anticipation' && event.result.targetId === unitId) {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
      setContactResult(null);
      return;
    }

    if (event.phase !== 'contact') return;
    if (event.result.targetId !== unitId) return;
    if (WARDEN_STRIKE_VFX_LAYER_TOGGLES.smearIsolationMode) return;
    if (!WARDEN_STRIKE_VFX_LAYER_TOGGLES.contactFx) return;
    if (event.result.outcome === 'MISS' || event.result.outcome === 'EVADE') return;

    setReducedFlash(event.reducedFlash);
    setReducedMotion(event.reducedMotion);
    setContactResult(event.result);

    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => {
      setContactResult(null);
      clearTimerRef.current = null;
    }, wardenContactVfxTailMs());
  }), [publishAnchor, unitId]);

  useEffect(() => () => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
  }, []);

  const onLayout = useCallback((_e: LayoutChangeEvent) => {
    publishAnchor();
  }, [publishAnchor]);

  const showContact = contactResult != null
    && !WARDEN_STRIKE_VFX_LAYER_TOGGLES.smearIsolationMode;

  return (
    <View
      ref={hostRef}
      collapsable={false}
      onLayout={onLayout}
      style={styles.host}
      pointerEvents="none"
    >
      {showContact ? (
        <WardenStrikeContactFx
          active
          outcome={contactResult.outcome}
          defenseMaterial={contactResult.defenseMaterial}
          fractureApplied={contactResult.fractureApplied}
          facingX={AEGIS_LONGSWORD_POSE_REGISTRATION.attack.targetFacing.x}
          facingY={AEGIS_LONGSWORD_POSE_REGISTRATION.attack.targetFacing.y}
          reducedMotion={reducedMotion}
          reducedFlash={reducedFlash}
          enableBurst
          enableIncision
          enableFracture
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /** Portrait center — impact burst + incision origin. */
  host: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 1,
    height: 1,
    zIndex: 16,
    overflow: 'visible',
  },
});
