# Glossary

Shared vocabulary. Add a term when you find yourself explaining one twice.

## The one that bites

| On screen | In the code | Notes |
|---|---|---|
| **Glow Getters** | `glow`, `gg*`, `GG_*`, `.gg-*`, `js/glow.js`, `#glow` | Was `battler` until Sep 2026. |
| — | **`tp_battler`** | **The storage key. Frozen. Never rename it.** See below. |

`tp_battler` is deliberately the one place the old name survives. It is in `DATA_KEYS`, in the cloud
envelope at `users/{uid}/keys/tp_battler`, and in the localStorage of every device already using the
app. Renaming it orphans every synced account. [CONTRACT.md](CONTRACT.md) governs it.

**The old name is also inside the data, not just on the key.** Every glow point awarded
before the rename is stored in `tp_behaviour` with the note `Behaviour Battler +1`. Points
tapped straight on the board carry no label, so that is the entire note. Anything that reads
those notes — the week summary in `Plan › Today`, the pupil timeline — must keep matching
`Battler`, or a term of glow points silently reclassify as ordinary praise. Guarded by
"glow points awarded before the rename still count" in `tests/04-points.spec.js`.

Back-compat shims exist for the rename and can be removed no earlier than the end of the 2026/27
school year: the `bt*` aliases at the foot of `js/glow.js`, `window.openBattler` in `index.html`,
the `#battler` → `#glow` hash redirect in `showPage()`, and `battler` in the two mode whitelists in
`js/hub.js`.

## Product

| Term | Meaning |
|---|---|
| **Desk / Class / Board** | The three surfaces. Named after where the teacher is standing, not what they are doing. Board is class-facing and projected. |
| **Show on board** | The control that opens a board surface. Sits in the same position on Desk and Class. `js/board/board-control.js`. |
| **Starter** | The mental-maths starter: five sets of questions, one per day, generated weekly and shown or printed. Not "the starter of a lesson" in the general sense. |
| **Quick log** | The fast one-tap way to record a point, praise, concern or star without leaving the current screen. |
| **Instant Groups** | Fair random grouping, by number of groups or by group size. Distinct from **Groups**, which is the teacher's own saved outline. |
| **Class Context** | The whole-class SEND / EHCP / Pupil Premium overview. |
| **Rank / level / badge** | Glow Getters progression. Ranks come from point thresholds, levels from points earned since the start, badges from milestones and streaks. |

## School terms in the UI

| Term | Meaning |
|---|---|
| **w/b** | Week beginning. Weeks are keyed by the Monday, as a local `YYYY-MM-DD` — never `toISOString()`, which rolls a BST midnight back a day. |
| **Half-term** | A UK school term is split in two by a week's holiday. Six per year. Mental-starter scores and assessments are stored per half-term. |
| **SEND** | Special Educational Needs and Disabilities. `SEN Support` and `EHCP` are the two levels the roster records. |
| **EHCP** | Education, Health and Care Plan — a statutory plan; the higher level of SEND support. |
| **PP** | Pupil Premium — additional funding for eligible pupils. |
| **MIS** | Management Information System — the school's system of record (SIMS, Arbor, Bromcom). Safeguarding and medical detail belongs there, not here. See [PRIVACY.md](PRIVACY.md). |
| **Sounds-Write** | The phonics programme this classroom uses. |
| **White Rose** | The maths scheme the assessment framework aligns to. |

## Code

| Term | Meaning |
|---|---|
| **`tp_`** | The prefix on every storage key. "The Teepee". |
| **Physical vs base key** | Per-class data is suffixed: base `tp_roster`, physical `tp_roster::c2`. `js/classkeys.js` routes between them. The first class keeps the unsuffixed key. |
| **The envelope** | What a synced key looks like in Firebase: `{ v: <string>, t: <number>, ver?: <number> }`. Readers must accept it with and without `ver`. |
| **Owner stamp** | `tp_owner_uid` / `tp_owner_email` — which account the data on this device belongs to. Local only, never synced. Drives the adopt-or-upload decision. |
| **Adopt** | Uploading this device's data into the signed-in account (`cloudAdoptLocal`). The deliberate, explicit direction. |
| **Unhooked write** | A `localStorage` write that bypasses the `Storage.prototype.setItem` hook, so it does not push to the cloud. How a reset clears data without wiping the account. |
| **Echo guard** | `CLOUD.lastSeen` — stops a device re-pushing a change it just received. |
