# Phase 3L — Weapon UI / Tutorial / Combat-HUD Closeout Report

**Status:** Automated naming + HUD-binding repair **PASS**. Manual HUD matrix **AWAITING INTERACTIVE CAPTURE**.  
**Stop line:** Do not begin Phase 3M. Do not implement weapon-specific ultimates.

## 1. Canonical weapon-name registry (accepted)

| Permanent weapon ID | Canonical display name |
|---|---|
| `aegis-runed-longsword` | Runed Longsword |
| `aegis-rift-edge` | **Veil Edge** (was Rift Edge) |
| `aegis-claymore-blade` | Claymore Blade |
| `hex-silver-core-sidearm` | Silver-Core Sidearm |
| `hex-void-cannon` | **Nullbreach Shotgun** (was Nullbreach Carbine) |
| `hex-pulse-rifle` | Pulse Rifle |
| `envoy-null-conduit` | Null Conduit |
| `envoy-echo-lantern` | Echo Lantern |
| `envoy-sanguine-prism` | Sanguine Prism |

**Stable IDs unchanged:** `aegis-rift-edge`, `hex-void-cannon` (and all other family IDs).

## 2. Final nine anchor-attack registry

| Permanent weapon ID | Anchor ID | Player-facing name | Class compat (legacy input only) |
|---|---|---|---|
| `aegis-runed-longsword` | `WARDENS_STRIKE` | `WARDEN'S STRIKE` | `STRIKE` |
| `aegis-rift-edge` | `VEILSTEP_SLASH` | `VEILSTEP SLASH` | `STRIKE` |
| `aegis-claymore-blade` | `BREAKING_HEW` | `BREAKING HEW` | `STRIKE` |
| `hex-silver-core-sidearm` | `SILVER_VERDICT` | `SILVER VERDICT` | `SILVER_CORE_SIDEARM` |
| `hex-void-cannon` | `BREACH_ROUND` | `BREACH ROUND` | `SILVER_CORE_SIDEARM` |
| `hex-pulse-rifle` | `CINDER_SWEEP` | `CINDER SWEEP` | `SILVER_CORE_SIDEARM` |
| `envoy-null-conduit` | `NULL_ARC` | `NULL ARC` | `VEIL_SPLINTER` |
| `envoy-echo-lantern` | `BLACK_WICK` | `BLACK WICK` | `VEIL_SPLINTER` |
| `envoy-sanguine-prism` | `BLOOD_REFRACTION` | `BLOOD REFRACTION` | `VEIL_SPLINTER` |

Source of truth: `src/data/weaponAnchorAttackRegistry.ts`.  
Card preview: `src/data/weaponAnchorCardPresentation.ts` (numbers from `weaponBasicEngine`).

### Runtime binding (equipped weapon → card → execute → log)

| Weapon ID | Display | Anchor ID | Handler | AP | Secondary | Pattern | Core | Conditional | Preview source |
|---|---|---|---|---:|---|---|---|---|---|
| `aegis-runed-longsword` | Runed Longsword | `WARDENS_STRIKE` | `resolveAegisStrikeBasic` | 1 | — | SINGLE | Kinetic + Fracture | — | live plan |
| `aegis-rift-edge` | Veil Edge | `VEILSTEP_SLASH` | `resolveAegisStrikeBasic` | 1 | — | SINGLE | Kinetic; Occult rider | `TEMPO ARMED` | live plan + runtime |
| `aegis-claymore-blade` | Claymore Blade | `BREAKING_HEW` | `resolveAegisStrikeBasic` | 1 | Stamina | SINGLE | Heavy Fracture | `BREAK READY` | live plan |
| `hex-silver-core-sidearm` | Silver-Core Sidearm | `SILVER_VERDICT` | `resolveHexBasicShot` | 1 | Ammo | SINGLE | Ballistic | `PERFECT RELOAD` | live plan |
| `hex-void-cannon` | Nullbreach Shotgun | `BREACH_ROUND` | `resolveHexBasicShot` | 1 | Ammo | SINGLE | Breach / armor pressure | — | live plan |
| `hex-pulse-rifle` | Pulse Rifle | `CINDER_SWEEP` | `resolveHexBasicShot` | 1 | Ammo | SPREAD | Spread hits | `PRIMARY ONLY` / `N SPREAD TARGETS` | live plan |
| `envoy-null-conduit` | Null Conduit | `NULL_ARC` | `resolveEnvoySplinterBasic` | 1 | Flux | SINGLE | Occult | `CLEAN CYCLE` | live plan |
| `envoy-echo-lantern` | Echo Lantern | `BLACK_WICK` | `resolveEnvoySplinterBasic` | 1 | Flux | SINGLE | Rot setup | `DETONATION READY` | live plan |
| `envoy-sanguine-prism` | Sanguine Prism | `BLOOD_REFRACTION` | `resolveEnvoySplinterBasic` | 1 | Flux + HP | SINGLE | Sacrifice occult | `BRINK` / `FULL PAY` / `PARTIAL PAY` | live plan |

**Mechanics / numbers:** unchanged from Phase 3G. Nullbreach Shotgun is a display rename only.

**Phase 3G binding note:** Slot-0 cards previously rendered shared class labels (`STRIKE` / `SILVER_CORE_SIDEARM` / `VEIL_SPLINTER`) while mechanics already branched in `weaponBasicEngine`. Presentation and combat-log tags now resolve from equipped weapon. Executors still route through class-compat IDs via `toRuntimeClassBasicId` (save-compatible).

## 3. HUD defect repairs

- Enemy intel / turn order: `formatHostileDisplayName` — spaces, no underscores, no mid-word `FRACTU…` truncation.
- Combat log: `beginCombatRunLogSession()` on CombatScreen mount clears prior weapon/class init; weapon link uses equipped chassis + anchor name; grid/lock diagnostics gated to `__DEV__`.
- Encounter header: omit bare numeric / empty sector rows (fixes isolated `2` under DEPTH).
- First-slot cards: weapon-specific name + live effect line from anchor presentation.

## 4. Legacy-name audit

| String | Classification |
|---|---|
| `aegis-rift-edge`, `hex-void-cannon` | Stable permanent IDs — keep |
| `STRIKE` / `SILVER_CORE_SIDEARM` / `VEIL_SPLINTER` | Legacy class-compat inputs + executor keys — not player-facing labels |
| `WARDENS_CUT` / `RIFTSTEP_CUT` / `CLEAN_DISCHARGE` | Legacy alias inputs → canonicalize to new IDs |
| `Rift Edge` / `Nullbreach Carbine` / `WARDEN'S CUT` / `RIFTSTEP CUT` / `CLEAN DISCHARGE` | Listed only in `RETIRED_*` constants for audit guards |

No active player-facing surface should emit retired display names.

## 5. Save compatibility

- Weapon ownership / unlocks keyed by stable family IDs — unchanged.
- Loadouts may still store class-compat slot-0 IDs; labels resolve via equipped weapon.
- Legacy anchor aliases normalize before lookup.

## 6. Automated tests run

| Command | Result |
|---|---|
| `npx tsx src/data/weaponAnchorAttackPhase3L.test.ts` | OK |
| `npx tsx src/data/weaponPlayerFacingPhase3L.test.ts` | OK |
| `npx tsx src/data/weaponBasicEngine.test.ts` | OK |
| `npx tsx src/data/weaponPhase3Closeout.test.ts` | OK |
| `npx tsx src/data/weaponEnemyMatchupPhase3K.test.ts` | OK — 51 / 459 / 135 |
| `npx tsc --noEmit -p .` | **72** errors; delta **0** |

## 7. Visual matrix

**Status: `AWAITING INTERACTIVE CAPTURE`**

Capture at `1024×720` and `1920×1080` for all nine weapons:

- Anchor card at rest / selected / expanded
- Combat log after one basic execution
- Representative ready, conditional, unaffordable, disabled, missing-secondary, keyboard-focus

Do not mark PASS without interactive review.

## 8. Deferred — weapon-specific ultimates

> Each of the nine permanent weapons will eventually receive a unique weapon-specific ultimate. Names, mechanics, balance, progression, and migration will be designed in a later dedicated phase.

Do not implement ultimate names, IDs, meters, UI cards, or save fields now.

## 9. Remaining Phase 3M / 3O / 3P (unchanged)

- **3M:** feel / VFX / SFX  
- **3O:** broader string-field save scans  
- **3P:** Nullbreach favorable-share, Lantern strained band, Rival Merc density  

## 10. Defects before HUD re-review

None found in automated closeout. Proceed to interactive HUD matrix above.
