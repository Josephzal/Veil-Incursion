# Phase 3K — Weapon-to-Enemy / Sector Matchup Report (closeout amendment)

**Status:** Regenerated during Phase 3L closeout after `RIOT_VANGUARD` legacy collapse.  
**Stop line:** Do not begin Phase 3L feel (3M), validation expansion (3N), migration beyond alias boundary (3O), or numerical tuning (3P).

## RIOT_VANGUARD architecture (amended)

| Item | Final state |
|---|---|
| Live `EncounterEnemyKey` | **No** — removed from union |
| `ENEMY_DEFINITIONS` | **No** — entry removed |
| Alpha / composition / archetype / roster map | **No** — no separate live rows |
| Audit / matchup keys | **No** — never keyed by `RIOT_VANGUARD` |
| Compatibility | `LEGACY_ENEMY_ALIAS_TO_CANONICAL.RIOT_VANGUARD → ECHOING_BRUTE` in `enemyAliasCanonical.ts` |
| Player-facing name | **ECHOING BRUTE** |

Older saves / debug input containing `RIOT_VANGUARD` must call `canonicalizeEncounterEnemyKey` before registry lookup. `getWeaponEnemyMatchup(..., 'RIOT_VANGUARD')` returns the `ECHOING_BRUTE` record.

## Recomputed canonical totals

| Metric | Value | Proof |
|---|---:|---|
| Distinct permanent non-boss enemy IDs | **51** | `allDefinedEnemyKeys().length` / `listLiveEnemyAudit().length` |
| Weapon↔enemy matchups | **459** | `9 × 51` |
| Sector×depth matchups | **135** | `9 × 5 × 3` |
| Prior incorrect count | 52 | Included independent live alias row — **invalid** |

### Invariants

- Each canonical non-boss enemy appears exactly once in the audit.
- No audit or matchup record is keyed by `RIOT_VANGUARD`.
- `ECHOING_BRUTE` appears exactly once (alias did not omit it).
- Matchup classifications were not retuned; only the duplicate identity was removed.

## Phase 3P numerical observations (unchanged)

Carry forward without tuning:

- Nullbreach favorable-share review
- Echo Lantern’s narrow strained-matchup band
- Rival Merc encounter density

## Test evidence

```text
npx tsx src/data/weaponEnemyMatchupPhase3K.test.ts
# OK — enemies=51 matchups=459 sectorRows=135
```
