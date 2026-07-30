# Phase 3M — Runtime Repair Report (Ultimate Interactions + Combat VFX)

**Status:** `BLOCKED` — code fixes landed; **manual combat recordings not yet produced**  
**Stop line:** Do not begin 3N / 3O / 3P until re-review recordings pass.

The prior Phase 3M “repair complete” claim is **withdrawn**. Screen recordings from 2026-07-29 remain the acceptance baseline until new captures show interactions opening from the red / yellow / purple circles.

## 1. Root cause (runtime)

### Threefold Brand (Aegis / Longsword)

1. With landscape enemy chrome active, `VectorSliceOverlay` was **not** mounted in `CombatMinigameOverlayHost`.
2. Slice UI lived only in `CombatEviscerateCinematic`, which returned `null` when no target portrait resolved.
3. `queueSlice` still auto-advanced every 1200ms × 3 segments → `evaluateSlice()` → damage + Reserve spend even with **zero player traces**.
4. Recording timing (~4s from circle to log) matches that auto-timer path.

### WU-4 staged (Sixth Seal, Gravefall, etc.)

1. `WeaponUltimateStagedSkillOverlay` auto-committed after `durationMs` (2800ms) even with **no holds**.
2. Overlay contrast was weak (easy to miss under combat HUD).
3. Zero Protocol similarly auto-completed at 2000ms with **0 taps**, still resolving.

### Shared

Previous mount-gate fix (`classMinigameActive` includes staged / slice) was necessary but **insufficient**: UI could be absent or invisible while timers still committed.

## 2. Previous vs corrected path

**Previous (broken):**  
`circle → open state / optional invisible UI → timer auto-commit → log + spend`

**Corrected:**  
`circle → mount interaction in CombatMinigameOverlayHost (z-index 200) → player completes holds/traces/taps → commit once`  
**or** `timer expires with zero input → free cancel (no spend, no damage, no resolution log)`

## 3. Host mount location

`CombatScreen` → `CombatMinigameOverlayProvider` → `CombatMinigameOverlayHost` (full combat viewport, z-index 200).  
Content ported from hub via `CombatMinigameOverlaySink` / `CombatMinigameActiveBridge`.

Threefold `VectorSliceOverlay` is now a child of that host when `OFFENSE_SLICE`.

## 4. Nine controller mappings

Unchanged registry mappings (permanent IDs):

| Weapon | Ultimate | Controller |
|--------|----------|------------|
| Longsword | THREEFOLD BRAND | Slice in minigame host |
| Paired Blades | REND THE VEIL | WU4 staged |
| Unmaker | GRAVEFALL | WU4 staged |
| Revolver | SIXTH SEAL | WU4 staged |
| Carbine | ZERO PROTOCOL | Grid overlay |
| Black Door | LAST KNOCK | WU4 staged |
| Vambrace | FUNERAL KNOT | WU4 staged |
| Scythe | NULL CIRCUIT | Cataclysm sigil |
| Heart’s Due | CRIMSON REFRACTION | WU4 staged |

## 5. Commit / cancel boundaries

| Event | Mutates combat? |
|-------|-----------------|
| Circle activate / interaction open | No (log line for aperture only) |
| Zero-input timeout | Cancel free |
| Explicit cancel | Cancel free |
| Successful interaction | Commit once (activation token lock on staged) |

## 6. VFX changes this pass

- Removed normal **full red enemy silhouette tint** (`CombatEnemyHitEffect` → localized spark).
- Removed mustard/purple/red **class impact fills** (`CombatEnemyClassImpact` no-ops).
- Weapon presentation host retained restrained primitives from prior pass.
- Pose calibration remains in `combatPortraitCalibration.ts` (visualScale per weapon/pose).

## 7. Tests

| Suite | Result |
|-------|--------|
| WU-1 … WU-6 | Run after this patch |
| `weaponCombatPresentationPhase3M.test.ts` | Run after this patch |
| `weaponUltimateActivationPhase3MRepair.test.ts` | Includes zero-input cancel proofs |

## 8. TypeScript

Baseline target: **75 → 75 (Δ0)**.

## 9. Manual recordings

**Not produced in this session.** Status remains **BLOCKED** for acceptance until new recordings show:

1. Circle → visible interaction for all nine
2. Cancel → no spend / no resolution log
3. Complete → single commit + log
4. No full-body purple/yellow outline, solid-red enemy fill, or mustard polygon as primary VFX

## 10. Files touched (runtime repair)

- `TacticalCombatHub.tsx` — slice in host, zero-hit cancel, pause on slice, commit lock, trace hooks
- `WeaponUltimateStagedSkillOverlay.tsx` — zero-input cancel, stronger chrome
- `ZeroProtocolGridOverlay.tsx` — zero-tap cancel path + visibility
- `CombatEviscerateCinematic.tsx` — backdrop only; slice not gated on portrait
- `WeaponUltimateHostChrome.tsx` — absoluteFillObject
- `CombatEnemyHitEffect.tsx` / `CombatEnemyClassImpact.tsx` — remove generic fills
- `ultimateActivationTrace.ts` — optional `globalThis.__VEIL_ULTIMATE_TRACE__`
- Tests + this report
