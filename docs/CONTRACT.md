# Classroom Hub — Multi-user CONTRACT (frozen)

The single shared interface every agent codes against. Do not change without the Lead's sign-off.

## Non-synced local keys (NEVER add to DATA_KEYS)
- `tp_owner_uid`   — uid that owns the local data (stamped on adopt + first signed-in write)
- `tp_owner_email` — email for the active-account banner / picker
- `tp_known_emails`— JSON array of remembered emails for the device-local account picker

## Cloud envelope (Realtime DB)
`users/{uid}/keys/{key} = { v: <string>, t: <number> , ver?: <number> }`
Readers MUST accept both `{v,t}` (legacy) and `{v,t,ver}`. Only ever ADD `ver`.

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
2. remote empty AND `tp_owner_uid === uid` → silent `cloudAdoptLocal()` (resuming own device).
3. remote empty AND local data exists AND owner unset/≠uid → `appPromptAdopt(...)`. NEVER auto-seed.
4. remote empty AND no local data → start empty; stamp owner = uid.

## Reset semantics (the deletion-push hazard)
`resetSession` clears via an unhooked raw remove (`LS.removeItem` / a `CLOUD.resetting` flag that
short-circuits the `Storage.prototype.setItem` hook) so a sign-out NEVER wipes the cloud account.

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
(`mode`, `slots`, `xtPick` were added, additively) and reach `tp_starter_weeks`. Retire the key
with the shims below.

Back-compat shims (delete no earlier than the end of the 2026/27 school year):
- foot of `js/glow.js` — aliases every `gg*` export back to its `bt*` name
- `index.html` — `window.openBattler`, and `showPage()` maps the legacy `#battler` hash to `#glow`
- `js/nav.js` — `showPage()` maps `#generator` onto `#mental-starters`
- `js/hub.js` — `PLAN_HASHES` still accepts `battler` and `generator`. This read "both mode whitelists" until the
  Sep 2026 navigation redesign removed Teach mode; there is one whitelist now, and the shim is
  unchanged. `tp_mode` went with Teach — it was per-device and never in `DATA_KEYS`, so nothing
  synced and no migration is owed.
