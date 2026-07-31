/**
 * Focused tests — Aegis Riposte redesign (stored Strike bonus).
 */
import assert from 'node:assert/strict';
import {
  AEGIS_RIPOSTE_BONUS_KINETIC,
  AEGIS_RIPOSTE_STRIKE_TAG,
  abilityCarriesStrikeTag,
  canCashOutAegisRiposte,
  clearAegisRiposte,
  consumeAegisRiposte,
  createDefaultAegisRiposteState,
  expireAegisRiposteAtPlayerTurnEnd,
  grantAegisRiposte,
  restoreAegisRiposteState,
  serializeAegisRiposteState,
} from './aegisRiposteEngine';
import { createDefaultClassCombatEncounterState } from '../types/classCombatAbility';
import { getAbilityTags } from './aegisAbilities';
import { WARDEN_STRIKE_WRAPPER_MOTION_MS } from './wardenStrikePresentation';

function main(): void {
  assert.equal(AEGIS_RIPOSTE_BONUS_KINETIC, 16);
  assert.equal(AEGIS_RIPOSTE_STRIKE_TAG, 'STRIKE');
  assert.ok(getAbilityTags('STRIKE').includes('STRIKE'));
  assert.equal(abilityCarriesStrikeTag('AEGIS', 'STRIKE'), true);
  assert.equal(abilityCarriesStrikeTag('AEGIS', 'VEIL_PIERCER'), false);
  assert.equal(abilityCarriesStrikeTag('AEGIS', 'RUIN'), false);

  // 1. Perfect Parry grants one charge
  {
    const g = grantAegisRiposte({
      state: createDefaultAegisRiposteState(),
      currentPlayerTurns: 1,
      grantedBy: 'PERFECT_PARRY',
      grantId: 'g1',
    });
    assert.equal(g.state.ready, true);
    assert.equal(g.state.expiresAfterPlayerTurn, 2);
    assert.equal(g.state.grantedBy, 'PERFECT_PARRY');
    assert.equal(g.refreshed, false);
  }

  // 2–4. Ordinary Parry / Fracture / Armor are not grant sources in this engine
  // (hub no longer calls grant for those). Engine only grants when asked.
  {
    const idle = createDefaultAegisRiposteState();
    assert.equal(idle.ready, false);
  }

  // 5–6. Parry card stays Parry — covered by UI; state does not rename actions.
  // 7. Refresh without stacking
  {
    const first = grantAegisRiposte({
      state: createDefaultAegisRiposteState(),
      currentPlayerTurns: 1,
      grantedBy: 'PERFECT_PARRY',
      grantId: 'a',
    }).state;
    const second = grantAegisRiposte({
      state: first,
      currentPlayerTurns: 2,
      grantedBy: 'PERFECT_PARRY',
      grantId: 'b',
    });
    assert.equal(second.refreshed, true);
    assert.equal(second.state.ready, true);
    assert.equal(second.state.expiresAfterPlayerTurn, 3);
    assert.equal(second.state.grantId, 'b');
  }

  // 8. Successful Strike cash-out gate
  {
    const ready = grantAegisRiposte({
      state: createDefaultAegisRiposteState(),
      currentPlayerTurns: 1,
      grantedBy: 'PERFECT_PARRY',
    }).state;
    assert.equal(canCashOutAegisRiposte({
      state: ready,
      operativeClass: 'AEGIS',
      abilityId: 'STRIKE',
      primaryTargetId: 'u1',
      hitTargetId: 'u1',
      successfulHit: true,
      alreadyCashedForAction: false,
    }), true);
  }

  // 9–10. Miss / evade do not cash out
  {
    const ready = grantAegisRiposte({
      state: createDefaultAegisRiposteState(),
      currentPlayerTurns: 1,
      grantedBy: 'PERFECT_PARRY',
    }).state;
    assert.equal(canCashOutAegisRiposte({
      state: ready,
      operativeClass: 'AEGIS',
      abilityId: 'STRIKE',
      primaryTargetId: 'u1',
      hitTargetId: 'u1',
      successfulHit: false,
      alreadyCashedForAction: false,
    }), false);
  }

  // 11. Cancelled / already cashed
  {
    const ready = grantAegisRiposte({
      state: createDefaultAegisRiposteState(),
      currentPlayerTurns: 1,
      grantedBy: 'PERFECT_PARRY',
    }).state;
    assert.equal(canCashOutAegisRiposte({
      state: ready,
      operativeClass: 'AEGIS',
      abilityId: 'STRIKE',
      primaryTargetId: 'u1',
      hitTargetId: 'u1',
      successfulHit: true,
      alreadyCashedForAction: true,
    }), false);
  }

  // 12. Non-Strike
  {
    const ready = grantAegisRiposte({
      state: createDefaultAegisRiposteState(),
      currentPlayerTurns: 1,
      grantedBy: 'PERFECT_PARRY',
    }).state;
    assert.equal(canCashOutAegisRiposte({
      state: ready,
      operativeClass: 'AEGIS',
      abilityId: 'VEIL_PIERCER',
      primaryTargetId: 'u1',
      hitTargetId: 'u1',
      successfulHit: true,
      alreadyCashedForAction: false,
    }), false);
  }

  // 13–15. Multi-hit / area / secondary
  {
    const ready = grantAegisRiposte({
      state: createDefaultAegisRiposteState(),
      currentPlayerTurns: 1,
      grantedBy: 'PERFECT_PARRY',
    }).state;
    assert.equal(canCashOutAegisRiposte({
      state: ready,
      operativeClass: 'AEGIS',
      abilityId: 'STRIKE',
      primaryTargetId: 'primary',
      hitTargetId: 'secondary',
      successfulHit: true,
      alreadyCashedForAction: false,
    }), false, 'secondary hit must not cash out');
    assert.equal(canCashOutAegisRiposte({
      state: ready,
      operativeClass: 'AEGIS',
      abilityId: 'STRIKE',
      primaryTargetId: 'primary',
      hitTargetId: 'primary',
      successfulHit: true,
      alreadyCashedForAction: true,
    }), false, 'second hit on same action must not cash out again');
  }

  // 16. Expiration at end of correct player turn
  {
    const ready = grantAegisRiposte({
      state: createDefaultAegisRiposteState(),
      currentPlayerTurns: 1,
      grantedBy: 'PERFECT_PARRY',
    }).state;
    const early = expireAegisRiposteAtPlayerTurnEnd({
      state: ready,
      currentPlayerTurns: 1,
    });
    assert.equal(early.expired, false);
    assert.equal(early.state.ready, true);
    const due = expireAegisRiposteAtPlayerTurnEnd({
      state: ready,
      currentPlayerTurns: 2,
    });
    assert.equal(due.expired, true);
    assert.equal(due.state.ready, false);
  }

  // 17. Warden hold pause (attack pose linger) — not a second approach
  assert.equal(WARDEN_STRIKE_WRAPPER_MOTION_MS.holdMs, 500);

  // 18. Consume once
  {
    const ready = grantAegisRiposte({
      state: createDefaultAegisRiposteState(),
      currentPlayerTurns: 1,
      grantedBy: 'PERFECT_PARRY',
    }).state;
    const once = consumeAegisRiposte(ready);
    assert.equal(once.consumed, true);
    assert.equal(once.state.ready, false);
    const twice = consumeAegisRiposte(once.state);
    assert.equal(twice.consumed, false);
  }

  // 19. Save / restore
  {
    const ready = grantAegisRiposte({
      state: createDefaultAegisRiposteState(),
      currentPlayerTurns: 3,
      grantedBy: 'PERFECT_PARRY',
      grantId: 'save-1',
    }).state;
    const raw = serializeAegisRiposteState(ready);
    const restored = restoreAegisRiposteState(raw);
    assert.equal(restored.ready, true);
    assert.equal(restored.expiresAfterPlayerTurn, 4);
    assert.equal(restored.grantId, 'save-1');
  }

  // 20. Encounter cleanup
  {
    const encounter = createDefaultClassCombatEncounterState();
    assert.equal(encounter.riposteReady, false);
    assert.equal(encounter.riposteExpiresAfterPlayerTurn, null);
    const cleared = clearAegisRiposte(grantAegisRiposte({
      state: createDefaultAegisRiposteState(),
      currentPlayerTurns: 1,
      grantedBy: 'PERFECT_PARRY',
    }).state);
    assert.equal(cleared.ready, false);
  }

  console.log('[aegis riposte] redesign tests passed');
}

main();
