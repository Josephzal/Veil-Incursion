# Aegis Refactor Contract (Phase A–D)

Authoritative decisions for the Aegis weapon/class refactor. Supersedes conflicting lines in `current-game-systems-design.md` for Aegis loadout, brands, stamina, and naming.

## Locked structure

- **4 fixed weapon actions** — derived from `activeWeaponFamilyId` via registry. **Not persisted.**
- **3 selected shared techniques** — from a pool of 12. Persisted as `aegisTechniqueLoadout`.
- **Wraith Parry** — fixed class mechanic. Not persisted in the technique loadout.
- **1 weapon Ultimate** — derived from equipped weapon family. Not persisted in the technique loadout.

## Weapon families (preserve IDs)

| Family ID | Display name | Ultimate |
|-----------|--------------|----------|
| `aegis-runed-longsword` | **Runed Longsword** | ABYSSAL VERDICT |
| `aegis-rift-edge` | Paired Blades | REND THE VEIL |
| `aegis-claymore-blade` | Unmaker | GRAVEFALL |

## Fixed decisions

1. **Runed Longsword** is the canonical display name (not bare “Longsword”).
2. **Aegis has no Stamina** (global Stamina deletion lands in a later phase; techniques never require Stamina).
3. **Runic Brands and Abyssal Reserve are separate meters.**
4. **Ultimate commit never clears Brands.**
5. **Normal Perfect Parry does not grant a Brand.**
6. **Weapon-authored mastery conditions may reward a Brand through a Perfect Parry.**
7. **`BLOOD_TITHE` and `ABYSSAL_FAULT` are retired** — migration inputs only; not playable.
8. **`BLOOD_BOUND_CARAPACE` migrates to `RUNEBOUND_CARAPACE`** — no Blood-Bound combat executor/status/display.
9. **Weapon actions are derived, not persisted** on `PlayerAccount` or `ActiveIncursion`.
10. **All 12 techniques are available from the start** — no Aegis technique-unlock economy.
11. **Technique loadouts are frozen at descent** — Safehouse / run context must not mutate the snapshot.
12. **Native canonical-ID rule** — displayed technique ID, targeting, preview, telemetry, and executor are the same ID. No silent substitutes.
13. **Brands are generated only by authored weapon-mastery conditions.** Techniques, boons, graft copies, legacy STRIKE, Perfect Parry (non-mastery), and Ultimates do not generate Brands. Overflow is discarded.

## Technique pool (exactly 12)

### Brand techniques

| ID | AP | Brands | Other |
|----|----|--------|-------|
| `RUIN` | 2 | Spend ALL (min 1) | Full-grid Fracture `20+30×brands` then 12 Kinetic |
| `VEIL_PIERCER` | 1 | 1 | Occult pierce from **technique strike power**; +20% Reserve **on hit only** |
| `DEVASTATE` | 1 | 3 | Requires Fractured; Kinetic 4 then True = Fracture **threshold** (`fractureMax`, min 8); then clear Fractured |
| `FINAL_MERCY` | 1 | 2 | ≤25% HP; True = remaining HP (boss 36); kill heals 10% max HP |
| `DEMONS_LUNG` | 0 | 1 | +30% Reserve, Overcharged, +1 AP next turn; CD 3 |
| `CRIMSON_PACT` | 1 | 1 | 12% HP (floor 1); two guaranteed-crit charges |

### AP-only utilities

No Brand, Reserve, Stamina, or HP activation cost (unless an effect explicitly authors otherwise — none do for these six).

| ID | AP | Effect summary |
|----|----|----------------|
| `GRAVE_BIND` | 1 | Backline pull + EXPOSED |
| `NAIL_TO_GRID` | 1 | −1 enemy AP (2 w/ EVENT_HORIZON); DOOMED spread |
| `SHADOW_STEP` | 1 | 16 Kinetic, +50 Fracture, evade buff, initiative queue |
| `REAVE` | 2 | Column Kinetic from **technique strike power**; armor strip or Bleed 2; +12 Fracture |
| `ASHEN_MANTLE` | 2 | 50% DR through next enemy phase; attackers DOOMED; expires next player turn start |
| `RUNEBOUND_CARAPACE` | 1 | Reflect 12 True + 24 Fracture once after first blockable melee hit that damages |

Valid loadout: exactly three unique techniques, **at least one Brand technique**.

Default: `RUIN` / `GRAVE_BIND` / `RUNEBOUND_CARAPACE`.

## Atomic commitment / refund

Shared path: `aegisTechniqueCommitEngine` + hub technique cast.

1. **Validate** loadout membership, target/reach, AP, Brand cost, HP cost, cooldown, technique-specific gates — **before** spending.
2. **Commit** AP, Brands, and authored HP as one logical transaction (multi-target pays once).
3. Establish one `originActionId`; fire action-level hooks once.
4. **Pre-resolution reject** (target/state invalid before authored effects begin) → roll back AP, Brands, and HP.
5. **Miss / Evade after resolution begins** → costs retained.
6. Bonus / boon / graft copies cannot reproduce a Brand technique without a new legal commitment.

All twelve techniques are **non-STRIKE** and cannot deliver Riposte.

## Combat surface (Phase B+)

- **Weapon Actions:** 4 cards from `activeWeaponFamilyId`
- **Techniques:** 3 snapshotted canonical technique IDs
- **Wraith Parry** + weapon Ultimate remain outside that card strip

Compatibility remaps (`PLAYABLE_SUBSTITUTES`, `toPlayableCombatTechniqueId`, parallel `techniqueExecutorIds`) are **removed** as of Phase C.

## Phase B.1 — Doomfall interrupt + Rupture accuracy

- Doomfall Charge cancels through the hub control pipeline on **STUN**, **KNOCKDOWN**, **INTERRUPT_CHARGE**, or **DEATH**.
- Poise + Committed: reduce → Brand → cancel Doomfall → consume Poise.
- Rupture +15 accuracy is action-scoped `accuracyBonusPct`.

## Retired-ID policy

| ID | Status |
|----|--------|
| `BLOOD_TITHE` | Migration reject only — no catalog / executor / HUD |
| `ABYSSAL_FAULT` | Migration reject only — no catalog / executor / HUD |
| `BLOOD_BOUND_CARAPACE` | Migrates → `RUNEBOUND_CARAPACE`; no combat alias |
| `STRIKE` / `EVISCERATE` | Legacy migration / Ultimate catalog only — not technique loadout |

---

## Phase D — Graft surface (locked)

### Canonical graftable surface (4+3)

Exactly the snapshotted weapon family’s four actions plus the run’s three snapshotted techniques.

| Family | Weapon actions |
|--------|----------------|
| Runed Longsword | `WARDENS_STRIKE`, `RUPTURE`, `DREADBIND`, `NO_RESPITE` |
| Paired Blades | `PAIRED_BLADES_STRIKE`, `DIVERGENCE`, `ECLIPSE`, `SEVERANCE` |
| Unmaker | `UNMAKER_STRIKE`, `DREAD_HORIZON`, `UNBOWED`, `DOOMFALL` |

**Not graftable:** `WRAITH_PARRY`, `ABYSSAL_VERDICT`, `REND_THE_VEIL`, `GRAVEFALL`, class intrinsics/passives, legacy `STRIKE` / `EVISCERATE`, retired technique IDs. Shared rank-15 `allowUltimate` remains for Hex/Envoy; Aegis has no approved graftable Parry/Ultimate in Phase D.

### Discriminated graft-target identity

Stored keys are encoded, never bare ambiguous IDs:

- `WA:<AegisWeaponActionId>`
- `TECH:<AegisTechniqueId>`

Helpers: `encodeAegisGraftTargetKey` / `parseAegisGraftTargetKey` / `sanitizeAegisAbilityGraftMap`.

Stale / other-family / Parry / Ultimate / legacy keys are **dropped**, never redirected. Account loadout edits never repair an active run’s graft map.

### Family Strike fixed-basic rule

For Aegis only, the family’s Strike is the fixed basic (rank 7 `allowFixedBasic`):

- `WARDENS_STRIKE` / `PAIRED_BLADES_STRIKE` / `UNMAKER_STRIKE`

No generic Aegis `STRIKE` graft target. Blood-Mag remains Hex Shot-only.

### Capacity / rank gates (unchanged)

Rank 1–2: 0 · Rank 3: 1 · Rank 7: 2 + fixed-basic · Rank 12: 3 · Rank 15: 3 + `allowUltimate` · Rank 17: 4 · Rank 20: 4 + Apex. Cost tiers: STANDARD &lt;25, ADVANCED 25–44, APEX ≥45.

### AP-only utility cost-graft ban

`GRAVE_BIND`, `NAIL_TO_GRID`, `SHADOW_STEP`, `REAVE`, `ASHEN_MANTLE`, `RUNEBOUND_CARAPACE` reject:

`DENSITY_GRAFT`, `SANGUINE_GRAFT`, `NEUTRON_GRAFT`, `CONDUIT_GRAFT`.

`CONDUIT_GRAFT` also rejects `RUIN`.

### Echo / Splinter (weapon-action only)

`ECHO_GRAFT` / `SPLINTER_GRAFT` may target only compatible direct-damage weapon actions. Wired through `aegisWeaponActionGraftEngine` + executor. Graft-added hits cannot generate Brands, satisfy mastery, consume Crimson Pact, deliver Riposte, or duplicate action-level hooks.

**Echo semantics:** one full authored primary hit plus one graft-added hit at 50% of that primary (150% combined before mitigation). Not “two hits at 50%”. No recursive Echo.

**Splinter semantics:** three transformed hits, each using the authored ×0.8 multiplier exactly once (project rounding once per hit).

**ECLIPSE / UNBOWED:** setup/stance actions. They author incidental Kinetic (10) but are not on the direct-damage Echo/Splinter set — incidental damage does not qualify an action for hit-replacement grafts.

### Phase E.1a — Weapon-action graft damage ownership

- `applyGraftTransformToWeaponPlan` is the **sole owner** of `damageMultiplier` (and Conduit occult flat) for Aegis weapon-action hits.
- `TacticalCombatHub` marks WA deliveries with `graftDamagePreScaled` and must not re-apply `damageMultiplier` / occult flat via `scaleGraftDamage`.
- Hub may still apply Neutron reserve-add on pre-scaled WA hits; techniques keep the full atomic `scaleGraftDamage` path.
- **E.1e.1 Neutron:** Reserve is flushed once on successful commitment; `floor(committedReserve × 0.8)` resolves **at most once per `playerActionId`**. Multi-packet / multi-target / staged `hurtEnemy` delivery cannot reuse the same Reserve snapshot. Cancel and failed validation spend no Reserve and do not consume the once guard.
- **E.1e.1 Apex (WA):** Boss ×2 is applied once at the WA delivery-ownership layer per packet against bosses (aggregate exactly 2× ungrafted). Pre-scaled packets must not receive a second Apex multiply in `scaleGraftDamage`. Techniques that are not pre-scaled keep Apex inside `scaleGraftDamage`. Non-boss targets unchanged.
- **Doomfall:** transform + snapshot graft cast plan on Charge commitment; Release reuses the snapshotted plan without recommitting or re-transforming costs; interrupted Charge clears the staged plan.
- **Divergence:** one authored action, one graft commitment/transform; both blades use the transformed plan; dual-target resolution does not duplicate graft costs or action-level hooks.
- **Fractured damage:** there is **no** global Fractured ×1.25 weapon-action damage modifier. `NO_RESPITE` payoff remains AP refund + Reserve only. Simulator and live agree.
- **VEIL_PIERCER crit:** runtime source of truth is `COMBAT_CHANCE.VEIL_PIERCER_CRIT_BONUS` (10%); catalog/tooltip mirror that value.

### Atomic graft costs

Graft Brand / Reserve / HP taxes join the same commitment transaction as base AP (techniques via existing hub path; weapon actions via pre-commit in `executeAegisWeaponAction`). Cancel-before-commit spends nothing; pre-resolution reject rolls back; miss/evade after commit retains costs. Density / Sanguine / Neutron / Conduit formulas unchanged where eligible.

### Phase E.1e.1 — Structural graft/boon containment (closed)

Structural correctness only — **not** an Agency Deliberate numeric retune. No Density / Resonance / Overflow / WA / technique / ultimate number changes.

- **Neutron:** flush committed Reserve once; apply Reserve-derived damage addition once per `playerActionId`.
- **Apex:** WA boss scaling once at delivery ownership; no second apply on pre-scaled packets.
- **Masochist's Joy (`MASOCISTS_JOY`):** apply authored ×1.5 on the next eligible damage resolution, then clear pending buff (consume once). Not Envoy `MASOCHISTIC_CHANNEL`.
- **Sanguine:** remains 0 AP with current 10% max-HP tax; **one successful activation per player turn**. Cancel / failed validation / insufficient HP do not consume the turn use. Rollback restores availability. Encounter teardown clears guard state.
- Density and Resonance numeric ceilings remain approval-gated. No completed Phase E action/technique/ultimate conclusion is reopened. Future numeric graft/boon containment requires separately approved bands.

### Grid-Hacker encounter cap

Aegis `GRID_HACKER_GRAFT` AP refund: **once per encounter** (`gridHackerApRefunds` on `GraftEncounterSafetyState`). Multi-kill / multi-hit actions earn at most one refund. Resets with encounter-start safety state.

### Martyr two-hit state

`MARTYR_GRAFT` uses `juggernautShieldHits` counter (2 charges), not a one-hit boolean. Phase D.2 tracks provenance in `hitAbsorbProtectionSource` (`MARTYR_GRAFT` | `JUGGERNAUT_PLATING` | null) so combat log and status chips use the correct name/charge count. Consumption follows existing eligible-hit rules; HUD/runtime agree.

### Sanctuary / run-scoped lifecycle

- Assignments are Sanctuary-only, run-scoped, persist encounter-to-encounter, clear at deployment end.
- New deployments start with empty graft maps.
- `sanctuaryGraftOffers` clears on terminal cancel and Sanctuary node exit (`clearSanctuaryGraftSession`).
- Live UI: `ClassGraftUI` over the 4+3 snapshotted surface. `VeilGraftUI` is quarantined dead code.

### Persistence boundary

Assignments ride every supported `ActiveIncursion` copy/hydration path as encoded string keys. **There is no general disk-persisted ActiveIncursion resume** — grafts survive in-memory between encounters within a session, but an app restart does not restore an active run. Do not invent graft-only disk storage.

### Legacy assignment rejection

Dropped (not redirected): `STRIKE`, `EVISCERATE`, `THREEFOLD_BRAND`, Parry, Ultimates, retired techniques, other-family weapon actions, unknown IDs.

`ABYSSAL_VERDICT` remains classified as Ultimate for socket/display purposes even though it is ungraftable.

### Phase E boundary

**E.1a (closed — correctness):** single-owner WA graft damage transform; Echo/Splinter presentation; Fractured/VEIL_PIERCER/ECLIPSE–UNBOWED alignment. No numeric rebalance.

**E.1b (closed — Unmaker Tier III + presentation):**

- Aegis has **no Stamina** on the canonical combat surface.
- Unmaker Tier III grants **+1 Abyssal Reserve** when an authored Unmaker weapon action causes a **Fracture break**, at most **once per committed action** (`FRACTURE_BREAK_RESERVE`).
- Graft-added Echo/Splinter hits cannot grant the reward. Doomfall Charge cannot; Release may once if it causes the break; interrupted Charge grants nothing.
- `strikeDamagePct` / `strikeStaminaCostPct` remain dormant registry fields for migration/legacy basics and **do not** scale canonical Aegis weapon-action kinetic damage. Player-facing Aegis tier lines must not claim otherwise.
- Missing authored TTK/DPA target bands still **block** baseline weapon-action damage retuning.

**E.1c (closed — analysis Gate C):** techniques fit Agency Deliberate without numeric retune; DEVASTATE live gauge read identified as correctness defect.

**E.1c.1 (closed — technique correctness):**

- **Fracture invariants:** `applyFracturedState` zeros `fractureGauge`; Fracture cannot rebuild while Fractured. Do not change these rules for cashouts.
- **DEVASTATE True cashout** uses the target’s stable Fracture **threshold** (`fractureMax`, default 100): `True = max(8, fractureMax)`. Live gauge is never the cashout source. Kinetic 4 / 1 AP / 3 Brands unchanged. Preview helpers: `devastateDamagePreview` / `devastateTrueDamage`.
- **Technique vs WA scaling:** `aegisTechniquePowerPct` (resolved to `aegisTechniqueStrikePower`) owns VEIL_PIERCER (`max(8,⌊power×0.85⌋)` Occult pierce) and REAVE (`max(14,⌊power×1.15⌋)` Kinetic). Canonical WA kinetic ignores both `strikeDamagePct` and technique power. Migration fallback: missing `aegisTechniquePowerPct` → `strikeDamagePct`. Hex/Envoy unchanged. No player-facing “Strike Damage” line for Aegis WA.
- This pass restores authored contracts; it is **not** an Agency Deliberate numeric retune of healthy techniques.

**E.1d (closed — analysis Gate C):** no Aegis ultimate numeric retune justified. Working ultimate-impact guardrails proposed only — **not approved** authority for damage changes.

**E.1d.1 (closed — ultimate correctness / presentation):**

- **ABYSSAL VERDICT aftermath:** successful commits finalize action-level aftermath **exactly once** on lethal, nonlethal, overkill, and final-enemy resolution. Reserve flush is **not** conditional on target survival. Survivor-only strip uses the post-damage living-target set (dead primary excluded; empty set is a safe no-op). Brands remain preserved. Cancel / failed pre-commit validation spend nothing.
- **Grade path:** FULL targeting confirmation does **not** itself award PERFECT. Grade comes from the authoritative grade/input engine (slice hitCount 1/2/3 → STANDARD/CLEAN/PERFECT, or simplified → STANDARD), staged through targeting, then committed. Matrix unchanged: **11 / 23 / 35** True. Preview agrees with execution.
- **Ultimate vs technique vs WA scaling:** `aegisUltimatePowerPct` → `aegisUltimateStrikePower` owns **REND_THE_VEIL** / **GRAVEFALL** bases. Migration fallback: missing ultimate field → `strikeDamagePct`. Does not read technique power. Canonical WA kinetic and VEIL_PIERCER / REAVE (technique power) remain separate. ABYSSAL_VERDICT stays on the fixed True matrix. Hex/Envoy unchanged. Numeric matrices for Rend/Gravefall preserved (not a retune).
- **Ungraftable:** all three Aegis ultimates remain ungraftable even with `allowUltimate: true`. WU-5 asserts Phase D. Rank-15 socket milestone does not authorize Aegis ultimate grafts.
- This pass restores correctness and presentation; it is **not** an Agency Deliberate ultimate numeric retune. Proposed E.1d ultimate-impact guardrails remain unapproved.

**E.1e (closed — analysis Gate C):** read-only containment audit; four structural defects attributed (Neutron multi-packet reuse, Apex pre-scaled reapply risk, Masochist clear-before-apply, Sanguine unbounded same-turn). Working numeric guardrails proposed only — **not approved**.

**E.1e.1 (closed — structural containment):** Neutron once-per-`playerActionId`; Apex WA delivery ownership without pre-scaled reapply; Masochist apply-then-clear; Sanguine once-per-player-turn. No Density / Resonance / Overflow numeric change.

**Still deferred (post E.1e.1):**

- Density / Resonance numeric ceilings (require separately approved bands)
- Broader boon / weapon-tier rebalancing
- Global Stamina field deletion (non-Aegis / residual UI)
- Broad graft number rebalance / Aegis baseline WA retune
- Hex Shot / Envoy behavior changes
