/**
 * Thrall Undying lifecycle unit checks.
 * Run: npx --yes tsx src/data/thrallLifecycleEngine.test.ts
 */
import assert from 'node:assert/strict';
import {
  attackBypassesThrallSlump,
  resolveThrallLethalBlow,
  thrallDeathLogLine,
  thrallReanimateLogLine,
  thrallRevivePatch,
  thrallSlumpEnterPatch,
  THRALL_DEFAULT_REVIVE_HP_PERCENT,
} from './thrallLifecycleEngine';
import { tickThrallSlumpsAtPlayerTurnEnd } from './combatLifecycleEngine';
import { allUnitsDefeated, canUnitAct, isUnitAlive } from './combatSquadEngine';
import type { EnemyCombatProfile } from '../types/run';

function thrall(partial: Partial<EnemyCombatProfile> = {}): EnemyCombatProfile {
  return {
    designation: 'THRALL',
    rosterId: 'thrall',
    unitId: 'thrall-1',
    currentHp: 40,
    maxHp: 100,
    baseDamage: 8,
    intent: 'STRIKE',
    chargeTurns: 0,
    ...partial,
  } as EnemyCombatProfile;
}

function run(): void {
  assert.equal(attackBypassesThrallSlump(['EXECUTE']), true);
  assert.equal(attackBypassesThrallSlump(['HEAVY']), true);
  assert.equal(attackBypassesThrallSlump(['FINISHER']), true);
  assert.equal(attackBypassesThrallSlump(['EXECUTION']), true);
  assert.equal(attackBypassesThrallSlump(['KINETIC', 'MELEE']), false);
  assert.equal(attackBypassesThrallSlump([]), false);

  // Normal lethal → Slump
  {
    const outcome = resolveThrallLethalBlow(
      thrall(),
      { damage: 12, tags: ['KINETIC'], isDirectDamage: true },
      { fleshWarped: false },
    );
    assert.equal(outcome.kind, 'ENTER_SLUMP');
    assert.match(thrallDeathLogLine('THRALL', outcome), /SLUMPS/);
  }

  // Heavy/Execute lethal on ACTIVE → true death bypass
  {
    const outcome = resolveThrallLethalBlow(
      thrall(),
      { damage: 5, tags: ['EXECUTE'], isDirectDamage: true },
      { fleshWarped: false },
    );
    assert.deepEqual(outcome, { kind: 'TRUE_DEATH', reason: 'HEAVY_BYPASS' });
    assert.match(thrallDeathLogLine('THRALL', outcome), /DESTROYED/);
  }

  // Slumped + any direct damage → execute (no damage threshold)
  {
    const outcome = resolveThrallLethalBlow(
      thrall({ isSlumped: true, currentHp: 0 }),
      { damage: 1, tags: ['KINETIC'], isDirectDamage: true },
      { fleshWarped: false },
    );
    assert.deepEqual(outcome, { kind: 'TRUE_DEATH', reason: 'EXECUTE' });
    assert.match(thrallDeathLogLine('THRALL', outcome), /EXECUTED/);
  }

  // Slumped + indirect damage does not execute
  {
    const outcome = resolveThrallLethalBlow(
      thrall({ isSlumped: true, currentHp: 0 }),
      { damage: 50, tags: [], isDirectDamage: false },
      { fleshWarped: false },
    );
    assert.equal(outcome.kind, 'ENTER_SLUMP');
  }

  // Alive / act / victory semantics
  {
    const slumped = thrall({
      ...thrallSlumpEnterPatch(),
      currentHp: 0,
    });
    assert.equal(isUnitAlive(slumped), true);
    assert.equal(canUnitAct(slumped), false);
    assert.equal(allUnitsDefeated([slumped]), false);
  }

  // Revive at 40% + skip next action
  {
    const revive = thrallRevivePatch(100, THRALL_DEFAULT_REVIVE_HP_PERCENT);
    assert.equal(revive.currentHp, 40);
    assert.equal(revive.isSlumped, false);
    assert.equal(revive.skipNextAction, true);
    assert.match(thrallReanimateLogLine('THRALL', revive.currentHp), /REANIMATES at 40/);
  }

  // Player-turn timing: grace → then revive on next end
  {
    let squad = [thrall({ ...thrallSlumpEnterPatch(), currentHp: 0 })];
    const tick1 = tickThrallSlumpsAtPlayerTurnEnd(squad, {});
    squad = tick1.squad;
    assert.equal(squad[0].isSlumped, true);
    assert.equal(squad[0].slumpGraceThisPlayerTurn, false);
    assert.equal(tick1.reanimatedUnitIds.length, 0);

    const tick2 = tickThrallSlumpsAtPlayerTurnEnd(squad, {});
    squad = tick2.squad;
    assert.equal(squad[0].isSlumped, false);
    assert.equal(squad[0].currentHp, 40);
    assert.equal(squad[0].skipNextAction, true);
    assert.deepEqual(tick2.reanimatedUnitIds, ['thrall-1']);
  }

  // Multiple slumped thralls — encounter stays active
  {
    const squad = [
      thrall({ unitId: 'a', ...thrallSlumpEnterPatch(), currentHp: 0 }),
      thrall({ unitId: 'b', designation: 'THRALL B', ...thrallSlumpEnterPatch(), currentHp: 0 }),
    ];
    assert.equal(allUnitsDefeated(squad), false);
    assert.equal(squad.every((u) => !canUnitAct(u)), true);
  }

  // AoE-style: each slumped thrall execute independently via resolve
  {
    const a = resolveThrallLethalBlow(
      thrall({ unitId: 'a', isSlumped: true, currentHp: 0 }),
      { damage: 12, tags: ['AOE', 'KINETIC'], isDirectDamage: true },
      { fleshWarped: false },
    );
    const b = resolveThrallLethalBlow(
      thrall({ unitId: 'b', isSlumped: true, currentHp: 0 }),
      { damage: 12, tags: ['AOE', 'KINETIC'], isDirectDamage: true },
      { fleshWarped: false },
    );
    assert.equal(a.kind, 'TRUE_DEATH');
    assert.equal(b.kind, 'TRUE_DEATH');
  }

  // Attacks never restart slump duration via enter patch semantics
  {
    const enter = thrallSlumpEnterPatch();
    assert.equal(enter.slumpTurnsRemaining, 1);
    assert.equal(enter.slumpGraceThisPlayerTurn, true);
  }

  console.log('thrallLifecycleEngine.test.ts — all assertions passed');
}

run();
