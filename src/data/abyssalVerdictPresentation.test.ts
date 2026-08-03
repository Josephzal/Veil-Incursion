/**
 * ABYSSAL VERDICT cinematic presentation — lifecycle / cleanup suite.
 * Run: npx --yes tsx src/data/abyssalVerdictPresentation.test.ts
 */

import assert from 'node:assert/strict';
import {
  __setAbyssalVerdictAssetsAvailableForTests,
} from './abyssalVerdictArt';
import {
  ABYSSAL_VERDICT_TIMELINE_MS,
  abyssalVerdictTargetReceivesCinematicImpact,
  beginAbyssalVerdictPresentation,
  cancelAbyssalVerdictPresentation,
  getAbyssalVerdictActivationToken,
  getAbyssalVerdictCurrentPhase,
  getAbyssalVerdictHudOpacityForPhase,
  getAbyssalVerdictPendingTimerCount,
  getAbyssalVerdictTimeline,
  getAbyssalVerdictWorldCameraForPhase,
  isAbyssalVerdictInputGuarded,
  isAbyssalVerdictPresentationActive,
  isAbyssalVerdictPresentationConsumed,
  resolveAbyssalVerdictPresentationRecipients,
  subscribeAbyssalVerdictDone,
  subscribeAbyssalVerdictImpact,
  subscribeAbyssalVerdictPresentation,
  type AbyssalVerdictPhase,
  type AbyssalVerdictPresentationEvent,
} from './abyssalVerdictPresentation';
import {
  patchCombatPresentationSettings,
  resetCombatPresentationSettings,
} from './weaponCombatPresentation/presentationSettings';

function baseResult(overrides: Record<string, unknown> = {}) {
  return {
    presentationId: `av-${Math.random().toString(36).slice(2, 9)}`,
    targetId: 'scuttler-1',
    affectedTargetIds: ['scuttler-1'],
    evadedTargetIds: [] as string[],
    damage: 40,
    killed: false,
    critical: false,
    grade: 'STANDARD',
    replayOnly: true,
    ...overrides,
  };
}

function installFakeTimers() {
  const realSetTimeout = global.setTimeout;
  const realClearTimeout = global.clearTimeout;
  let now = 0;
  let nextId = 1;
  const queue = new Map<number, { due: number; fn: () => void }>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).setTimeout = (fn: () => void, ms = 0) => {
    const id = nextId++;
    queue.set(id, { due: now + Math.max(0, Number(ms) || 0), fn });
    return id as unknown as ReturnType<typeof setTimeout>;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).clearTimeout = (id: ReturnType<typeof setTimeout>) => {
    queue.delete(id as unknown as number);
  };

  return {
    advance(ms: number) {
      const target = now + ms;
      while (true) {
        let next: { id: number; due: number; fn: () => void } | null = null;
        for (const [id, item] of queue) {
          if (item.due <= target && (!next || item.due < next.due)) {
            next = { id, due: item.due, fn: item.fn };
          }
        }
        if (!next) break;
        now = next.due;
        queue.delete(next.id);
        next.fn();
      }
      now = target;
    },
    pending() {
      return queue.size;
    },
    restore() {
      global.setTimeout = realSetTimeout;
      global.clearTimeout = realClearTimeout;
    },
  };
}

async function main(): Promise<void> {
  console.log('ABYSSAL VERDICT lifecycle suite');
  __setAbyssalVerdictAssetsAvailableForTests(true);
  resetCombatPresentationSettings();
  cancelAbyssalVerdictPresentation();

  // Preserved: only resolved primary receives cinematic impact.
  {
    const result = baseResult({
      targetId: 'scuttler-1',
      affectedTargetIds: ['scuttler-1'],
    });
    assert.equal(abyssalVerdictTargetReceivesCinematicImpact(result, 'scuttler-1'), true);
    assert.equal(abyssalVerdictTargetReceivesCinematicImpact(result, 'thrall-1'), false);
    assert.deepEqual(
      resolveAbyssalVerdictPresentationRecipients(result).cinematicImpactTargetIds,
      ['scuttler-1'],
    );
  }

  // Evade/miss: no cinematic impact burst; primary receives pass-through only.
  {
    const result = baseResult({
      targetId: 'scuttler-1',
      affectedTargetIds: [],
      evadedTargetIds: ['scuttler-1'],
      damage: 0,
      killed: false,
    });
    assert.equal(abyssalVerdictTargetReceivesCinematicImpact(result, 'scuttler-1'), false);
    assert.deepEqual(
      resolveAbyssalVerdictPresentationRecipients(result).evadeTargetIds,
      ['scuttler-1'],
    );
    assert.deepEqual(
      resolveAbyssalVerdictPresentationRecipients(result).cinematicImpactTargetIds,
      [],
    );
  }

  // Timing envelope: deliberate charge, impact ~1560, full sequence ~2.15–2.25 s.
  {
    const tl = ABYSSAL_VERDICT_TIMELINE_MS;
    assert.ok(tl.poseScale >= 1.9 && tl.poseScale <= 2.15, `poseScale ${tl.poseScale}`);
    assert.ok(tl.poseScale / 1.12 >= 1.7 && tl.poseScale / 1.12 <= 2.05);
    assert.ok(tl.worldZoom >= 1.15 && tl.worldZoom <= 1.28);
    assert.ok(tl.worldReleaseZoom < tl.worldZoom);
    assert.equal(tl.hudOpacity, 0);
    assert.equal(tl.nonTargetEnemyOpacity, 0);
    assert.equal(tl.wispCount, 0);
    // Scale-only player camera — translates stay 0 to avoid jitter.
    assert.equal(tl.worldChargeTranslateX, 0);
    assert.equal(tl.worldReleaseTranslateX, 0);
    assert.ok(tl.worldZoomInMs >= 900);
    assert.ok(tl.worldZoomOutMs >= 500);
    assert.ok(tl.doneAt >= 2150 && tl.doneAt <= 2250);
    assert.ok(tl.slashLifetimeMs >= 360);
    assert.ok(tl.slashScale >= 1.7);
    assert.ok(tl.impactBurstFadeMs >= 400);
    assert.ok(tl.contactFxLingerMs >= 160);
    assert.ok(tl.poseSwapMs >= 25 && tl.poseSwapMs <= 40);
    assert.equal(tl.enemyRecoilPx, 0);
  }

  // Complete → idle, no timers, no charge resurrection after +5s.
  {
    const timers = installFakeTimers();
    const phases: AbyssalVerdictPhase[] = [];
    let chargeAfterIdle = 0;
    const unsub = subscribeAbyssalVerdictPresentation((e: AbyssalVerdictPresentationEvent) => {
      phases.push(e.phase);
      if (phases.includes('idle') && e.phase === 'charge') chargeAfterIdle += 1;
    });
    const id = 'av-complete-1';
    assert.equal(beginAbyssalVerdictPresentation(baseResult({ presentationId: id })), true);
    assert.ok(getAbyssalVerdictPendingTimerCount() > 0);
    timers.advance(ABYSSAL_VERDICT_TIMELINE_MS.doneAt + 20);
    assert.equal(getAbyssalVerdictCurrentPhase(), 'idle');
    assert.equal(isAbyssalVerdictPresentationActive(), false);
    assert.equal(getAbyssalVerdictPendingTimerCount(), 0);
    assert.ok(isAbyssalVerdictPresentationConsumed(id));
    assert.ok(phases.includes('idle'));
    assert.ok(!phases.includes('done') || phases[phases.length - 1] === 'idle');
    assert.notEqual(getAbyssalVerdictCurrentPhase(), 'charge');
    timers.advance(5000);
    assert.equal(chargeAfterIdle, 0, 'charge must not reappear after idle');
    assert.equal(getAbyssalVerdictPendingTimerCount(), 0);
    assert.equal(getAbyssalVerdictCurrentPhase(), 'idle');
    // HUD / world restore values for idle.
    const tl = getAbyssalVerdictTimeline(false);
    assert.equal(getAbyssalVerdictHudOpacityForPhase('idle', tl), 1);
    assert.equal(getAbyssalVerdictWorldCameraForPhase('idle', tl, false).scale, 1);
    unsub();
    timers.restore();
    cancelAbyssalVerdictPresentation();
  }

  // Hostile-turn stand-in: after idle, unrelated “turn advance” time does not restart.
  {
    const timers = installFakeTimers();
    const phases: AbyssalVerdictPhase[] = [];
    const unsub = subscribeAbyssalVerdictPresentation((e) => { phases.push(e.phase); });
    const id = 'av-turn-1';
    beginAbyssalVerdictPresentation(baseResult({ presentationId: id }));
    timers.advance(ABYSSAL_VERDICT_TIMELINE_MS.doneAt + 10);
    const phaseCountAtIdle = phases.length;
    // Simulate hostile turn progression with no new begin.
    timers.advance(3000);
    assert.equal(phases.length, phaseCountAtIdle);
    assert.equal(getAbyssalVerdictCurrentPhase(), 'idle');
    assert.equal(beginAbyssalVerdictPresentation(baseResult({ presentationId: id })), false,
      'consumed presentation id cannot restart');
    unsub();
    timers.restore();
    cancelAbyssalVerdictPresentation();
  }

  // Cancel during charge / release / impact / recovery → idle + no timers.
  {
    const points = [
      ABYSSAL_VERDICT_TIMELINE_MS.chargeStart + 10,
      ABYSSAL_VERDICT_TIMELINE_MS.releaseStart + 10,
      ABYSSAL_VERDICT_TIMELINE_MS.impactAt + 10,
      ABYSSAL_VERDICT_TIMELINE_MS.recoveryStart + 10,
    ];
    for (const at of points) {
      const timers = installFakeTimers();
      let impacts = 0;
      const unsubImpact = subscribeAbyssalVerdictImpact(() => { impacts += 1; });
      beginAbyssalVerdictPresentation(baseResult({ presentationId: `av-cancel-${at}` }));
      timers.advance(at);
      cancelAbyssalVerdictPresentation();
      assert.equal(getAbyssalVerdictCurrentPhase(), 'idle');
      assert.equal(getAbyssalVerdictPendingTimerCount(), 0);
      assert.equal(isAbyssalVerdictPresentationActive(), false);
      assert.equal(isAbyssalVerdictInputGuarded(), false);
      // Cancel before impact still reveals once; after impact stays single.
      assert.ok(impacts <= 1);
      timers.advance(5000);
      assert.equal(getAbyssalVerdictCurrentPhase(), 'idle');
      assert.equal(getAbyssalVerdictPendingTimerCount(), 0);
      unsubImpact();
      timers.restore();
    }
  }

  // Unmount-equivalent: cancel mid-phase then advance — no further phase mutations.
  {
    const timers = installFakeTimers();
    const phases: AbyssalVerdictPhase[] = [];
    const unsub = subscribeAbyssalVerdictPresentation((e) => { phases.push(e.phase); });
    beginAbyssalVerdictPresentation(baseResult({ presentationId: 'av-unmount' }));
    timers.advance(ABYSSAL_VERDICT_TIMELINE_MS.bladeChargeStart + 5);
    const tokenBefore = getAbyssalVerdictActivationToken();
    cancelAbyssalVerdictPresentation();
    const tokenAfter = getAbyssalVerdictActivationToken();
    assert.ok(tokenAfter > tokenBefore, 'activation token invalidated on cancel');
    const count = phases.length;
    timers.advance(ABYSSAL_VERDICT_TIMELINE_MS.doneAt + 2000);
    assert.equal(phases.length, count, 'no post-unmount/cancel timeline events');
    assert.equal(getAbyssalVerdictPendingTimerCount(), 0);
    unsub();
    timers.restore();
    cancelAbyssalVerdictPresentation();
  }

  // Strict Mode stand-in: begin once → single timer registry (no duplicate schedule).
  {
    const timers = installFakeTimers();
    assert.equal(beginAbyssalVerdictPresentation(baseResult({ presentationId: 'av-strict-a' })), true);
    const pending = getAbyssalVerdictPendingTimerCount();
    // activation is sync; stamps: charge→done inclusive = 10.
    assert.equal(pending, 10, `expected 10 timeline stamps, got ${pending}`);
    assert.equal(beginAbyssalVerdictPresentation(baseResult({ presentationId: 'av-strict-b' })), false);
    assert.equal(getAbyssalVerdictPendingTimerCount(), pending, 'second begin must not double schedule');
    cancelAbyssalVerdictPresentation();
    assert.equal(getAbyssalVerdictPendingTimerCount(), 0);
    timers.restore();
  }

  // Second legitimate activation after first completes.
  {
    const timers = installFakeTimers();
    let dones = 0;
    const unsubDone = subscribeAbyssalVerdictDone(() => { dones += 1; });
    assert.equal(beginAbyssalVerdictPresentation(baseResult({ presentationId: 'av-first' })), true);
    timers.advance(ABYSSAL_VERDICT_TIMELINE_MS.doneAt + 10);
    assert.equal(dones, 1);
    assert.equal(getAbyssalVerdictCurrentPhase(), 'idle');
    assert.equal(beginAbyssalVerdictPresentation(baseResult({ presentationId: 'av-second' })), true);
    assert.equal(isAbyssalVerdictPresentationActive(), true);
    assert.ok(getAbyssalVerdictPendingTimerCount() > 0);
    timers.advance(ABYSSAL_VERDICT_TIMELINE_MS.impactAt + 5);
    timers.advance(ABYSSAL_VERDICT_TIMELINE_MS.doneAt);
    assert.equal(dones, 2);
    assert.equal(getAbyssalVerdictCurrentPhase(), 'idle');
    unsubDone();
    timers.restore();
    cancelAbyssalVerdictPresentation();
  }

  // Impact still fires once before idle; damage wait preserved.
  {
    const timers = installFakeTimers();
    let impacts = 0;
    const unsubImpact = subscribeAbyssalVerdictImpact((result) => {
      impacts += 1;
      assert.equal(result.targetId, 'scuttler-1');
    });
    beginAbyssalVerdictPresentation(baseResult({ presentationId: 'av-impact' }));
    timers.advance(ABYSSAL_VERDICT_TIMELINE_MS.delayedCutStart + 5);
    assert.equal(impacts, 0);
    timers.advance(
      ABYSSAL_VERDICT_TIMELINE_MS.impactAt - ABYSSAL_VERDICT_TIMELINE_MS.delayedCutStart,
    );
    assert.equal(impacts, 1);
    timers.advance(ABYSSAL_VERDICT_TIMELINE_MS.doneAt);
    assert.equal(impacts, 1);
    assert.equal(getAbyssalVerdictCurrentPhase(), 'idle');
    unsubImpact();
    timers.restore();
    cancelAbyssalVerdictPresentation();
  }

  __setAbyssalVerdictAssetsAvailableForTests(null);
  resetCombatPresentationSettings();
  console.log('ABYSSAL VERDICT lifecycle suite — ok');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
