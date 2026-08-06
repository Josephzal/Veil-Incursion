# Envoy Weapon-Kit Contract (Phase E.2)

**Status:** Implementation contract — **E.5 functional cutover complete**; **E.5V visual closeout OPEN (Gate D)**.  
**Authority date:** 2026-08-06 (E.5V partial Hub evidence + flex-strip layout repair)  
**Live combat surface:** `buildEnvoyCombatSurface` → 4 WA + 3 flex; Rift Ward + Ultimate outside strip.  
**Persisted loadout:** `EnvoyLoadout` = `EnvoyFlexLoadout` = `[flex1, flex2, flex3]` via `sanitizeEnvoyCombatLoadout` / `sanitizeEnvoyFlexLoadout`.  
**E.3 owners:** `envoyWeaponActionRegistry.ts`, `envoyWeaponActionCatalog.ts`, `envoyFlexLoadoutEngine.ts`, `envoyCombatCompatibility.ts`, `envoyActionAliases.ts`.  
**E.4 owners:** `envoyWeaponActionPlanEngine.ts`, `envoyWeaponActionExecutor.ts`, `envoyWeaponActionPreviewEngine.ts`, `envoyCatalystCastEngine.ts` (`resolveEnvoyCatalystCast`), `envoySanguineExposureEngine.ts`.  
**E.5 owners:** Hub/Sanctuary/DeckWorkspace mount + `envoyWeaponKitPhaseE5Engine.ts`.  
**E.5V evidence:** `docs/envoy-weapon-kit-e5v-visual-review.md`. Canonical live GDD: `docs/current-game-systems-design.md`.

---

## 1. Phase scope and authority

### In scope (E.2)

1. Prerequisite unlock-path audit repair (`SLOT_BY_ID` Envoy slots aligned to WU-1 starter).
2. Canonical, implementation-ready contract for twelve Envoy weapon actions and the future 4+3 surface.

### Out of scope (deferred)

- Runtime 4+3 surface, registries, executors, flex schema migration.
- Catalyst centralization code move.
- Combat / Sanctuary / DeckWorkspace UI changes.
- GDD live-surface reconciliation (`current-game-systems-design.md`).
- Balance retunes of flexes, Rift Ward, Ultimates, boons, grafts, Flux/Rot/Catalyst/Brink/sacrifice constants.

### Authority order

1. This contract (future Envoy weapon-kit).
2. Live runtime source (current behavior for anchors, resources, flexes).
3. `docs/current-game-systems-design.md` (post-W.5).
4. Exported GDD (identity only; ignore stale Hex/Chamber/deck claims).

---

## 2. Locked product decisions

1. Future strip = **4 family-derived weapon actions + 3 persisted flex abilities**.
2. All **eleven** currently assignable non-anchor abilities remain in the selectable flex pool.
3. Exactly **three** flex IDs are persisted and snapshotted at descent.
4. Do **not** permanently select only three of the eleven; the pool stays eleven.
5. **Rift Ward** remains a fixed class mechanic **outside** the seven-card strip.
6. Equipped weapon **Ultimate** remains **outside** the seven-card strip.
7. Historical anchors seed family action 1: `GRAVEWEAVE` / `NULL_ARC` / `BLOOD_REFRACTION`.
8. Action-1 essential behavior and authored values are preserved unless live contradiction is proven.
9. `VEIL_SPLINTER` is compatibility-only → canonicalizes to equipped family’s action 1.
10. `BLACK_WICK` remains compatibility alias for `GRAVEWEAVE` only where required.
11. `CATACLYSM_SIGIL` remains Scythe Ultimate compatibility for `NULL_CIRCUIT`; never a card or flex.
12. `CLEAN_CYCLE` remains **Scythe-specific**; not a global Envoy stance.
13. Weapon and flex selections snapshotted at descent; no mid-run weapon/loadout switching.
14. Live display names: **Vambrace**, **Scythe**, **Heart’s Due**.
15. Retired codenames (Echo Lantern, Null Conduit, Sanguine Prism, …) may remain only in permanent IDs, migrations, compatibility, or historical telemetry.
16. Do not copy Aegis or Hex class mechanics into Envoy.

---

## 3. Final 4+3 surface

| Surface | Count | Persistence |
|---------|------:|-------------|
| Equipped-family weapon actions | 4 | Derived; never persisted as flexes |
| Selected flex abilities | 3 | Persisted + snapshotted (`EnvoyFlexLoadout`) |
| Rift Ward | 1 | Fixed class mechanic outside strip |
| Weapon Ultimate | 1 | Equipped-family authority outside strip |

**Derivation:** `equipped Envoy family → four canonical weapon actions (order 1–4) → same three persisted flexes (order preserved)`.

**Forbidden future paths:**

- Persisted weapon-action IDs or family anchors as flexes.
- Duplicate historical basic cards alongside action 1.
- Persisted Rift Ward or Ultimate in flex slots.
- A second competing Envoy loadout schema beside the eventual three-flex schema.
- Temporary incomplete-family fallback (`kitComplete` must be total per family).

---

## 4. Twelve-action registry

| Order | Family | Permanent ID | Display name |
|------:|--------|--------------|--------------|
| 1 | Vambrace (`envoy-echo-lantern`) | `GRAVEWEAVE` | Graveweave |
| 2 | Vambrace | `GRAVE_TRANSFER` | Grave Transfer |
| 3 | Vambrace | `VEIL_BRAND` | Veil Brand |
| 4 | Vambrace | `ROT_KNELL` | Rot Knell |
| 1 | Scythe (`envoy-null-conduit`) | `NULL_ARC` | Null Arc |
| 2 | Scythe | `SILENT_EDGE` | Silent Edge |
| 3 | Scythe | `VEIN_CUT` | Vein Cut |
| 4 | Scythe | `SMOKE_ARC` | Smoke Arc |
| 1 | Heart’s Due (`envoy-sanguine-prism`) | `BLOOD_REFRACTION` | Blood Refraction |
| 2 | Heart’s Due | `EXPOSE_VEIN` | Expose Vein |
| 3 | Heart’s Due | `CRIMSON_VENT` | Crimson Vent |
| 4 | Heart’s Due | `HEART_CLAIM` | Heart Claim |

**Ultimates (outside strip):** `FUNERAL_KNOT` / `NULL_CIRCUIT` / `CRIMSON_REFRACTION`.

---

## 5. Per-action contracts

Shared defaults (unless an action overrides):

- **Damage type:** Occult (channel `OCCULT`) unless noted.
- **Accuracy:** standard occult accuracy; **+0** authored modifier unless noted.
- **Crit:** one crit eligibility check **per authored damage packet** (live Hub `hurtEnemy` default); Rot infect / transfer / consume is **not** a separate hit check.
- **Family scaling owner:** `ResolvedWeaponState.statModifiers` (`occultDamagePct`, `veilFluxGainPct`, `debuffDurationPct`, sacrifice resource bonuses) via existing weapon tier path — same owner as today’s basics.
- **Ultimate readiness:** no new WA charge meter. Rot applied by WAs contributes to existing board Rot totals used by Envoy ultimate readiness (`CATACLYSM_ROT_GATE` / Hub `cataclysmReady` path). Staged Ultimates keep their own interaction gates.
- **Cancellation / invalid target:** mutate nothing (no AP/Flux/Stamina/HP/Rot/Catalyst commit).
- **Miss after commit:** costs retained; Catalyst primes only if the action’s prime rule says “on cast commit” (see §10) — Envoy WAs use **on successful cast commit after validation**, not on miss-after-swing for setup actions that still resolve (match flex pattern: prime after execute today).
- **Boon tags / graft tags:** listed per action; graftable surface = four WA + three flexes (Rift Ward / Ultimates not graftable).
- **Provenance / action ID:** permanent WA ID (not `VEIL_SPLINTER`) once E.4 lands; compatibility ingress may still accept `VEIL_SPLINTER` → action 1.
- **Derivative rule:** Rot tick, Catalytic Release, Catalyst payoff, and sacrifice HP mutation must **not** re-fire the originating WA’s full hook chain.

### 5.1 Vambrace — `GRAVEWEAVE` (order 1) — **LOCKED LIVE**

| Field | Contract |
|-------|----------|
| Purpose | Rot setup brand; low raw damage; delayed detonation economy |
| AP | **1** |
| Stamina | **6** (has cost) |
| Flux | cost **5**; no floor override; no gain |
| HP | none |
| Targeting | `SINGLE` |
| Damage | Occult base **10** catalog before family plan; live plan `max(4, floor(scalePct(base, occultDamagePct) * 0.7))` |
| Ward / Armor | strip **1** Occult Ward (anchor `WARD_BREAK`); no Kinetic Armor interact |
| Veil Rot | apply **2** stacks once per action (`infectVeilRot`) |
| Catalyst | primes **NULL** |
| Curse/status | none authored; `invokeDebuffHook` true for weapon debuff hooks |
| Brink / Sacrifice | none |
| CLEAN_CYCLE | no |
| Scopes | damage + ward + rot + catalyst: **once per action** (single target) |
| Conditional state | none |
| Preview | show reduced occult, Flux 5, Rot +2, ward strip 1; mark setup (not detonation) |
| Combat log (future presentation) | `[VAMBRACE] >> Graveweave — extra Veil Rot for later detonation.` (retire `[ECHO LANTERN]`) |
| Tooltip | Low occult brand. Applies 2 Veil Rot. Strips 1 Occult Ward. Primes NULL. |
| Non-interactions | Does not detonate Rot; does not CLEAN_CYCLE; not highest burst |

### 5.2 Vambrace — `GRAVE_TRANSFER` (order 2) — **NEW**

| Field | Contract |
|-------|----------|
| Purpose | Move Rot off fragile / dying pressure targets onto a living secondary — multi-enemy continuity |
| AP | **1** |
| Stamina | **8** |
| Flux | cost **10** |
| HP | none |
| Targeting | `DUAL` — primary = **source** (must have ≥1 Rot), secondary = **destination** (alive, distinct). Legal only if both valid. |
| Damage | Occult **6** to destination only (base before `occultDamagePct`) |
| Ward / Armor | none |
| Veil Rot | **Transfer** up to **2** stacks from source → destination (destination capped at `VEIL_ROT_STACK_CAP` 4). Source loses transferred amount via `consumeVeilRotStacks`. No net new stacks beyond overflow discard at cap. |
| Catalyst | primes **ECHO** |
| Curse/status | none |
| Brink / Sacrifice | none |
| Scopes | transfer + damage + prime: **once per action** |
| Family state | none |
| Preview | show movable stack count, destination post-cap stacks, Flux 10, occult 6 |
| Log | `[VAMBRACE] >> Grave Transfer — Rot relocated.` |
| Tooltip | Move up to 2 Veil Rot from one enemy to another. Light occult on the destination. Primes ECHO. |
| Non-interactions | Not a generic Rot applicator (requires existing stacks on source); does not detonate; does not use Catalytic Console |
| Economy role | Spends Flux to preserve cashout when the branded target will die; enables Silencing Echo after Graveweave (NULL→ECHO) |

### 5.3 Vambrace — `VEIL_BRAND` (order 3) — **NEW**

| Field | Contract |
|-------|----------|
| Purpose | Curse pressure + light Rot without making every card a Rot sprayer |
| AP | **1** |
| Stamina | **8** |
| Flux | cost **12** |
| HP | none |
| Targeting | `SINGLE` |
| Damage | Occult **5** |
| Ward / Armor | none |
| Veil Rot | apply **1** stack |
| Catalyst | primes **ECHO** |
| Curse/status | target **−1 AP next turn** (same family of effect as `ENTROPY_HEX`; independent ability — not a call into the flex executor) |
| Brink / Sacrifice | none |
| Scopes | once per action |
| Preview | occult 5, Rot +1, AP drain, Flux 12 |
| Log | `[VAMBRACE] >> Veil Brand — curse latched.` |
| Tooltip | Brand the target: 5 occult, 1 Veil Rot, −1 AP next turn. Primes ECHO. |
| Non-interactions | Not interchangeable with `ENTROPY_HEX` flex (flex remains independently selectable); no detonation |
| Economy role | Tempo curse between setup and knell; cheaper Rot than bloom flexes |

### 5.4 Vambrace — `ROT_KNELL` (order 4) — **NEW**

| Field | Contract |
|-------|----------|
| Purpose | Controlled early cashout — spend stacks for damage without board-wide Catalytic / Ultimate |
| AP | **1** |
| Stamina | **10** |
| Flux | cost **15** |
| HP | none |
| Targeting | `SINGLE` (must have ≥1 Rot or cast rejects) |
| Damage | Occult **8 × stacksConsumed** where `stacksConsumed = min(2, currentStacks)` — uses live `LANTERN_FLUX_PURGE_DAMAGE_PER_EXTRA_ROT = 8` constant **by reference**, not a retune |
| Ward / Armor | none |
| Veil Rot | **consume** `stacksConsumed` via `consumeVeilRotStacks` **once per action**; remaining stacks stay |
| Catalyst | primes **ASH** (does not bypass sequence; sets up ASH→NULL with later Graveweave) |
| Curse/status | none |
| Brink / Sacrifice | none |
| Scopes | consume + damage packet: **once per action** (not per stack as separate hooks) |
| Preview | show stacks that will be consumed vs remaining; damage as **conditional on current stacks** (never promise max if stacks &lt; 2) |
| Log | `[VAMBRACE] >> Rot Knell — partial detonation.` |
| Tooltip | Consume up to 2 Veil Rot on the target for 8 occult per stack consumed. Primes ASH. |
| Non-interactions | Not Catalytic Release; not `FUNERAL_KNOT`; does not purge all board Rot; does not recursively re-infect |
| Economy role | Answers fragile-target pressure with a bounded cashout while leaving board Rot for Ultimate / Catalytic |

---

### 5.5 Scythe — `NULL_ARC` (order 1) — **LOCKED LIVE**

| Field | Contract |
|-------|----------|
| Purpose | Efficient Flux cycle basic; CLEAN_CYCLE specialist entry |
| AP | **1** |
| Stamina | **6** |
| Flux | cost `max(3, catalogFluxCost − 1)` with catalog **5** → **4**; optional `veilFluxGainPct` efficiency bonus; CLEAN_CYCLE adds **+4** Flux (`CONDUIT_CLEAN_CYCLE_FLUX_BONUS`) |
| HP | none |
| Targeting | `SINGLE` |
| Damage | Occult catalog **10** × `occultDamagePct`; if CLEAN_CYCLE → × **1.12** (`CONDUIT_CLEAN_CYCLE_DAMAGE_MULT`) |
| Ward / Armor | strip **1** Occult Ward |
| Veil Rot | apply **1** |
| Catalyst | primes **NULL**; **reads** `previousCatalyst` / live `currentCatalyst` pre-prime for CLEAN_CYCLE when previous is **NULL** or **BLOOD** |
| CLEAN_CYCLE | **yes** — Scythe-local only |
| Brink / Sacrifice | none |
| Scopes | once per action |
| Preview | Flux cost 4; show CLEAN_CYCLE conditional amp/refund when previous is NULL/BLOOD |
| Log (future) | `[SCYTHE] >> Null Arc — Clean Catalyst cycle…` / clean Flux cycle prompt (retire `[NULL CONDUIT]`) |
| Tooltip | Efficient occult arc. 1 Veil Rot, 1 Ward strip. Primes NULL. CLEAN CYCLE after NULL or BLOOD. |
| Non-interactions | Not top burst; does not grant unconditional high damage |

### 5.6 Scythe — `SILENT_EDGE` (order 2) — **NEW**

| Field | Contract |
|-------|----------|
| Purpose | Deliberate ECHO prime for Silencing Echo; Ward pressure |
| AP | **1** |
| Stamina | **8** |
| Flux | cost **12** |
| HP | none |
| Targeting | `SINGLE` |
| Damage | Occult **14** base (+ sequence payoff if NULL→ECHO) |
| Ward / Armor | strip **1** Occult Ward (authored); sequence may add extra ward break |
| Veil Rot | apply **1** |
| Catalyst | primes **ECHO**; **reads** sequence once per action (Silencing Echo when previous NULL) |
| CLEAN_CYCLE | no (ECHO prime) |
| Scopes | once per action |
| Preview | if previous Catalyst is NULL, preview Silencing Echo payoff as **conditional** |
| Log | `[SCYTHE] >> Silent Edge — echo cut.` |
| Tooltip | 14 occult, 1 Rot, 1 Ward strip. Primes ECHO. Completes Silencing Echo after NULL. |
| Economy role | Forgiveness via sequence correction after Null Arc; engages live NULL→ECHO |

### 5.7 Scythe — `VEIN_CUT` (order 3) — **NEW**

| Field | Contract |
|-------|----------|
| Purpose | BLOOD prime; resource stability / Null Vein path; not unconditional healbot |
| AP | **1** |
| Stamina | **8** |
| Flux | cost **10** |
| HP | none (heal only via Catalyst payoff rules) |
| Targeting | `SINGLE` |
| Damage | Occult **10** |
| Ward / Armor | none authored |
| Veil Rot | apply **1** |
| Catalyst | primes **BLOOD**; sequence read once (NULL→BLOOD / ECHO→BLOOD payoffs preserved) |
| CLEAN_CYCLE | no on this cast; primes BLOOD so a **following** `NULL_ARC` can CLEAN_CYCLE |
| Scopes | once per action |
| Preview | show heal/shield only when previous Catalyst makes a payoff legal |
| Log | `[SCYTHE] >> Vein Cut — blood catalyst.` |
| Tooltip | 10 occult, 1 Rot. Primes BLOOD. Sets Clean Cycle for a later Null Arc. |
| Non-interactions | Does not lock Flux at 100; heal amounts are sequence-owned, not flat WA heals |

### 5.8 Scythe — `SMOKE_ARC` (order 4) — **NEW**

| Field | Contract |
|-------|----------|
| Purpose | ASH prime; soft control / ASH→NULL setup; forgiveness without burst inflation |
| AP | **1** |
| Stamina | **8** |
| Flux | cost **10**; on hit gain **+5** Flux (authored; capped by `clampVeilFlux`) |
| HP | none |
| Targeting | `SINGLE` |
| Damage | Occult **8** |
| Ward / Armor | none authored (sequence ASH→NULL may ward-break later) |
| Veil Rot | **0** (explicit non-applicator — not every Scythe card applies Rot) |
| Catalyst | primes **ASH** |
| Status | target **−10% accuracy** until end of next enemy turn (encounter status; not a new global resource) |
| CLEAN_CYCLE | no |
| Scopes | once per action |
| Preview | Flux net −10+5; accuracy debuff; no Rot |
| Log | `[SCYTHE] >> Smoke Arc — ash veil.` |
| Tooltip | 8 occult, +5 Flux on hit, −10% enemy accuracy. Primes ASH. No Veil Rot. |
| Economy role | Sequence toward Smoke Collapse (ASH→NULL) with Null Arc; Flux cushion without permanent full-Flux lock |

---

### 5.9 Heart’s Due — `BLOOD_REFRACTION` (order 1) — **LOCKED LIVE**

| Field | Contract |
|-------|----------|
| Purpose | Brink + capped HP sacrifice basic |
| AP | **1** |
| Stamina | **6** |
| Flux | cost `(catalog 5) + 2` → **7** |
| HP | sacrifice `min(8, floor(maxHp × 0.05))` intended; pay `min(intended, hp − 1)` **once per action**; cannot directly kill |
| Targeting | `SINGLE` |
| Damage | Occult base `max(catalog, 12)` × occultDamagePct; if Flux ≤ **25** → × **1.20**; if full sacrifice paid → × **1.15** (order: scale → brink → full-pay) |
| Ward / Armor | strip **1** Occult Ward |
| Veil Rot | apply **1** |
| Catalyst | primes **NULL** (compat with splinter map) |
| Brink | Flux ≤ **25** |
| Sacrifice | once per action; partial withholds ×1.15; `invokeSacrificeHook` only on full pay |
| Scopes | HP pay + damage mults: **once per action** (never per packet/target beyond the single target) |
| Preview | intended vs payable HP; brink armed/not; full-pay vs partial clearly labeled |
| Log (future) | `[HEART'S DUE] >> …` (retire `[SANGUINE PRISM]`) |
| Tooltip | Pay capped HP for occult spike. Brink at Flux ≤25. Full pay required for sacrifice multiplier. |
| Non-interactions | Sacrifice is direct HP mutation via `applyHpSacrifice`, not an enemy damage packet |

### 5.10 Heart’s Due — `EXPOSE_VEIN` (order 2) — **NEW**

| Field | Contract |
|-------|----------|
| Purpose | Open exposure window without full cashout; sets up Heart Claim |
| AP | **1** |
| Stamina | **8** |
| Flux | cost **12** |
| HP | **no sacrifice** on this action |
| Targeting | `SINGLE` |
| Damage | Occult **9**; if Brink armed (Flux ≤25) → × **1.20** only (no sacrifice mult) |
| Ward / Armor | strip **1** Occult Ward |
| Veil Rot | apply **1** |
| Catalyst | primes **BLOOD** |
| Family state | arms `sanguineExposure` on target (see §14) |
| Brink | damage amp only; no HP pay |
| Scopes | once per action |
| Preview | brink conditional; “Exposure armed” |
| Log | `[HEART'S DUE] >> Expose Vein — blood marked.` |
| Tooltip | Mark the target Exposed. 9 occult, 1 Rot, 1 Ward strip. Brink amp if Flux ≤25. No HP sacrifice. Primes BLOOD. |
| Non-interactions | Does not grant ×1.15; not a heal |

### 5.11 Heart’s Due — `CRIMSON_VENT` (order 3) — **NEW**

| Field | Contract |
|-------|----------|
| Purpose | Post-sacrifice stabilize without deleting risk identity |
| AP | **1** |
| Stamina | **0** (explicitly **no** Stamina cost) |
| Flux | cost **0**; restore **+15** Flux (clamp) |
| HP | restore **`min(6, floor(maxHp × 0.04))`** once (self heal — not enemy packet) |
| Targeting | `NONE` (self) |
| Damage | none |
| Ward / Armor | none |
| Veil Rot | none |
| Catalyst | primes **ASH** |
| Brink / Sacrifice | none |
| Scopes | once per action |
| Preview | exact Flux + HP restore numbers |
| Log | `[HEART'S DUE] >> Crimson Vent — pressure bled off.` |
| Tooltip | Vent pressure: +15 Flux and a small self heal. Primes ASH. No damage. |
| Non-interactions | Not a full `AETHERIC_TRANSFUSION` replacement; does not clear Void-Siphoned by itself unless Flux rises above 0 |
| Economy role | Forgiveness valve after Claim/Refraction; keeps Heart’s Due less forgiving than Scythe overall |

### 5.12 Heart’s Due — `HEART_CLAIM` (order 4) — **NEW**

| Field | Contract |
|-------|----------|
| Purpose | Highest earned single-target payoff; requires exposure + payment |
| AP | **2** |
| Stamina | **12** |
| Flux | cost **18** |
| HP | same sacrifice formula as Blood Refraction — **once per action**; cannot kill; partial withholds full-pay mult |
| Targeting | `SINGLE` |
| Damage | Occult base **22**; ×1.20 if Brink; ×1.15 if full sacrifice paid; **additional ×1.10** if `sanguineExposure` present on target (then consume mark). Mult order: base → brink → full-pay → exposure |
| Ward / Armor | strip **1** Occult Ward |
| Veil Rot | apply **1** |
| Catalyst | primes **BLOOD** |
| Brink / Sacrifice | as Refraction; exposure mark consumed on resolve if present |
| Scopes | one HP payment, one damage packet, one mark consume — **once per action** |
| Preview | show missing exposure as reduced conditional; never show exposure mult as guaranteed without mark |
| Log | `[HEART'S DUE] >> Heart Claim — due collected.` |
| Tooltip | Heavy occult claim. Pays capped HP once. Brink and full-pay mults apply. +10% if Expose Vein marked the target. |
| Non-interactions | Not multi-target; not swarm tool; not Scythe-level forgiveness |

---

## 6. Flex-pool contract

### Verified live assignable pool (`getAssignableEnvoyAbilities`)

1. `ASTRAL_LANCE`  
2. `ENTROPY_HEX`  
3. `NECROTIC_BLOOM`  
4. `FLUX_PURGE`  
5. `DIMENSIONAL_SHEAR`  
6. `PHASE_STEP`  
7. `AETHERIC_TRANSFUSION`  
8. `SOUL_TETHER`  
9. `FLESH_WARP`  
10. `PARALYTIC_MIASMA`  
11. `MIND_SUNDER`  

**Excluded from flex:** `VEIL_SPLINTER`, `RIFT_WARD`, `CATACLYSM_SIGIL` / proc ultimates, all WA IDs, wrong-class IDs.

### Persistence

- Schema (future): `EnvoyFlexLoadout = readonly [EnvoyAbilityId, EnvoyAbilityId, EnvoyAbilityId]`.
- Exactly three **unique** IDs.
- Default non-anchor triple preserved: `ASTRAL_LANCE`, `ENTROPY_HEX`, `NECROTIC_BLOOM`.
- Deprecated maps preserved: `SPATIAL_COLLAPSE → NECROTIC_BLOOM`, `GRAVITY_WELL → PARALYTIC_MIASMA`.
- No family-specific flex restrictions.
- Changing equipped family **preserves** the same three flex IDs and order.

### Combination count

- Unordered unique sets: \(\binom{11}{3} = **165**\).
- Ordered distinct triples (slot permutation): \(11×10×9 = **990**\).  
  Persistence stores **ordered** triples; validation requires uniqueness only (order is player-authored).

---

## 7. Rift Ward and Ultimate placement

| Feature | Placement | Persistence |
|---------|-----------|-------------|
| Rift Ward | Outside strip; fixed class mechanic | Not a flex; intrinsic |
| `FUNERAL_KNOT` | Orbital / staged; Vambrace only | Not a flex |
| `NULL_CIRCUIT` | Orbital / sigil; Scythe only | Not a flex; `CATACLYSM_SIGIL` compat hook |
| `CRIMSON_REFRACTION` | Orbital / staged; Heart’s Due only | Not a flex |

---

## 8. Flux lifecycle (contract)

| Item | Authority |
|------|-----------|
| Start / min / max | `VEIL_FLUX_START` 100 / 0 / `VEIL_FLUX_CAP` 100 (`FLUX_CAPACITOR` → 120) |
| Clamp | `clampVeilFlux` |
| Void-Siphoned | `flux <= 0` |
| Spend validation | before commit; insufficient Flux rejects cast |
| CLEAN_CYCLE Flux | Scythe `NULL_ARC` only (+4) |
| New WA Flux | as authored in §5; all clamp |

**No retune** of caps, Void-Siphoned rules, or CLEAN_CYCLE constants.

---

## 9. Rot lifecycle (contract)

| Item | Authority |
|------|-----------|
| Storage | `classState.veilRotStacks` only — **no second owner** |
| Cap / tick | `VEIL_ROT_STACK_CAP` 4 / `VEIL_ROT_TICK_DAMAGE` 8 |
| Apply / consume | `infectVeilRot` / `consumeVeilRotStacks` / `purgeAllVeilRotStacks` |
| Detonation | Catalytic Console + Ultimates; `ROT_KNELL` is bounded consume, not Catalytic |
| Tick timing | end of enemy turn (`tickVeilRotEndOfEnemyTurn`) |
| Derivative | tick/detonate use `hurtEnemy` with indirect/flags; must not re-enter WA executor hooks |

Vambrace WAs specialize via stack apply/transfer/consume amounts — **same** Rot engine.

---

## 10. Catalyst sequencing (future engine contract for E.4)

### Types

`NULL` | `ECHO` | `BLOOD` | `ASH`

### Ownership

- `classState.currentCatalyst` / `previousCatalyst` / `catalystPrimedThisTurn`
- **Future:** one Envoy-owned cast-resolution authority callable by flex **and** WA (extract from Hub). Hub retains presentation/orchestration only.

### Replacement

`primeEnvoyCatalyst`: previous ← current; current ← next; flag primed this turn.

### Resolution order (per successful cast)

See §13 steps 9 after authored packets. Sequence payoff resolves **once per action** using `(previous, current)` returned from prime. Multi-hit does not re-prime or re-resolve per packet.

### Pair table (preserve live)

| Previous → Current | Name | Payoff |
|--------------------|------|--------|
| NULL→ECHO | Silencing Echo | +1 ward break, fracture, +15% damage |
| ECHO→BLOOD | Recovered Memory | shield 8, heal 4 |
| ASH→NULL | Smoke Collapse | +1 ward break, +10% damage |
| NULL→BLOOD | Null Vein | heal 10 if Fractured else 4 |
| ECHO→ASH | Dead Signal | +10% damage |
| BLOOD→ECHO | Resonant Bleed | fracture if target, +20% damage |
| other | resonance | +5% damage |
| none | first prime | log only |

### WA prime matrix

| Action | Primes | Reads sequence |
|--------|--------|----------------|
| GRAVEWEAVE | NULL | no CLEAN_CYCLE; sequence after prime |
| GRAVE_TRANSFER | ECHO | yes |
| VEIL_BRAND | ECHO | yes |
| ROT_KNELL | ASH | yes |
| NULL_ARC | NULL | CLEAN_CYCLE read **before** prime (live previous); sequence after |
| SILENT_EDGE | ECHO | yes |
| VEIN_CUT | BLOOD | yes |
| SMOKE_ARC | ASH | yes |
| BLOOD_REFRACTION | NULL | yes |
| EXPOSE_VEIN | BLOOD | yes |
| CRIMSON_VENT | ASH | yes |
| HEART_CLAIM | BLOOD | yes |

### Miss / cancel / invalid

- Cancel / invalid before commit: **no** prime.
- After commit: prime once even if later packets miss (match planned E.4 parity with flex “prime after execute”); document runtime must not double-prime.
- Derivative damage: **no** prime.

### Preview

Show next prime and **conditional** pair payoff only when previous Catalyst makes that pair legal. Never promise Silencing Echo without previous NULL.

---

## 11. Ward and curse behavior

| System | Owner | WA usage |
|--------|-------|----------|
| Player Rift Ward | intrinsic `RIFT_WARD` / overlay | Outside strip; ASH prime today — unchanged |
| Enemy Occult Ward | defense layer / strip hooks | Strip counts authored per WA |
| Curse | ability tags + status effects | `VEIL_BRAND` AP drain; flex curses unchanged |

Curse is a **tag/status family**, not a separate enum store.

---

## 12. Brink and sacrifice behavior

**Locked constants (do not retune):**

- Brink threshold Flux ≤ **25**
- Brink mult × **1.20**
- Sacrifice `min(8, floor(maxHp × 0.05))`
- Once per action; cannot directly kill (`hp − 1` floor)
- Full-pay mult × **1.15** only when intended fully paid

| Action | Brink | Sacrifice |
|--------|-------|-----------|
| BLOOD_REFRACTION | yes | yes |
| EXPOSE_VEIN | damage only | no |
| CRIMSON_VENT | no | no |
| HEART_CLAIM | yes | yes |
| All Vambrace / Scythe | no | no |

Partial payment: cast **proceeds**; full-pay mult withheld (documented Heart’s Due exception).

---

## 13. Resource / mutation order (canonical future WA)

1. Family/action validation (`kitComplete`, family match, WA id).
2. Target / allocation validation.
3. AP, Stamina, Flux, HP-payable, conditional-state validation (e.g. Rot present for Transfer/Knell).
4. Pre-commit snapshots (Flux, HP, Rot map, Catalyst pair, exposure marks).
5. Resource commitment (AP, Stamina, Flux spend, HP sacrifice if any — **once**).
6. Authored packets / results.
7. Mitigation, Armor, Occult Ward handling.
8. Rot / curse / status application or transfer/consume.
9. Catalyst priming + **once-per-action** sequence payoff.
10. Family-state updates (arm/consume exposure).
11. Boon and graft hooks (action-level once; sacrifice hook only if full pay).
12. Ultimate readiness recompute (Rot totals etc.).
13. Cleanup of ephemeral plan objects.
14. Telemetry, provenance, combat log, presentation state.

**Reject before step 5:** mutate nothing.  
**Heart’s Due partial HP:** allowed at step 5 with mult withheld at step 6.

---

## 14. Family-state matrix

Prefer Flux / Rot / Catalyst / Brink / sacrifice.

| State | Family | Type | Arm | Consume | Refresh | Expire | Death / encounter cleanup | Serialize? | Why needed |
|-------|--------|------|-----|---------|---------|--------|---------------------------|------------|------------|
| `sanguineExposure[unitId]` | Heart’s Due | `Record<string, true>` on encounter classState | `EXPOSE_VEIN` success | `HEART_CLAIM` damage resolve | Re-arm refreshes | Cleared end of next **enemy** turn if unconsumed; cleared on encounter end; cleared if unit dies | Yes on unit death / encounter end | **No** account/run persistence | Brink/sac alone cannot express “mark then claim” without turning Claim into unconditional burst |
| CLEAN_CYCLE | Scythe | ephemeral plan flag | derived from Catalyst history at `NULL_ARC` | n/a | n/a | per cast | n/a | No | Existing |
| Catalyst previous/current | All | existing | prime | n/a | replace | encounter | encounter reset | No beyond encounter | Existing |

**No** Vambrace latch state — Transfer + Knell cover fragile cashout.  
**Weapon switch:** N/A mid-run; on new encounter, exposure map empty.

---

## 15. Boon and graft tag matrix

| Action | Boon / affinity tags | Graftable |
|--------|----------------------|-----------|
| GRAVEWEAVE | OCCULT, CURSE, CONTROL, FLUX, WEAPON_BASIC | yes |
| GRAVE_TRANSFER | OCCULT, CURSE, CONTROL, FLUX | yes |
| VEIL_BRAND | OCCULT, CURSE, CONTROL, DEBUFF | yes |
| ROT_KNELL | OCCULT, FLUX_DUMP, CURSE | yes |
| NULL_ARC | OCCULT, FLUX, CLEAN_CYCLE, WEAPON_BASIC | yes |
| SILENT_EDGE | OCCULT, FLUX, WARD_BREAK | yes |
| VEIN_CUT | OCCULT, FLUX, RESTORE (sequence) | yes |
| SMOKE_ARC | OCCULT, FLUX, ASH | yes |
| BLOOD_REFRACTION | OCCULT, SACRIFICE, HIGH_RISK, FLUX, WEAPON_BASIC | yes |
| EXPOSE_VEIN | OCCULT, SACRIFICE, HIGH_RISK, FLUX | yes |
| CRIMSON_VENT | OCCULT, RESTORE, FLUX | yes |
| HEART_CLAIM | OCCULT, SACRIFICE, HIGH_RISK, FLUX_DUMP | yes |

**Not graftable:** `RIFT_WARD`, Ultimates, compat aliases.

---

## 16. Preview / runtime contract

- Preview owner (E.4): Envoy WA catalog/executor plan helpers — **same numbers** as commit path.
- Conditional lines (CLEAN_CYCLE, Silencing Echo, Brink, full-pay, exposure, Rot Knell stacks) must be labeled conditional.
- Never show expected max Knell/Claim damage as guaranteed.
- Catalyst payoff preview only when pair is currently legal.
- Flux and HP costs must match commit (including Null Arc `max(3, cost−1)` and Refraction `+2`).

---

## 17. Provenance and telemetry contract

- Every WA commit emits `originActionId = <WA permanent ID>`.
- Compat casts entering as `VEIL_SPLINTER` normalize provenance to equipped action 1 ID before hooks.
- Catalyst-derived effects provenance: `originActionId` + `catalystPair` key.
- Sacrifice hooks fire only on full pay with same `originActionId`.
- Telemetry must record family ID, WA order index, flex vs WA discriminant.

---

## 18. Compatibility and alias matrix

| Ingress ID | Result |
|------------|--------|
| `VEIL_SPLINTER` | → equipped family action 1 |
| `BLACK_WICK` | → `GRAVEWEAVE` |
| `GRAVEWEAVE` / `NULL_ARC` / `BLOOD_REFRACTION` | recognize as WA; never persist as flex |
| `CATACLYSM_SIGIL` | Ultimate compat → `NULL_CIRCUIT` on Scythe only |
| WA IDs in flex slots | reject / replace in sanitize |
| `RIFT_WARD` in flex | reject / replace |
| Ultimate IDs in flex | reject / replace |
| Deprecated flex aliases | migrate then validate |
| Unknown / wrong-class | reject; fallback default flex triple if loadout irreparable |

Historical aliases must **not** generate a second live card beside action 1.

---

## 19. Save-migration contract (design only)

**From:** `EnvoyLoadout = [VEIL_SPLINTER, f1, f2, f3]`  
**To:** `EnvoyFlexLoadout = [f1, f2, f3]`

| Case | Behavior |
|------|----------|
| Clean 4-slot with `VEIL_SPLINTER` + 3 unique flexes | keep ordered triple |
| Wrong / missing / no anchor slot0 | drop slot0; sanitize remaining flexes or default triple |
| `BLACK_WICK` / family anchor in any slot | strip from flex; do not persist |
| Duplicate flexes | dedupe left-to-right; fill from default/assignable |
| Unknown / wrong-class / WA / Ward / Ultimate | strip; fill |
| Deprecated IDs | migrate then validate |
| Short array | pad via sanitize defaults |
| Oversized | take first three valid unique flexes after stripping illegals |
| Run snapshot / active incursion | migrate snapshot flexes idempotently; do not change equipped weapon; no mid-run swap |
| Repeated normalize | idempotent |
| Inspection | **must not mutate input** (return new arrays) |
| Default fallback | `ASTRAL_LANCE`, `ENTROPY_HEX`, `NECROTIC_BLOOM` |
| Weapon switching (account) | preserve flex triple |

---

## 20. Presentation contract (future E.5)

- Sanctuary / Dossier / DeckWorkspace: four **read-only** family WA in order + three editable flexes labeled **FLEX ABILITIES**.
- Combat command deck: same 4+3; Rift Ward + Ultimate outside strip.
- No editable WA slot; no live `VEIL_SPLINTER` card; no duplicate anchor.
- Flux / HP / Brink / partial-vs-full-pay clarity on Heart’s Due cards.
- Catalyst history + conditional sequence preview.
- Veil Rot stacks visible; Knell/Catalytic distinguish guaranteed vs conditional.
- Live names Vambrace / Scythe / Heart’s Due.
- Retire Echo Lantern / Null Conduit / Sanguine Prism from **live combat logs** in E.5.
- First-use briefs / recommendations / telemetry follow WA IDs.

**E.2 does not change these surfaces.**

---

## 21. Implementation authority boundaries

| Concern | Owner | Must not own |
|---------|-------|--------------|
| WA registry / order / kitComplete | `envoyWeaponActionRegistry.ts` (**E.3 live**) | Hub |
| WA catalog structural metadata | `envoyWeaponActionCatalog.ts` (**E.3 live**) | flex catalog / ENVOY_ABILITY_CATALOG |
| Combat surface build | `buildEnvoyCombatSurface` in `envoyCombatCompatibility.ts` (**E.5 live Hub/Sanctuary**) | compatibility aliases as cards |
| Flex sanitize / migrate | `envoyFlexLoadoutEngine.ts` (**E.5 persistence**) | mutating inspectors |
| Live three-flex persistence | `sanitizeEnvoyCombatLoadout` → `sanitizeEnvoyFlexLoadout` (**E.5**) | dual persisted schemas; `projectEnvoyLiveFourSlotDeck` fixture-only |
| Historical aliases | `envoyActionAliases.ts` + `canonicalizeEnvoyCombatActionId` (**E.3**) | scattered Hub checks |
| WA plan / execute / preview | `envoyWeaponActionPlanEngine` / `Executor` / `PreviewEngine` (**E.4 live**) | Hub branches / placeholders |
| Catalyst cast authority | `envoyCatalystCastEngine.resolveEnvoyCatalystCast` (**E.4 live**); pair table in `envoyCatalystEngine` | Hub pair calculation |
| `sanguineExposure` / Smoke Arc accuracy | `envoySanguineExposureEngine` (**E.4 live**) | account/run persistence |
| Rot / Flux / Brink / sac | existing engines (E.4 wiring) | second stacks map |
| Ultimates | `weaponUltimateRegistry` + resolve engines | flex/WA catalogs |
| Rift Ward | intrinsic path | strip cards |

**E.5 persistence:** account/run `envoyLoadout` stores canonical three-flex `EnvoyFlexLoadout`. Legacy four-slot saves migrate by dropping slot-zero compatibility/anchor IDs. No parallel loadout field.

---

## 22. Locked values versus newly authored values

### Locked (live — do not modify in E.2–E.4 without explicit phase)

- Brink 25 / ×1.20; sac min(8,floor(maxHp×5%)) / ×1.15 full pay; once; no self-kill.
- CLEAN_CYCLE +4 Flux / ×1.12 damage; previous NULL|BLOOD.
- GRAVEWEAVE / NULL_ARC / BLOOD_REFRACTION plan math in `weaponBasicEngine`.
- Flux start/cap; Rot cap 4; tick 8; Cataclysm gate 6.
- All Catalyst pair payoffs.
- All eleven flex definitions; Rift Ward; Ultimates; boons; grafts; unlock recipes.
- `LANTERN_FLUX_PURGE_DAMAGE_PER_EXTRA_ROT = 8` (referenced by Rot Knell).

### Newly authored (E.2 contract → implement in E.3/E.4)

| Action | AP | Stam | Flux | Base occult / other | Notes |
|--------|---:|-----:|------|---------------------|-------|
| GRAVE_TRANSFER | 1 | 8 | 10 | 6 + transfer ≤2 Rot | DUAL |
| VEIL_BRAND | 1 | 8 | 12 | 5 + Rot1 + AP−1 | |
| ROT_KNELL | 1 | 10 | 15 | 8×consumed stacks (≤2) | |
| SILENT_EDGE | 1 | 8 | 12 | 14 + Rot1 + Ward1 | |
| VEIN_CUT | 1 | 8 | 10 | 10 + Rot1 | |
| SMOKE_ARC | 1 | 8 | 10 (−net +5 on hit) | 8; −10% accuracy; **0 Rot** | |
| EXPOSE_VEIN | 1 | 8 | 12 | 9 + Rot1 + Ward1; brink; arm exposure | |
| CRIMSON_VENT | 1 | **0** | 0 / +15 | heal min(6,floor(maxHp×4%)) | NONE target |
| HEART_CLAIM | 2 | 12 | 18 | 22 + sac + brink + exposure×1.10 | |

**Underdetermined → flagged (do not guess in implementation):** none blocking E.3 registry; exposure expire “end of next enemy turn” is authored here as the contract choice.

---

## 23. Deferred implementation phases

- **E.3** — family-action registry, catalog, total authority, combat-surface derivation, three-flex schema, compatibility, migration structure. No gameplay executor bodies required beyond stubs if gated.
- **E.4** — twelve executors, preview parity, Catalyst centralization, Rot/Flux/Ward/Brink/sacrifice scopes, `sanguineExposure`, boon/graft/provenance wiring.
- **E.5** — Sanctuary/combat presentation, log cleanup, GDD reconciliation, migration verification, visual review, regression, Envoy closeout.

---

## 24. Acceptance gates

### E.3 gate

- All three families `kitComplete: true` with exactly four WA IDs in order.
- `buildEnvoyCombatSurface` returns 4 WA + 3 flex; never persists WA.
- `sanitizeEnvoyFlexLoadout` idempotent; inspection non-mutating.
- `VEIL_SPLINTER` / anchors / aliases canonicalize without duplicate cards.
- Unlock-path Envoy slots remain Vambrace=1, Scythe=2, Heart’s Due=3.
- Aegis/Hex surfaces unchanged.

### E.4 gate

- One Catalyst cast authority; Hub not sole prime owner.
- Per-action contracts in §5 match runtime plans.
- Sacrifice/Brink/CLEAN_CYCLE/Rot scopes pass focused tests.
- Preview === runtime for locked and authored numbers.
- No second Rot authority; no recursive full hook replay.

### E.5 gate

- 4+3 presentation live; Rift Ward + Ultimate outside strip.
- Live names only; retired log codenames gone.
- GDD reconciled; migration verified on fixtures; visual review recorded if workflow exists.
- Regression + `tsc` baseline policy satisfied; Envoy weapon-kit closed.

### E.5V gate (visual)

- Required matrix in `docs/envoy-weapon-kit-e5v-visual-review.md` fully rendered and inspected.
- Combat Hub shows both **WEAPON ACTIONS** and **FLEX ABILITIES** without clipping on desktop + narrow.
- Sanctuary / Dossier / DeckWorkspace / targeting / conditional states inspected or explicitly blocked with human launch steps.
- Presentation-only repairs reinspected; E.4 mechanics untouched.

---

## Unlock-path prerequisite (E.2 repair)

Live registry starter remains **Vambrace** (`envoy-echo-lantern`).  
Audit table `SLOT_BY_ID` corrected to:

| ID | Slot |
|----|-----:|
| `envoy-echo-lantern` | 1 |
| `envoy-null-conduit` | 2 |
| `envoy-sanguine-prism` | 3 |

Unlock costs, ownership normalization, and equipped-weapon non-swap behavior unchanged.

---

*End of Envoy Weapon-Kit Contract (E.2).*
