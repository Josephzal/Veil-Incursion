/**
 * Run: npx tsx --test src/data/combatObjectiveBarRegression.test.ts
 *
 * The objective bar is out of scope for Combat Hub polish. This guards the
 * tokens it positions and sizes itself with, and asserts that the surfaces this
 * pass touched keep out of its space.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { COMBAT_HUD_TYPE } from '../constants/combatHudTypography';
import { OTT_LAYOUT } from '../constants/occultTacticalTerminalTheme';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const readSource = (relative: string) =>
  readFileSync(path.join(REPO_ROOT, relative), 'utf8');

describe('objective bar containment', () => {
  it('keeps the objective bar anchor and type scale unchanged', () => {
    assert.equal(OTT_LAYOUT.missionTop, 8);
    assert.equal(OTT_LAYOUT.missionLeft, 12);
    assert.equal(COMBAT_HUD_TYPE.title, 13);
    assert.equal(COMBAT_HUD_TYPE.label, 12);
  });

  it('still positions itself top-left above the arena', () => {
    const source = readSource('src/screens/combat/layouts/CombatMissionReadout.tsx');
    assert.match(source, /position: 'absolute'/);
    assert.match(source, /top: OTT_LAYOUT\.missionTop/);
    assert.match(source, /left: OTT_LAYOUT\.missionLeft/);
    assert.match(source, /maxWidth: '28%'/);
    assert.match(source, /minWidth: 168/);
    assert.match(source, /zIndex: 26/);
  });

  it('does not host command details, notifications, or intel content', () => {
    const source = readSource('src/screens/combat/layouts/CombatMissionReadout.tsx');
    for (const foreign of [
      'combatActionRailPresentation',
      'combatEnemyNameplatePresentation',
      'combatTurnOrderWindow',
      'CombatTurnOrderTimeline',
      'HostileIntelView',
      'CombatDashboardMacroLog',
    ]) {
      assert.ok(!source.includes(foreign), `objective bar must not reference ${foreign}`);
    }
  });

  it('keeps the event toast in the right dock, clear of the objective bar', () => {
    const source = readSource('src/screens/combat/layouts/CombatRightRail.tsx');
    assert.match(source, /right: 10/);
    assert.match(source, /top: '28%'/);
    assert.ok(!source.includes("left: '"), 'side dock must stay right-anchored');
  });
});
