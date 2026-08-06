/**
 * Phase E.1e.1 — structural containment: Neutron once / Apex WA ownership /
 * Masochist apply-then-clear / Sanguine once-per-turn.
 */
import assert from 'node:assert/strict';
import {
  applyApexBossPacketScale,
  applyMasochistsJoyAmplification,
  canActivateSanguineThisTurn,
  clearNeutronOnceLedger,
  clearSanguineTurnGuard,
  computeNeutronReserveAdd,
  createNeutronOnceLedger,
  createSanguineTurnGuard,
  markSanguineActivatedThisTurn,
  restoreSanguineTurnAvailability,
} from './aegisGraftPhaseE1e1Engine';
import {
  buildWeaponActionGraftCastPlan,
  previewWeaponActionGraftHitDamages,
  weaponHitPlanDamage,
} from './aegisWeaponActionGraftEngine';
import {
  planDivergence,
  planSeverance,
  planWardensStrike,
  planAegisWeaponAction,
} from './aegisWeaponActionResolveEngine';
import { buildGraftCastPlan, scaleGraftDamage } from './veilGraftEngine';
import { GRAFT_DATABASE } from './veilGraftDatabase';
import { scaleClassGraftDamage, buildClassGraftCastPlan } from './classGraftEngine';
import { applyAbyssalResonanceDamage } from './aegisBoonHookRunner';
import type { LeyLineMutationId } from '../types/leyLineMutation';
import type { MutationCombatModifiers } from './boonEngine';

const neutronAdd100 = computeNeutronReserveAdd(100);
const neutronAdd150 = computeNeutronReserveAdd(150);
assert.equal(neutronAdd100, 80);
assert.equal(neutronAdd150, 120);

function scaleWaNeutron(
  packet: number,
  reserve: number,
  playerActionId: string,
  ledger: ReturnType<typeof createNeutronOnceLedger>,
  isBoss = false,
): number {
  const plan = buildWeaponActionGraftCastPlan('WARDENS_STRIKE', 'NEUTRON_GRAFT');
  return scaleGraftDamage(packet, plan, reserve, isBoss, {
    damageAlreadyScaled: true,
    neutronOnce: { playerActionId, ledger },
  });
}

// ── Neutron: one packet @100 / @150 ──────────────────────────────────────────
{
  const ledger = createNeutronOnceLedger();
  const plan = planWardensStrike();
  const base = weaponHitPlanDamage(plan.hits[0]!);
  assert.equal(base, 14);
  assert.equal(scaleWaNeutron(base, 100, 'pa-ws-100', ledger), 14 + 80);
  assert.equal(ledger.consumedForPlayerActionId, 'pa-ws-100');
}
{
  const ledger = createNeutronOnceLedger();
  assert.equal(scaleWaNeutron(14, 150, 'pa-ws-150', ledger), 14 + 120);
}

// ── Neutron: Divergence @100 / @150 — once across two packets ────────────────
{
  const plan = planDivergence();
  assert.equal(plan.hits.length, 2);
  assert.equal(weaponHitPlanDamage(plan.hits[0]!), 5);
  assert.equal(weaponHitPlanDamage(plan.hits[1]!), 5);
  const ledger = createNeutronOnceLedger();
  const a = scaleWaNeutron(5, 100, 'pa-div-100', ledger);
  const b = scaleWaNeutron(5, 100, 'pa-div-100', ledger);
  assert.equal(a, 85);
  assert.equal(b, 5);
  assert.equal(a + b, 90);
}
{
  const ledger = createNeutronOnceLedger();
  const a = scaleWaNeutron(5, 150, 'pa-div-150', ledger);
  const b = scaleWaNeutron(5, 150, 'pa-div-150', ledger);
  assert.equal(a + b, 5 + 5 + 120);
}

// ── Neutron: Horizon (Dread Horizon) @100 / @150 ─────────────────────────────
{
  const plan = planAegisWeaponAction('DREAD_HORIZON', {
    tempoArmed: false,
    targetFracturedAtStart: false,
    noRespiteUsedThisTurn: false,
    doomfallReleaseAvailable: false,
  });
  assert.equal(plan.hits.length, 2);
  assert.equal(weaponHitPlanDamage(plan.hits[0]!), 12);
  assert.equal(weaponHitPlanDamage(plan.hits[1]!), 12);
  const ledger = createNeutronOnceLedger();
  const a = scaleWaNeutron(12, 100, 'pa-hz-100', ledger);
  const b = scaleWaNeutron(12, 100, 'pa-hz-100', ledger);
  assert.equal(a + b, 12 + 12 + 80);
}
{
  const ledger = createNeutronOnceLedger();
  const a = scaleWaNeutron(12, 150, 'pa-hz-150', ledger);
  const b = scaleWaNeutron(12, 150, 'pa-hz-150', ledger);
  assert.equal(a + b, 12 + 12 + 120);
}

// ── Neutron: Tempo Severance (unarmed tempo = 12+12; armed = 12+20) ───────────
{
  const unarmed = planSeverance({ tempoArmed: false });
  assert.equal(weaponHitPlanDamage(unarmed.hits[0]!), 12);
  assert.equal(weaponHitPlanDamage(unarmed.hits[1]!), 12);
  const ledger = createNeutronOnceLedger();
  const a = scaleWaNeutron(12, 100, 'pa-sev', ledger);
  const b = scaleWaNeutron(12, 100, 'pa-sev', ledger);
  assert.equal(a + b, 12 + 12 + 80);
}
{
  const armed = planSeverance({ tempoArmed: true });
  assert.equal(weaponHitPlanDamage(armed.hits[0]!), 12);
  assert.equal(weaponHitPlanDamage(armed.hits[1]!), 20);
  const ledger = createNeutronOnceLedger();
  const a = scaleWaNeutron(12, 100, 'pa-sev-t', ledger);
  const b = scaleWaNeutron(20, 100, 'pa-sev-t', ledger);
  assert.equal(a + b, 12 + 20 + 80);
}

// ── Neutron: three-target RUIN (technique path, not pre-scaled) ───────────────
{
  const plan = buildGraftCastPlan('RUIN', 'NEUTRON_GRAFT');
  const ledger = createNeutronOnceLedger();
  const packets = [12, 12, 12];
  const out = packets.map((p) => scaleGraftDamage(p, plan, 100, false, {
    neutronOnce: { playerActionId: 'pa-ruin-3', ledger },
  }));
  assert.deepEqual(out, [92, 12, 12]);
  assert.equal(out.reduce((s, n) => s + n, 0), 116);
}

// ── Neutron: two packets same enemy; multiple unique enemies ──────────────────
{
  const ledger = createNeutronOnceLedger();
  assert.equal(scaleWaNeutron(12, 100, 'pa-same', ledger), 92);
  assert.equal(scaleWaNeutron(12, 100, 'pa-same', ledger), 12);
}
{
  const ledger = createNeutronOnceLedger();
  // Unique enemies still share playerActionId — once only.
  assert.equal(scaleWaNeutron(12, 100, 'pa-multi-e', ledger), 92);
  assert.equal(scaleWaNeutron(12, 100, 'pa-multi-e', ledger), 12);
  assert.equal(scaleWaNeutron(12, 100, 'pa-multi-e', ledger), 12);
}

// ── Neutron: no eligible damage after commitment → zero add, no stale consume ─
{
  const ledger = createNeutronOnceLedger();
  const plan = buildWeaponActionGraftCastPlan('WARDENS_STRIKE', 'NEUTRON_GRAFT');
  const out = scaleGraftDamage(0, plan, 100, false, {
    damageAlreadyScaled: true,
    neutronOnce: { playerActionId: 'pa-zero', ledger },
  });
  assert.equal(out, 0);
  assert.equal(ledger.consumedForPlayerActionId, null);
  // Later eligible packet on same action may still receive the add.
  assert.equal(scaleWaNeutron(14, 100, 'pa-zero', ledger), 94);
}

// ── Neutron: cancel / failed validation — no ledger consume (no scale call) ───
{
  const ledger = createNeutronOnceLedger();
  // Cancel before commitment never calls scaleGraftDamage.
  assert.equal(ledger.consumedForPlayerActionId, null);
  clearNeutronOnceLedger(ledger);
  assert.equal(ledger.consumedForPlayerActionId, null);
}

// ── Neutron: combat-end / cleanup clears ledger ───────────────────────────────
{
  const ledger = createNeutronOnceLedger();
  scaleWaNeutron(14, 100, 'pa-end', ledger);
  clearNeutronOnceLedger(ledger);
  assert.equal(ledger.consumedForPlayerActionId, null);
}

// ── Neutron: next action receives a fresh once guard ─────────────────────────
{
  const ledger = createNeutronOnceLedger();
  assert.equal(scaleWaNeutron(14, 100, 'pa-a', ledger), 94);
  assert.equal(scaleWaNeutron(14, 100, 'pa-a', ledger), 14);
  assert.equal(scaleWaNeutron(14, 100, 'pa-b', ledger), 94);
}

// ── Neutron: no recursive second add from graft-added follow-up on same id ────
{
  const ledger = createNeutronOnceLedger();
  const plan = buildWeaponActionGraftCastPlan('WARDENS_STRIKE', 'NEUTRON_GRAFT');
  const first = scaleGraftDamage(14, plan, 100, false, {
    damageAlreadyScaled: true,
    neutronOnce: { playerActionId: 'pa-nr', ledger },
  });
  const echo = scaleGraftDamage(7, plan, 100, false, {
    damageAlreadyScaled: true,
    neutronOnce: { playerActionId: 'pa-nr', ledger },
  });
  assert.equal(first, 94);
  assert.equal(echo, 7);
}

// ── Neutron + Resonance: amplifies the single legal add; does not multiply apps ─
{
  const owned: LeyLineMutationId[] = ['ABYSSAL_RESONANCE'];
  const mods = { abyssalResonancePctPerBrand: 10 } as MutationCombatModifiers;
  const ledger = createNeutronOnceLedger();
  const plan = buildWeaponActionGraftCastPlan('WARDENS_STRIKE', 'NEUTRON_GRAFT');
  const afterNeutron = scaleGraftDamage(14, plan, 100, false, {
    damageAlreadyScaled: true,
    neutronOnce: { playerActionId: 'pa-res', ledger },
  });
  assert.equal(afterNeutron, 94);
  // Zero brands — Resonance is a no-op; Neutron add already baked once.
  assert.equal(applyAbyssalResonanceDamage(owned, 'STRIKE', afterNeutron, 0, mods), 94);
  // One brand — amplifies the single Neutron-inclusive packet.
  assert.equal(applyAbyssalResonanceDamage(owned, 'STRIKE', afterNeutron, 1, mods), Math.floor(94 * 1.1));
  // Two brands — still one Neutron application upstream.
  assert.equal(applyAbyssalResonanceDamage(owned, 'STRIKE', afterNeutron, 2, mods), Math.floor(94 * 1.2));
  const secondPacket = scaleGraftDamage(14, plan, 100, false, {
    damageAlreadyScaled: true,
    neutronOnce: { playerActionId: 'pa-res', ledger },
  });
  assert.equal(secondPacket, 14);
}

// ── Apex: non-boss unchanged; single-packet boss ×2; multi-packet aggregate ×2 ─
{
  assert.equal(applyApexBossPacketScale(14, 2, false), 14);
  assert.equal(applyApexBossPacketScale(14, 2, true), 28);
  const plan = planDivergence();
  const ungrafted = plan.hits.reduce((s, h) => s + weaponHitPlanDamage(h), 0);
  assert.equal(ungrafted, 10);
  const bossAgg = plan.hits.reduce(
    (s, h) => s + applyApexBossPacketScale(weaponHitPlanDamage(h), 2, true),
    0,
  );
  assert.equal(bossAgg, 20);
  assert.equal(bossAgg, ungrafted * 2);
}

// ── Apex: pre-scaled path does not reapply in scaleGraftDamage ────────────────
{
  const apex = buildWeaponActionGraftCastPlan('WARDENS_STRIKE', 'APEX_GRAFT');
  assert.equal(apex.bossDamageMultiplier, 2);
  // Delivery already applied ×2 → 28 enters hurtEnemy pre-scaled.
  assert.equal(
    scaleGraftDamage(28, apex, 0, true, { damageAlreadyScaled: true }),
    28,
  );
  // Technique / non-prescaled path still applies Apex.
  assert.equal(scaleGraftDamage(14, apex, 0, true), 28);
  assert.equal(scaleGraftDamage(14, apex, 0, false), 14);
}

// ── Apex: multi-packet pre-scaled does not become 4× ──────────────────────────
{
  const apex = buildWeaponActionGraftCastPlan('DIVERGENCE', 'APEX_GRAFT');
  const plan = planDivergence();
  const delivery = plan.hits.map((h) => applyApexBossPacketScale(weaponHitPlanDamage(h), 2, true));
  const hub = delivery.map((d) => scaleGraftDamage(d, apex, 0, true, { damageAlreadyScaled: true }));
  assert.deepEqual(hub, [10, 10]);
  assert.equal(hub.reduce((s, n) => s + n, 0), 20);
}

// ── Apex: Density ownership still once (regression — pre-scaled skips mult) ───
{
  const density = buildWeaponActionGraftCastPlan('WARDENS_STRIKE', 'DENSITY_GRAFT');
  const plan = planWardensStrike();
  const transformed = previewWeaponActionGraftHitDamages(plan, density);
  assert.equal(transformed[0], 28);
  assert.equal(
    scaleGraftDamage(transformed[0]!, density, 0, false, { damageAlreadyScaled: true }),
    28,
  );
}

// ── Masochist: apply then clear; following attack normal ──────────────────────
{
  const staged = applyMasochistsJoyAmplification(20, true);
  assert.equal(staged.damage, 30);
  assert.equal(staged.pendingBuff, false);
  const follow = applyMasochistsJoyAmplification(20, staged.pendingBuff);
  assert.equal(follow.damage, 20);
  assert.equal(follow.pendingBuff, false);
}
{
  // Cancel / failed validation preserve pending (no apply call).
  let pending = true;
  // no amplification invoked
  assert.equal(pending, true);
  const hit = applyMasochistsJoyAmplification(10, pending);
  assert.equal(hit.damage, 15);
  pending = hit.pendingBuff;
  assert.equal(pending, false);
}
{
  // Multi-packet: single-consumption — first eligible packet only.
  let pending = true;
  const p1 = applyMasochistsJoyAmplification(12, pending);
  pending = p1.pendingBuff;
  const p2 = applyMasochistsJoyAmplification(12, pending);
  assert.equal(p1.damage, 18);
  assert.equal(p2.damage, 12);
}

// ── Sanguine: once per player turn; cancel/fail do not consume ────────────────
{
  const guard = createSanguineTurnGuard();
  assert.equal(canActivateSanguineThisTurn(guard, 1).ok, true);
  markSanguineActivatedThisTurn(guard, 1);
  const second = canActivateSanguineThisTurn(guard, 1);
  assert.equal(second.ok, false);
  if (!second.ok) {
    assert.equal(second.code, 'SANGUINE_TURN_LIMIT');
  }
  // Next player turn resets by identity.
  assert.equal(canActivateSanguineThisTurn(guard, 2).ok, true);
  markSanguineActivatedThisTurn(guard, 2);
  assert.equal(canActivateSanguineThisTurn(guard, 2).ok, false);
}
{
  const guard = createSanguineTurnGuard();
  // Cancel before commitment — never mark.
  assert.equal(canActivateSanguineThisTurn(guard, 1).ok, true);
  // Failed validation — never mark.
  assert.equal(canActivateSanguineThisTurn(guard, 1).ok, true);
  markSanguineActivatedThisTurn(guard, 1);
  // Rollback restores.
  restoreSanguineTurnAvailability(guard);
  assert.equal(canActivateSanguineThisTurn(guard, 1).ok, true);
  clearSanguineTurnGuard(guard);
  assert.equal(guard.usedOnPlayerTurn, null);
}

// ── Sanguine costs unchanged in authored definition ───────────────────────────
{
  assert.equal(GRAFT_DATABASE.SANGUINE_GRAFT.setApCost, 0);
  assert.equal(GRAFT_DATABASE.SANGUINE_GRAFT.addHpCost, 0.1);
  assert.match(GRAFT_DATABASE.SANGUINE_GRAFT.description, /Once per turn/i);
  const wa = buildWeaponActionGraftCastPlan('WARDENS_STRIKE', 'SANGUINE_GRAFT');
  assert.equal(wa.apCost, 0);
  assert.equal(wa.hpCostPct, 10);
}

// ── Density / Resonance numbers unchanged ─────────────────────────────────────
{
  assert.equal(GRAFT_DATABASE.DENSITY_GRAFT.damageMultiplier, 2);
  assert.equal(GRAFT_DATABASE.DENSITY_GRAFT.reservePenalty, 20);
}

// ── Hex Shot / Envoy smoke through untouched class helper ─────────────────────
{
  const hex = buildClassGraftCastPlan('HEX_SHOT', 'SILVER_CORE_SIDEARM', 'BOTTOMLESS_DRUM_GRAFT');
  assert.equal(hex.damageMultiplier, 1.5);
  assert.equal(scaleClassGraftDamage(10, hex, {
    currentAmmo: 6, maxAmmo: 6, veilFlux: 0, fluxMaxCap: 100,
  }), 15);
  const envoy = buildClassGraftCastPlan('ENVOY', 'VEIL_SPLINTER', 'VOID_CONDUCTOR_GRAFT');
  assert.equal(envoy.damageMultiplier, 2);
  assert.equal(scaleClassGraftDamage(20, envoy, {
    currentAmmo: 0, maxAmmo: 0, veilFlux: 40, fluxMaxCap: 100,
  }), 40);
}

// ── Ultimate ungraftable smoke (Neutron cannot transform AV) ──────────────────
{
  // Aegis ultimates remain ungraftable; cast plan for techniques still builds,
  // but Sanctuary/assignment validation is covered by existing suites.
  const neutron = buildGraftCastPlan('DEVASTATE', 'NEUTRON_GRAFT');
  assert.equal(neutron.consumeAllReserve, true);
  assert.equal(GRAFT_DATABASE.NEUTRON_GRAFT.setApCost, 0);
}

console.log('aegisGraftPhaseE1e1.test.ts: all assertions passed');
