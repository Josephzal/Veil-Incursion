/**
 * Focused unit checks for Cabal reputation progress math.
 * Run: npx --yes tsx src/data/cabalRepProgress.test.ts
 */
import assert from 'node:assert/strict';
import {
  CABAL_REP_TIER_MAX,
  getCabalReputationProgress,
  xpRequiredForCabalTier,
} from './cabalRepEngine';
import { createDefaultProgressionProfile } from './progressionProfileEngine';
import {
  resolveContractProvisions,
  resolveSpecialConditionFields,
} from '../utils/contractUi';
import type { ProgressionProfile } from '../types/progression';
import type { FactionType } from '../types/game';
import type { GeneratedContract } from '../types/contract';

function withCabal(
  cabalId: FactionType,
  repTier: number,
  repXp: number,
): ProgressionProfile {
  const profile = createDefaultProgressionProfile();
  return {
    ...profile,
    cabals: {
      ...profile.cabals,
      [cabalId]: {
        ...profile.cabals[cabalId],
        repTier,
        repXp,
      },
    },
  };
}

function run(): void {
  const cabalId: FactionType = 'TERRAN_GRID';

  // Zero progress into current rank
  {
    const progress = getCabalReputationProgress(withCabal(cabalId, 0, 0), cabalId);
    assert.equal(progress.rank, 0);
    assert.equal(progress.current, 0);
    assert.equal(progress.required, xpRequiredForCabalTier(0));
    assert.equal(progress.remaining, xpRequiredForCabalTier(0));
    assert.equal(progress.percent, 0);
    assert.equal(progress.isMaxRank, false);
    assert.equal(progress.nextRank, 1);
  }

  // Mid-rank progress (within-rank, not lifetime)
  {
    const required = xpRequiredForCabalTier(2);
    const progress = getCabalReputationProgress(withCabal(cabalId, 2, 40), cabalId);
    assert.equal(progress.rank, 2);
    assert.equal(progress.current, 40);
    assert.equal(progress.required, required);
    assert.equal(progress.remaining, required - 40);
    assert.ok(progress.percent > 0 && progress.percent < 100);
  }

  // One point below next rank
  {
    const required = xpRequiredForCabalTier(1);
    const progress = getCabalReputationProgress(withCabal(cabalId, 1, required - 1), cabalId);
    assert.equal(progress.remaining, 1);
    assert.ok(progress.percent >= 99);
    assert.equal(progress.nextRank, 2);
  }

  // Exact threshold displayed as remaining 0 / full fill (pre-promotion edge)
  {
    const required = xpRequiredForCabalTier(1);
    const progress = getCabalReputationProgress(withCabal(cabalId, 1, required), cabalId);
    assert.equal(progress.remaining, 0);
    assert.equal(progress.percent, 100);
    assert.equal(progress.isMaxRank, false);
  }

  // Maximum rank
  {
    const progress = getCabalReputationProgress(withCabal(cabalId, CABAL_REP_TIER_MAX, 999), cabalId);
    assert.equal(progress.isMaxRank, true);
    assert.equal(progress.nextRank, null);
    assert.equal(progress.remaining, 0);
    assert.equal(progress.percent, 100);
    assert.match(progress.accessibilityLabel, /maximum rank achieved/i);
  }

  // Changing Cabals updates independently
  {
    const profile = withCabal('TERRAN_GRID', 1, 10);
    profile.cabals.LEGION = {
      ...profile.cabals.LEGION,
      repTier: 3,
      repXp: 20,
    };
    const terran = getCabalReputationProgress(profile, 'TERRAN_GRID');
    const legion = getCabalReputationProgress(profile, 'LEGION');
    assert.equal(terran.rank, 1);
    assert.equal(terran.current, 10);
    assert.equal(legion.rank, 3);
    assert.equal(legion.current, 20);
  }

  // No negative remaining
  {
    const progress = getCabalReputationProgress(withCabal(cabalId, 0, 10_000), cabalId);
    assert.ok(progress.remaining >= 0);
    assert.ok(progress.percent <= 100);
  }

  // Provisions vs conditional clauses (presentation helpers)
  {
    const provisions = resolveContractProvisions([
      '+10% Max HP',
      '+1 Kinetic Armor',
      'Standard sponsor terms',
    ]);
    assert.deepEqual(provisions, ['+10% Max HP', '+1 Kinetic Armor']);

    const baseContract = {
      id: 'c1',
      sponsorId: 'TERRAN_GRID' as const,
      title: 'Test',
      objectiveKind: 'EXTRACT_STABLE_RESOURCE' as const,
      objectiveText: 'Recover cargo',
      targetQuantity: 1,
      validSectorIds: [],
      recommendedSectorIds: [],
      reward: { credits: 100, reputation: 2 },
      difficulty: 2 as const,
      refreshLabel: 'test',
    } satisfies Partial<GeneratedContract> as GeneratedContract;

    const unconditionalOnly = resolveSpecialConditionFields(baseContract);
    assert.equal(unconditionalOnly.fields.length, 0);

    const withBonus = resolveSpecialConditionFields({
      ...baseContract,
      id: 'c2',
      sponsorId: 'LEGION',
      bonusObjective: {
        kind: 'DEPTH_EXTRACT',
        text: 'Extract from Depth 2 or deeper',
      },
    });
    assert.equal(withBonus.fields.length, 1);
    assert.equal(withBonus.fields[0]?.label, 'TRIGGER');
  }

  console.log('cabalRepProgress.test.ts: all assertions passed');
}

run();
