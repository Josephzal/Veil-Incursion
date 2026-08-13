/**
 * Drives hub / in-run adaptive BGM from GameFlow + Veil transit state.
 *
 * Authoritative hooks:
 * - Incursion active: BREACHING ingress, SCANNING…SAFEHOUSE, COMBAT
 * - Combat: combatEntryActive || currentScreen === 'COMBAT' → drum mix
 * - Out of combat (still in run): RUN_MUSIC_SCREENS → explore mix
 * - Incursion end: EXTRACTING / HUB / debrief → stop beds; hub resumes on HUB
 */

import { useEffect } from 'react';
import type { AppScreen } from '../types/gameFlow';
import type { VeilTransitKind } from './transitions/veilTransitTimeline';
import { useGameFlow } from '../context/GameFlowContext';
import { useTransitionStore } from '../stores/transitionStore';
import {
  ensureHubBgmPlaying,
  preloadIncursionBeds,
  setBgmDesired,
  unlockBgm,
  type BgmDesired,
} from '../utils/bgmController';

const RUN_MUSIC_SCREENS: ReadonlySet<AppScreen> = new Set([
  'SCANNING',
  'NARRATIVE',
  'POST_COMBAT_BOON',
  'SKILL_CHECK',
  'REST',
  'BLACK_MARKET',
  'RESOURCE_HARVEST',
  'EXTRACTION_REVIEW',
  'SAFEHOUSE',
]);

function resolveBgmDesired(input: {
  currentScreen: AppScreen;
  combatEntryActive: boolean;
  transitionState: 'IDLE' | 'BREACHING' | 'EXTRACTING';
  transitKind: VeilTransitKind | null;
}): BgmDesired {
  const { currentScreen, combatEntryActive, transitionState, transitKind } = input;

  // Initiate-breach portal — start synchronized beds (explore audible).
  if (transitionState === 'BREACHING' && transitKind === 'incursionIngress') {
    return 'run';
  }

  // Extract / abandon — stop incursion beds; hub once Veil Front mounts.
  if (transitionState === 'EXTRACTING') {
    if (currentScreen === 'HUB') return 'hub';
    return 'none';
  }

  // Combat entry FX + arena — crossfade to drum mix (beds keep position).
  if (combatEntryActive || currentScreen === 'COMBAT') {
    return 'combat';
  }

  if (currentScreen === 'HUB') {
    return 'hub';
  }

  if (RUN_MUSIC_SCREENS.has(currentScreen)) {
    return 'run';
  }

  // Welcome / debrief / run-complete: stop beds.
  return 'none';
}

export default function BgmDirector(): null {
  const { currentScreen, combatEntryActive } = useGameFlow();
  const transitionState = useTransitionStore((s) => s.transitionState);
  const transitKind = useTransitionStore((s) => s.transitKind);

  useEffect(() => {
    unlockBgm();
    void preloadIncursionBeds();
  }, []);

  useEffect(() => {
    unlockBgm();
    const next = resolveBgmDesired({
      currentScreen,
      combatEntryActive,
      transitionState,
      transitKind,
    });
    if (next === 'hub') {
      ensureHubBgmPlaying();
      return;
    }
    setBgmDesired(next);
  }, [combatEntryActive, currentScreen, transitionState, transitKind]);

  return null;
}
