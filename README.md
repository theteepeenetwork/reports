# Classroom Hub

A planning and teaching app for a UK primary classroom. Static HTML, CSS and vanilla JavaScript —
no build step, no framework, no server. Open `index.html` and it works, entirely offline, storing
everything in that browser's `localStorage`. Connecting a Firebase project (optional, see
[SETUP.md](SETUP.md)) adds accounts and instant multi-device sync on top, without changing how any
of it behaves offline.

Built by a class teacher, for a class teacher. Every design decision should be read against that:
it has to work at 8:50am on a smartboard with thirty children arriving.

## What's in it

**The app** — one sidebar, grouped by what you are doing. *Board*: Glow Getters, Mental Starters,
Name Picker. *Pupils*: Pupils, Class Context (SEND / EHCP / Pupil Premium).
*Assess*: Markbook (assessments, starter scores, charts, marking), Reports. *Organise*: Timetable,
Seating, Groups, Instant Groups. **Quick log** sits above them all — a star, praise, concern or glow
point in two taps.

**Board** — the class-facing surface, projected. Reached from **Show on board ▶**. Holds
**Glow Getters** (behaviour points, ranks, badges, group battles, seven board views) and the
printable starter sheet.

> There was a separate tablet-first "Teach" surface until September 2026, chosen automatically
> below 1024px. It was removed: everything it held now has a home in the sidebar, and Glow Getters
> — the thing you actually stand up for — opens in its own window.

> **Mental Starters** is three steps on one page: pick a week → design the questions → the day
> sheet (print it, put it on the whiteboard, enter the scores). The middle step was the standalone
> **Question Generator** until September 2026; it wrote to its own store, so the questions a
> teacher designed there never reached the week the class actually got. `#generator` redirects.

> **Dictate marking** (Markbook › Marking › 🎤) marks a whole set of books by voice, hands-free
> after one tap: *"create new maths activity called partitioning on 25/9 … Aurora … not met …
> next pupil Zoey … met, gold star … save books"*. It reads the notes back as it goes, and "scratch
> that", "read back" and "stop listening" work too. It writes the same records as tapping the rows.
> The reading is done on the device (`js/dictate.js`); an optional **smart mode** asks Claude
> instead, through `server.js`, and only when `ANTHROPIC_API_KEY` is set on the host (see
> [PRIVACY.md](PRIVACY.md) §5). An iOS Shortcut can send Siri dictation in by opening
> `…/index.html?dictate=<text>&save=1#markbook`.

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

## Hosting

The app is static, so `server.js` is mostly a Node file server that gives Railway a process to
run, with no build step. Its one endpoint, `/api/dictate`, is dictation's optional smart mode: it
stays off unless `ANTHROPIC_API_KEY` is set in Railway's variables, and it needs the
`@anthropic-ai/sdk` package, the only runtime dependency. It answers signed-in teachers only: the
page sends its Firebase ID token and the server verifies it against Google's signing keys for the
project in `firebase-config.js` (override with `FIREBASE_PROJECT_ID`). Anyone can register an
account, so also set **`DICTATE_ALLOWED_EMAILS`** to the staff who may use it, e.g.
`@yourschool.org` or `a@x.org, b@x.org`. `DICTATE_MODEL` and `DICTATE_RATE_PER_HOUR` (per
teacher) are optional. `railway.json`
sets the start command and a `/healthz` check. Railway deploys `main` on push.

**Every new hostname has to be added to Firebase**, or sign-in fails there with
`auth/unauthorized-domain` while the rest of the app carries on working offline —
which makes it look like a sync bug rather than a config one. Firebase Console →
Authentication → Settings → Authorized domains. See [SETUP.md](SETUP.md) step 5.

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
