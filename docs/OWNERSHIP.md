# File ownership

**One owner per file. No shared files.** An agent or contributor who needs a change in a file they
do not own opens a request for the owner; they do not reach in and edit it.

This is not ceremony. Everything used to live in `index.html`, so any two people working at once
collided on every task. The split exists so that work can happen in parallel; this table is what
keeps it that way. If you find yourself wanting to edit two owners' files in one change, that is a
signal the change wants splitting, or that the boundary is in the wrong place — raise it rather
than quietly crossing it.

| Owner | Responsibility | Files |
|---|---|---|
| **Shell** | App skeleton, routing, surface switching, top bar, boot, hosting | `index.html`, `js/nav.js`, `js/helpers.js`, `js/boot.js`, `css/app.css`, `css/hub.css`, `server.js`, `railway.json` |
| **Desk** | The sitting-down surface | `js/roster.js`, `js/starters.js`, `js/star.js`, `js/behaviour.js`, `js/assess.js`, `js/class-context.js`, `js/profile.js`, `js/reports.js`, `js/marking.js`, `js/charts.js`, `js/timetable.js`, `js/seating.js`, `js/groups.js` |
| **Class** | The standing-up surface | `js/hub.js`, `js/picker.js`, `js/generator.js` |
| **Board** | Glow Getters, the board views, the starter sheet, the whiteboard | `js/glow.js`, `js/board/glow-launch.js`, `js/board/board-control.js`, `glow-getters.html`, `css/glow-core.css`, `css/board.css` |
| **Data** | Storage, sync, class routing, migrations — and the CONTRACT | `js/store.js`, `js/classes.js`, `js/classkeys.js`, `js/cloud.js`, `js/app-hooks.js`, `js/backup.js`, `firebase-config.js`, `firebase-rules.json`, `docs/CONTRACT.md` |
| **QA** | Tests, CI, the teacher walkthrough | `tests/*`, `.github/workflows/*`, `playwright.config.js`, `package.json` |
| **Lead** (Mark) | Product decisions, the CONTRACT sign-off, anything touching pupil data | — |

## Script order is load-bearing

Everything in `js/` is a classic script sharing one global scope — there are no modules and no
build step. A `const` at the top of `js/store.js` is visible in `js/roster.js` because the browser
evaluates them in the order `index.html` lists them, not because anything imports anything.

So: **add your script tag in the right place, and never reorder the existing ones.** The order that
matters most is `store.js` → the feature files → `reports.js` → `boot.js`, because `boot.js` calls
into all of them. `js/cloud.js` loads last of all, on purpose: it hooks `Storage.prototype.setItem`
and must not be listening while the app seeds its defaults.

## The Data owner has a veto

Any change touching a `tp_*` key, the cloud envelope, the owner stamp, or the reset path goes
through the Data owner and through [CONTRACT.md](CONTRACT.md) — no exceptions, including for
changes that look purely cosmetic.

The reason is specific rather than procedural: the failure mode is a teacher losing a term of
behaviour records, silently, on a device they share with a colleague. Nobody notices until someone
looks for data that isn't there any more.

## Shared files

Three files are unavoidably shared. Treat them as append-mostly and keep edits surgical:

- **`index.html`** — Shell owns the skeleton and script order. A feature owner adding a page adds
  their `<section class="page" id="page-…">` and nothing else.
- **`css/hub.css`** — Shell owns it. Prefix new rules so they cannot collide; the Glow Getters
  files use `gg-`, the board control uses `bd-`.
- **`docs/GLOSSARY.md`** — anyone may add a term. Nobody redefines an existing one without saying so.

## When ownership is wrong

It will be, in places — this table was written from the code as it stands, not from how the work
actually divides once people are doing it. Change it in a pull request of its own, so the boundary
move is visible rather than buried inside a feature change.
