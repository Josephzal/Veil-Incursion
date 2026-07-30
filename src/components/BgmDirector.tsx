/**
 * Drives hub / in-run / combat BGM from GameFlow + Veil transit state.
 */

import { useEffect } from 'react';
import type { AppScreen } from '../types/gameFlow';
import type { VeilTransitKind } from './transitions/veilTransitTimeline';
import { useGameFlow } from '../context/GameFlowContext';
import { useTransitionStore } from '../stores/transitionStore';
import {
  ensureHubBgmPlaying,
  setBgmDesired,
  unlockBgm,
  type BgmDesired,
} from '../utils/bgmController';

const RUN_MUSIC_SCREENS: ReadonlySet<AppScreen> = new Set([
  'BOUND_REQUISITION',
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

  // Initiate-breach portal — crossfade hub → run immediately.
  if (transitionState === 'BREACHING' && transitKind === 'incursionIngress') {
    return 'run';
  }

  // Extract portal: keep run silent, but start hub as soon as Veil Front mounts under the iris.
  if (transitionState === 'EXTRACTING') {
    if (currentScreen === 'HUB') return 'hub';
    return 'none';
  }

  // Combat entry FX + arena — intro then loop bed.
  if (combatEntryActive || currentScreen === 'COMBAT') {
    return 'combat';
  }

  if (currentScreen === 'HUB') {
    return 'hub';
  }

  if (RUN_MUSIC_SCREENS.has(currentScreen)) {
    return 'run';
  }

  // Welcome / debrief / run-complete: hold silence.
  return 'none';
}

export default function BgmDirector(): null {
  const { currentScreen, combatEntryActive } = useGameFlow();
  const transitionState = useTransitionStore((s) => s.transitionState);
  const transitKind = useTransitionStore((s) => s.transitKind);

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
