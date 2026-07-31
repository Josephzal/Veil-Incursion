/**
 * Aegis Longsword anatomy pose-registration — idle ↔ attack foot/body stability.
 * Run: npx --yes tsx src/data/combatPoseRegistration.test.ts
 */

import assert from 'node:assert/strict';
import {
  AEGIS_LONGSWORD_POSE_REGISTRATION,
  computeAnatomyRegisteredLayouts,
  computeRegisteredPoseLayout,
  resolveActorGroundAnchor,
  usesAnatomyPoseRegistration,
} from '../utils/combatPoseRegistration';

const boxes = [
  { width: 304.5, height: 320, label: 'melee-wide ~320h' },
  { width: 304.5, height: 400, label: 'melee-wide 400h' },
  { width: 304.5, height: 360, label: '1024x720-ish slot' },
] as const;

assert.equal(usesAnatomyPoseRegistration('aegis-runed-longsword'), true);
assert.equal(usesAnatomyPoseRegistration('aegis-rift-edge'), false);
assert.equal(usesAnatomyPoseRegistration('envoy-echo-lantern'), false);
assert.equal(usesAnatomyPoseRegistration(null), false);

for (const box of boxes) {
  const layouts = computeAnatomyRegisteredLayouts(box);
  assert.ok(layouts, box.label);
  const { idle, attack, anchor } = layouts!;
  assert.ok(Math.abs(idle.footX - anchor.x) < 0.05, `${box.label} idle footX`);
  assert.ok(Math.abs(idle.footY - anchor.y) < 0.05, `${box.label} idle footY`);
  assert.ok(
    Math.abs(attack.footX - idle.footX) <= 2,
    `${box.label} ΔfootX=${attack.footX - idle.footX}`,
  );
  assert.ok(
    Math.abs(attack.footY - idle.footY) <= 2,
    `${box.label} ΔfootY=${attack.footY - idle.footY}`,
  );
  const ratio = attack.renderedBodyHeight / idle.renderedBodyHeight;
  assert.ok(Math.abs(ratio - 1) <= 0.02, `${box.label} body ratio=${ratio}`);
}

{
  const box = { width: 304.5, height: 360 };
  const idleReg = AEGIS_LONGSWORD_POSE_REGISTRATION.idle;
  const attackReg = AEGIS_LONGSWORD_POSE_REGISTRATION.attack;
  const anchor = resolveActorGroundAnchor(box, idleReg);
  let lastIdle = computeRegisteredPoseLayout(idleReg, anchor);
  for (let i = 0; i < 8; i += 1) {
    const attack = computeRegisteredPoseLayout(attackReg, anchor);
    const idle = computeRegisteredPoseLayout(idleReg, anchor);
    assert.equal(idle.left, lastIdle.left);
    assert.equal(idle.top, lastIdle.top);
    assert.equal(idle.scale, lastIdle.scale);
    assert.ok(Math.abs(attack.footX - idle.footX) <= 2);
    assert.ok(Math.abs(attack.footY - idle.footY) <= 2);
    lastIdle = idle;
  }
}

{
  const box = { width: 304.5, height: 320 };
  const layouts = computeAnatomyRegisteredLayouts(box)!;
  const ΔfootX = layouts.attack.footX - layouts.idle.footX;
  const ΔfootY = layouts.attack.footY - layouts.idle.footY;
  const bodyPct = (layouts.attack.renderedBodyHeight / layouts.idle.renderedBodyHeight - 1) * 100;
  const legacyΔfootX = -25.2;
  const legacyBodyPct = -10.3;
  assert.ok(Math.abs(ΔfootX) < Math.abs(legacyΔfootX));
  assert.ok(Math.abs(bodyPct) < Math.abs(legacyBodyPct));
  assert.ok(Math.abs(ΔfootX) <= 2);
  assert.ok(Math.abs(ΔfootY) <= 2);
  assert.ok(Math.abs(bodyPct) <= 2);
  console.log(
    `[longsword pose] AFTER Δfoot=(${ΔfootX.toFixed(2)}, ${ΔfootY.toFixed(2)}) `
    + `bodyΔ=${bodyPct.toFixed(2)}%  (legacy ≈ ΔfootX ${legacyΔfootX}, body ${legacyBodyPct}%)`,
  );
  console.log(
    `[longsword pose] idle ${layouts.idle.width.toFixed(1)}x${layouts.idle.height.toFixed(1)} `
    + `attack ${layouts.attack.width.toFixed(1)}x${layouts.attack.height.toFixed(1)} box ${box.width}x${box.height}`,
  );
  // Attack canvas is wider than idle at the same body scale — blade extends past body.
  assert.ok(layouts.attack.width > layouts.idle.width * 1.5);
}

console.log('combatPoseRegistration.test.ts: OK');
