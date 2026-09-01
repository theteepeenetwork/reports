# Classroom Hub

A planning and teaching app for a UK primary classroom. Static HTML, CSS and vanilla JavaScript —
no build step, no framework, no server. Open `index.html` and it works, entirely offline, storing
everything in that browser's `localStorage`. Connecting a Firebase project (optional, see
[SETUP.md](SETUP.md)) adds accounts and instant multi-device sync on top, without changing how any
of it behaves offline.

Built by a class teacher, for a class teacher. Every design decision should be read against that:
it has to work at 8:50am on a smartboard with thirty children arriving.

## What's in it

**Desk** — the sitting-down surface, on a laptop: Today, Pupils, Class Context (SEND / EHCP /
Pupil Premium), Markbook (assessments, mental-starter scores, charts, marking), Timetable, Seating,
Instant Groups, Groups, Reports.

**Class** — the standing-up surface, on a tablet: this week's mental-maths starter, a fair name
picker, fast point-awarding, seats and groups, a quick behaviour log.

**Board** — the class-facing surface, projected. Reached from **Show on board ▶**, which sits in the
same place on both of the other surfaces. Holds **Glow Getters** (behaviour points, ranks, badges,
group battles, seven board views) and the printable starter sheet.

> Glow Getters is called `glow` in the code. It was `battler` until September 2026 —
> see [docs/GLOSSARY.md](docs/GLOSSARY.md).

## Running it locally

Login and sync need `https` or `localhost` — opening `index.html` as a `file://` URL works for
everything else but not for accounts.

```bash
git clone https://github.com/theteepeenetwork/reports.git
cd reports
python3 -m http.server 8000     # then open http://localhost:8000
```

## Tests

```bash
npm install
npx playwright install chromium
npm test
```

Five smoke tests, run on every push and pull request. They stub Firebase and block the SDK at the
network layer, so **the suite never touches the live project**. The first test is the one that
matters most: signing out must never push deletions to the cloud. See [tests/](tests/).

## Working on it

Read these before changing anything:

| Document | What it is |
|---|---|
| [docs/CONTRACT.md](docs/CONTRACT.md) | The frozen interface: storage keys, the cloud envelope, reset semantics. Changes need the Lead's sign-off. |
| [docs/OWNERSHIP.md](docs/OWNERSHIP.md) | One owner per file. Nobody edits a file they don't own. |
| [docs/GLOSSARY.md](docs/GLOSSARY.md) | Shared vocabulary — product names, code names, and the school terms in the UI. |
| [PRIVACY.md](PRIVACY.md) | The data-protection checklist for a school rolling this out. |
| [SETUP.md](SETUP.md) | Turning on Firebase login and sync. |

Two rules carry most of the weight:

1. **Never rename a `tp_*` storage key.** They are in `DATA_KEYS`, in the cloud envelope, and on
   every device already in the field. Renaming one orphans every synced account. If one ever has to
   move, it moves behind a migration that reads both and writes one, with a test.
2. **A sign-out must never write to the cloud.** `resetSession()` clears local data through an
   *unhooked* `removeItem` so the `Storage.prototype.setItem` hook cannot fire. A push during a
   reset writes `{v: ''}` and blanks that key on every other device. `tests/01-cloud-reset.spec.js`
   guards this.

## Licence

No licence yet — all rights reserved. Ask before reusing.
