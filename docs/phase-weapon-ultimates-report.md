# Weapon Ultimates — Phase Report

## Phase plan

| Phase | Scope | Status |
|-------|-------|--------|
| **WU-1** Foundation | Display renames, Envoy starter → Vambrace, `GRAVEWEAVE`, weapon portraits, ultimate registry skeleton | **COMPLETE** |
| **WU-2** Rebind | Longsword←Eviscerate, Carbine←Zero Protocol, Scythe←Cataclysm | **COMPLETE** |
| **WU-3** Shared host | Grades (STANDARD/CLEAN/PERFECT), cancel free, input adapter, simplified inputs | **COMPLETE** |
| **WU-4** Six new | Rend the Veil, Gravefall, Sixth Seal, Last Knock, Funeral Knot, Crimson Refraction | **COMPLETE** |
| **WU-5** Surfaces | HUD / log / telemetry / boon+graft compatibility | **COMPLETE** |
| **WU-6** Closeout | Tests, design audit, retired-name sweep, validation handoff | **COMPLETE** |

Stop between phases unless the user says continue.

---

## WU-6 — Closeout (complete)

### Validation

- `weaponUltimateValidationEngine.ts` — registry integrity, ownership gates, staged scripts, Envoy starter → Funeral Knot, retired-name catalog audit
- Wired into `validateWeaponRegistry()` / DevTest **VALIDATE WEAPONS**
- Report helper: `formatWeaponUltimateValidationReport`

### Retired player-facing strings (must not emit live)

`EVISCERATE` (as label), `CATACLYSM SIGIL`, `Cataclysm Sigil`, `ZERO-PROTOCOL`, `The Black Door`

Internal ability IDs (`EVISCERATE` / `ZERO_PROTOCOL` / `CATACLYSM_SIGIL`) remain for hooks.

### Live copy fixes

- Reject log: Null Circuit (not Cataclysm Sigil)
- Legacy Hex executor path: `[ZERO PROTOCOL]` (not `ZERO-PROTOCOL`)

### Tests

- `src/data/weaponUltimatePhase6.test.ts`
- Full suite WU-1 → WU-6 green

### Handoff

Nine weapon ultimates are WIRED end-to-end: foundation → rebind → host → six new → surfaces → validation. Out of scope remains final VFX/SFX/feel art pass and global numerical rebalance.

---

## WU-5 — Surfaces + compatibility (complete)

### Player-facing

| Surface | Behavior |
|---------|----------|
| AR gauge | Ready tag = equipped ultimate display name (not hardcoded THREEFOLD BRAND) |
| Protocol / magazine gauge | Ready label = equipped Hex ultimate (SIXTH SEAL / ZERO PROTOCOL / LAST KNOCK) |
| Veil Rot gauge | Ready suffix = equipped Envoy ultimate |
| Combat callouts | `{ULTIMATE} READY` from registry |
| Logs | Continue using `formatWeaponUltimateLogTag` |

### Compatibility

- Damage/kills from weapon ultimates set `lastPlayerAbilityRef` + `abilityId` to legacy hook tokens (`EVISCERATE` / `ZERO_PROTOCOL` / `CATACLYSM_SIGIL`) so ULTIMATE-tagged boons still match.
- `resolveWeaponUltimateActionTags` maps weapon ultimate IDs → legacy ultimate tags.
- Graft socket / `canGraftClassAbility` treat all nine ultimate IDs as ULTIMATE sockets.

### Key files

- `weaponUltimateSurfaceEngine.ts`
- `CombatOperativeHud.tsx`, `CombatMagazineGauge.tsx`, `CombatVeilRotGauge.tsx`
- `combatTelemetryFormat.ts` (`ultimateReadyLabel`)
- `classBoonEngine.ts`, `classGraftEngine.ts`, `graftCapacityEngine.ts`
- `TacticalCombatHub.tsx` — telemetry + hook ability on WU-4 commits

### Tests

- `src/data/weaponUltimatePhase5.test.ts`

---

## WU-4 — Six new ultimates (complete)

### Charge (unchanged class meters)

| Class | Gate |
|-------|------|
| Aegis | 100% Abyssal Reserve |
| Hex | Protocol Charges (3) |
| Envoy | Veil Rot gate (`CATACLYSM_ROT_GATE`) |

### Ultimates

| Weapon | Ultimate | Interaction | Resolve notes |
|--------|----------|-------------|----------------|
| Paired Blades | REND THE VEIL | Dual hold traces + rupture | 2 kinetic + Occult; Tempo cashout only if armed |
| Unmaker | GRAVEFALL | Raise / strain / slam | Heavy hit; cash existing Fracture; CLEAN armor/Fracture; PERFECT narrow shockwave |
| Silver-Core Sidearm | SIXTH SEAL | Align / seat / close | Protocol spend → ultimate-owned refill (no ordinary reload rewards) → precision shots → empty mag |
| Nullbreach | LAST KNOCK | Pump / rings / slam | Needs ≥1 round (`RELOAD REQUIRED`); commit all ammo; never log "The Black Door" |
| Vambrace | FUNERAL KNOT | Wind / tighten / tear | All living; baseline Occult + lantern Rot detonation; Rot gate purge on commit |
| Heart's Due | CRIMSON REFRACTION | Align / offer / commit | HP offer on commit only; brink ≤25% Flux; full-pay ×1.15 |

### Shared host

- `WeaponUltimateStagedSkillOverlay` — art-independent 3-stage hold (~2.8s)
- Grades from stage scores (~10%/20% performance mult)
- Cancel free via `WeaponUltimateHostChrome`
- Open free; spend AR / Protocol / Rot only on commit

### Key files

- `weaponUltimateNewResolveEngine.ts` — pure plans
- `weaponUltimateStagedScripts.ts` — stage copy
- `WeaponUltimateStagedSkillOverlay.tsx`
- `weaponUltimateRegistry.ts` — six → `WIRED`; `canFireWeaponUltimate`
- `TacticalCombatHub.tsx` — ready flags, ping routing, commit paths

### Tests

- `src/data/weaponUltimatePhase4.test.ts`

### Out of scope (WU-4)

- Final VFX / SFX / character animation
- HUD label surface polish (WU-5)
- Global rebalance

---

## WU-3 — Shared host (complete)

### Contracts

- Grades: `STANDARD` / `CLEAN` / `PERFECT` (`weaponUltimateGradeEngine.ts`)
- Input modes: `FULL` | `SIMPLIFIED` (`weaponUltimateInputAdapter.ts`)
- Account flag: `PlayerAccount.simplifiedUltimateInputs` (DevTest toggle)
- Host chrome: `WeaponUltimateHostChrome` — free Cancel over modal ultimates + Threefold Brand slice

### Policy

| Rule | Behavior |
|------|----------|
| Open | Free — no spend |
| Cancel | Free — Protocol / Rot / Abyssal retained |
| Commit | Atomic spend only on resolve |
| Imperfect | Floors at STANDARD (no 0-damage Threefold; no Null Circuit backlash) |
| Simplified | Skip minigame → STANDARD only |

### Grade maps (FULL)

| Ultimate | STANDARD | CLEAN | PERFECT |
|----------|----------|-------|---------|
| Zero Protocol | <5 taps | ≥5 | ≥10 |
| Null Circuit | 0–1 nodes (0→1 floor) | 2 | 3 |
| Threefold Brand | 0–1 hits (0→1 floor) | 2 | 3 |

### Tests

- `src/data/weaponUltimatePhase3.test.ts`

---

## WU-2 — Rebind (complete)

### Ownership

| Weapon | Ultimate | Legacy ability ID | Fire gate |
|--------|----------|-------------------|-----------|
| Longsword | THREEFOLD BRAND | `EVISCERATE` | `canFireLegacyClassUltimate('EVISCERATE', family)` |
| Ash Shotgun | ZERO PROTOCOL | `ZERO_PROTOCOL` | `canFireLegacyClassUltimate('ZERO_PROTOCOL', family)` |
| Scythe | NULL CIRCUIT | `CATACLYSM_SIGIL` | `canFireLegacyClassUltimate('CATACLYSM_SIGIL', family)` |

### Sibling behavior

- Aegis AR / Hex Protocol / Envoy Veil Rot gauges **remain** for all weapons in class.
- Ultimate ping + ready tags + overlays **only** for the owning weapon.
- Internal ability IDs unchanged for boon/graft hooks (WU-5 rename surfaces).

### Key edit sites

- `weaponUltimateRegistry.ts` — status `WIRED` + `canFireLegacyClassUltimate`
- `TacticalCombatHub.tsx` — ready flags, publishSquadUi, onSlice / finishZeroProtocol / handleCataclysmResolve, log tags
- Overlays + ability catalog labels + AR ready tag (`THREEFOLD BRAND`)

### Tests

- `src/data/weaponUltimatePhase2.test.ts`
- Updated `weaponUltimatePhase1.test.ts` for WIRED statuses

---

## WU-1 — Foundation (complete)

### Display names (IDs stable)

| Permanent ID | Display name |
|--------------|--------------|
| `aegis-runed-longsword` | Longsword |
| `aegis-rift-edge` | Paired Blades |
| `aegis-claymore-blade` | Unmaker |
| `hex-silver-core-sidearm` | Silver-Core Sidearm (legacy alias: Revolver) |
| `hex-pulse-rifle` | Ash Shotgun (legacy alias: Carbine) |
| `hex-void-cannon` | Nullbreach (legacy alias: Black Door) |
| `envoy-echo-lantern` | Vambrace |
| `envoy-null-conduit` | Scythe |
| `envoy-sanguine-prism` | Heart's Due |

### Envoy starter migration

- `STARTER_WEAPON_BY_CLASS.ENVOY` → `envoy-echo-lantern` (Vambrace).
- Scythe unlock costs = former Lantern costs; Vambrace `startingUnlocked: true`, empty unlock.
- `normalizeWeaponProgression` grants Vambrace unlock; preserves Scythe ownership and equipped selection (no mid-save force-equip).

### Anchor

- Vambrace: `GRAVEWEAVE` (replaces live `BLACK_WICK`; `BLACK_WICK` remains a legacy alias only).

### Ultimate registry (`weaponUltimateRegistry.ts`)

Nine ultimates registered with status `REGISTERED` only — **no interaction overlays wired in WU-1**.

### Portraits

`combatPlayerPortrait.ts` resolves idle/attack from equipped `WeaponFamilyId` using existing on-disk PNGs (`aegis_paired_*`, `aegis_greatsword_*`, `hex_carbine_*`, `hex_shotgun_*`, `envoy_vambrace_*`, `envoy_scythe_*`, `envoy_heart_*`). Wired through CombatScreen → Arena → PlayerEntity → Viewport → AttackSprite.

### Tests

- `src/data/weaponUltimatePhase1.test.ts`
- Updated `weaponAnchorAttackPhase3L.test.ts`, `weaponPlayerFacingPhase3L.test.ts`

### Out of scope (WU-1)

- Rebinding / new ultimate interactions
- Final VFX / SFX / character animation beyond PNG wiring
- Global rebalance
- Phase “feel” art pass
