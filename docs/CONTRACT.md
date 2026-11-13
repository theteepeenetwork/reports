# Classroom Hub — Multi-user CONTRACT (frozen)

The single shared interface every agent codes against. Do not change without the Lead's sign-off.

## Non-synced local keys (NEVER add to DATA_KEYS)
- `tp_owner_uid`   — uid that owns the local data (stamped on adopt + first signed-in write)
- `tp_owner_email` — email for the active-account banner / picker
- `tp_known_emails`— JSON array of remembered emails for the device-local account picker
- `tp_sync_meta`   — `{ uid, t:{ key: account t last seen }, dirty:{ key: 1 } }`. Written by cloud.js only.
                     `dirty` = this device has an edit the account has not got (survives a closed tab or
                     a day offline); cleared once the account holds it. Wiped with the rest on reset.

## Cloud envelope (Realtime DB)
`users/{uid}/keys/{key} = { v: <string>, t: <number> , ver?: <number> }`
Readers MUST accept both `{v,t}` (legacy) and `{v,t,ver}`. Only ever ADD `ver`.
`v` may be up to 4 MB (rules; was 256 KB — a key over the limit could never sync).

## Writes never overwrite blind (Oct 2026)
A sign-in on an iPad once wiped a laptop: the iPad's reset re-seeded a one-class `tp_classes` while
signed in and the write hook pushed it over the account. Since then:
- **Hydrating.** From sign-in until the account has been pulled onto the device, cloud.js pushes
  nothing. `resetting` stays raised through `appResetState()`, so re-seeded defaults are never
  marked as edits.
- **Every push is a transaction.** If the key's `t` in the account differs from `tp_sync_meta.t[key]`,
  another device wrote it since: the two values are merged, not overwritten. Objects merge per
  field, arrays of `{id}` records merge by id, arrays of plain values are unioned, anything else
  takes this device's value. A record deleted on one device while the other edited the same key can
  come back; a record is never silently dropped.
- An incoming change for a key this device has an unsent edit to is merged into it, not applied over it.
- `child_removed` is applied: a key removed on one device is removed on the others.
- In-memory copies refreshed after a remote change: `roster, msData, spData, bhData, asData`
  (replaced) and `profile, seatState` (updated in place). A module that caches a key's data in
  memory must be added to `cloudRefreshMirrors` or re-read on `tp:sync` — a stale copy saved later
  overwrites what other devices wrote.

## Daily copies: `users/{uid}/snapshots/{id}` and `users/{uid}/snapIndex/{id}` (Oct 2026)
On the first sign-in of the day, cloud.js copies the account it just pulled to
`snapshots/{YYYY-MM-DD} = { t, keys }` (the `keys` tree as-is) and indexes it at `snapIndex/{id} = t`,
so listing never downloads a copy. 14 are kept. Restoring (the cloud chip) first saves the current
account as `{date}-{HHMM}-before-restore`, then rewrites `keys` to the copy. Beside `keys`, not in it:
never pulled or pushed as data, not in backups, untouched by sign-out.

## DOM events
- `tp:sync`  (exists)  — a data key changed; pages refresh mirrors + re-render.
- `tp:reset` (NEW)     — wipe to empty; every window/page clears its view to a neutral signed-out state.

## cloud.js PROVIDES (window globals)
- `window.resetSession()`        — detach listeners; UNHOOKED-clear all DATA_KEYS (must NOT push deletions
                                    to the cloud); `appResetState()`; dispatch `tp:reset`.
- `window.cloudSwitchAccount()`  — sign out → resetSession → show sign-in gate.
- `window.cloudAdoptLocal()`     — push current local DATA_KEYS to the signed-in account and stamp
                                    `tp_owner_uid/email` (the explicit "upload this device's data" action).

## cloud.js CONSUMES (the app must define these on window)
- `window.appResetState()`                       — reset in-memory mirrors (roster,msData,spData,bhData,asData)
                                                    to defaults and re-render the active page to empty.
- `window.appPromptAdopt(summary, handlers)`     — show the "this device has data from another account" modal.
   `summary = { keys:Number, names:Number }`; `handlers = { onUseAccount(), onKeepUpload() }`.
   onUseAccount → discard local (after offering a backup) and pull the account.
   onKeepUpload → `cloudAdoptLocal()`.

## Owner-stamp decision (cloud.js `cloudOnSignedIn`)
1. remote NON-empty → pull (account is source of truth); stamp owner = uid. (never seed)
   If `tp_owner_uid === uid`, this device's unsent edits (`tp_sync_meta.dirty`) are kept and merged.
2. remote empty AND `tp_owner_uid === uid` → silent `cloudAdoptLocal()` (resuming own device).
3. remote empty AND local data exists AND owner unset/≠uid → `appPromptAdopt(...)`. NEVER auto-seed.
4. remote empty AND no local data → start empty; stamp owner = uid.

## Reset semantics (the deletion-push hazard)
`resetSession` clears via an unhooked raw remove (`LS.removeItem` / a `CLOUD.resetting` flag that
short-circuits the `Storage.prototype.setItem` hook) so a sign-out NEVER wipes the cloud account.

## Spellings (Hundred Words): `tp_hundred_words` (Oct 2026)
The sidebar calls it **Spellings**; the file, route (`#hundred-words`) and key keep the old name.
Word indices are permanent: 0–99 the 100 HFW, 100–299 the next 200 HFW, 300+ the Year 3/4
common exception words. Append new lists after these; never reorder, or saved marks move word.
`hundred-words.html` (framed on `#hundred-words`) was written as a claude.ai artifact.
`js/hundred-words-runtime.js` stands in for its `window.claude.use("db")`: the whole database is
one JSON value, `{ sessions, practice, plans, settings }`, under the per-class key
**`tp_hundred_words`** (in `DATA_KEYS` and `TP_PER_CLASS`). Writes go through the hub window's
`localStorage` so the cloud hook sees them. Its pupils are NOT stored there: they are read from the
active class's `tp_roster`, and every record is keyed by roster pupil id.

## Mental Starter (CBM): `tp_cbm` (Oct 2026; individual sheets Nov 2026)
A second morning starter (`js/cbm.js`, route `#cbm`), separate from Mental Starters: it never reads
or writes `tp_starters` / `tp_starter_*` except to copy `tp_starter_cfg` (slots, year, ×tables) when the
teacher asks, and to keep its board ink in `tp_starter_ann` under `cbm:<iso>:…` (the focus-skills list
under `cbm:<iso>:focus:…`; `window.hubOpenBoard` takes the ink key as `opts.key`).
One per-class key, **`tp_cbm`** (in `DATA_KEYS` and `TP_PER_CLASS`):
`{ ht, slots:(stepId|null)[20], n?:6-20, sm?:true, yr?:1-6, xt?:{ on, pick:'2'|'5'|'10'|'all', count }, support:{ [pid]:{ mode:'auto'|'full'|'num', rung?, rungAt?, lv?, lvAt? } }, lv:{ [pid]:{ [class skill]: steps back } }, days:{ [iso]:{ qs, audit:[i,j], ind?:1, sheets, marks:{ [pid]: {a} | {x:1} }, tg } } }`.
`a` is the teacher's two marks (1 right, 0 wrong, -1 blank, null not given) for the slots in `audit`;
`{x:1}` absent. An entry is complete when both marks are given. No score is kept: marks from before
Nov 2026 also carry `s` (the child's own score; `w`, the wrong questions, in the first version), which
still counts as an entry and is otherwise ignored. `support[pid].mode` `'support'` (the old "always
shorter sheet") reads as `'num'`. `xt` is the optional ×tables back page (missing = off), seeded on the
date so nothing is stored per day.
Skill keys also take the form `dp:<class skill>` (the same step asked as a reasoning question, on the
sheet; `js/cbmdeep.js`) and `do:<class skill>` (the same in the practice box, where an open answer is
allowed); never rename those prefixes. `lv[pid][skill]` is `-1` for a skill that may be asked deeper
(above 0 remains steps back). Stage colours on Progress are worked out, not stored.
`sm` (missing = off): the class's children mark their own, so each child's answers print as a strip on the
back page; nothing they mark is stored. `n` is how many questions the class sheet has (missing = 20); `slots` is always 20 long and a shorter
sheet uses its first `n`, so `days[iso].qs` is 6–20 long and a day keeps the length it was made with.
**Days with `ind: 1`** (every day made since Nov 2026): every child has the day's skills with their
own numbers. `qs` is the model version (the board, the class picture). `sheets[pid]` holds only what
differs from the class — `{ ks?: { [slot]: skill asked instead }, drop?: slot[], why? }` — and is absent
when nothing does; a numbers-only child's sheet is stored whole as `{ qs, audit, rung, lv: 2, why }`.
A child's questions are **never stored**: they are rebuilt from the seed `cbm:<iso>[#v]:<pid>:<slot>`
(`sheetQs`), so the question generators in `js/wrsteps.js` / `js/generator.js` must stay deterministic
under a seeded `Math.random`, and changing one changes what an old day reprints (marks are unaffected).
The audit positions on a child's sheet are the day's `audit` slots, which are never dropped.
**Days without `ind`**: everyone shared `qs`; `sheets[pid]` is a whole shorter sheet `{ qs, audit, rung, lv?, why }`.
`lv[pid][skill]` is how many White Rose steps back that child is on that class skill (missing = 0); the
path back (`stepBack`) is the scheme's order within a topic and year, and crosses into the year
before by matching step **titles** (the step this one repeats, then the one before it), so **never
reorder steps within a block or blocks within a year, and treat a step title as data** in `js/wrsteps.js`:
rewording one can change where children a step back are sent. `support[pid].lvAt` is the date of the
last marks those steps were worked out from.
Every question carries `k`, its skill key — a White Rose step id, `pre:<set>:<slot>`, or `fd:<name>`
(the foundation ladder in `js/cbm.js`). Step ids are already permanent (`js/wrsteps.js`); `fd:` ids
are permanent too (append, never reorder). A numbers-only sheet's `rung` (and `support[pid].rung`) is
an index into `LADDER` when it carries `lv: 2`; without `lv` it indexes the first ladder (`OLD_LADDER`),
and readers map it through `rungOf`. `pre:` keys depend on the order of the half-term sets in
`js/generator.js`, so append to those sets, never reorder them. Pupil data: names are never
stored here, only roster ids.

## Handwriting: `tp_handwriting` (Nov 2026)
`js/handwriting.js`, route `#handwriting`. One per-class key, **`tp_handwriting`** (in `DATA_KEYS` and `TP_PER_CLASS`):
`{ marks: { [pid]: { [itemId]: { s: 1 | 0, d: 'YYYY-MM-DD' } } } }`. `s` 1 = can do it (green), 0 = not yet (red);
no entry = not assessed; `d` the date it was assessed. Item ids are permanent: `l:<letter>`, `c:<capital>`,
`n:<0–10>`, `j:<pair>`, `x:brk`. Add items, never rename one. Roster ids only, no names.

## Naming: Glow Getters vs `tp_battler` (Sep 2026)
Glow Getters was called "the battler" internally. The rename covers files, functions, CSS classes
and routes (`js/glow.js`, `gg*`, `.gg-*`, `#glow`) — it does NOT cover storage. The key stays
**`tp_battler`** in `DATA_KEYS`, in the cloud envelope, and on every device already in the field.
Renaming it would orphan every synced account. If it ever moves, it moves behind a migration that
reads both, writes one, and is covered by a test — never as part of a tidy-up.

## Retired page, live key: `tp_generator` (Sep 2026)
The Question Generator became Mental Starters' *design* step. No code reads or writes
`tp_generator` any more, but it stays in `DATA_KEYS`: every synced account still holds a copy, and
dropping it from the list would stop that copy syncing and quietly leave it out of backups. It is
inert, not renamed — the questions a teacher designs now live in `tp_starter_cfg`
(`mode`, `slots`, `xtPick` and, Oct 2026, `wrYear` were added, additively; `wrYear`/`yr` is the
White Rose year the step picker shows, absent = the class's year group) and reach `tp_starter_weeks`. Retire the key
with the shims below.

Back-compat shims (delete no earlier than the end of the 2026/27 school year):
- foot of `js/glow.js` — aliases every `gg*` export back to its `bt*` name
- `index.html` — `window.openBattler`, and `showPage()` maps the legacy `#battler` hash to `#glow`
- `js/nav.js` — `showPage()` maps `#generator` onto `#mental-starters`
- `js/hub.js` — `PLAN_HASHES` still accepts `battler` and `generator`. This read "both mode whitelists" until the
  Sep 2026 navigation redesign removed Teach mode; there is one whitelist now, and the shim is
  unchanged. `tp_mode` went with Teach — it was per-device and never in `DATA_KEYS`, so nothing
  synced and no migration is owed.

## Focus Remote's account link: `users/{uid}/focus` (Oct 2026)
`{ room: <16–64 url-safe chars>, t: <ms> }` — the one link an account's Apple Watch shortcuts
use (`/api/focus/<room>/…`). Written only by `focus.html`: once, by a transaction (the first
screen offers the link that device already had), and afterwards only when the teacher changes
it in ⚙. Every signed-in screen follows it live. It sits beside `keys`, not inside it, so it is
not a `tp_*` key: cloud.js never pulls or pushes it, it is not in backups, and the sign-out reset
leaves it alone. No pupil data. The device-local `focus_*` localStorage keys stay outside
`DATA_KEYS`.

## Focus Remote and Glow Getters: `focusApplied` in `tp_battler` (Oct 2026)
`focus.html` reads every class's `tp_battler` and `tp_roster` from the account (read only) to show
who just got a point. The one thing it writes is a Glow Getters **group** point sent from the
watch: it applies it to that class's `tp_battler` blob in a Realtime DB transaction, the way
`award()` in `js/glow.js` would (step, min/start/max clamp, `daily`, `recent`), and sets a new
top-level number **`focusApplied`**, the key of the last watch event applied, so several open
screens apply each event once. It is additive: `ggLoad()` keeps unknown fields, and Glow Getters
never reads it. Boards pick the change up through cloud.js like any other remote edit.
