# Classroom Hub — Privacy & Data-Protection Checklist

> **Intended audience:** the person in your school who owns data protection (DPO, headteacher, or
> business manager). This is not legal advice — take it to whoever is responsible for your school's
> GDPR compliance before you roll out the app to staff.

---

## 1. Data controller & Firebase project ownership

- [ ] **The school is the data controller** for all pupil and staff data stored in Classroom Hub.
      Individual teachers are not controllers — the school carries the legal obligation.
- [ ] **The Firebase project must be owned by a school Google account** (e.g. a shared IT or
      admin address on the school's domain), not a personal teacher account. Transferring ownership
      later is possible but laborious; settle this before rollout.
- [ ] Confirm at least two people at the school have Owner-level access to the Firebase Console so
      there is no single point of failure.

---

## 2. Data minimisation

- [ ] Review what is actually stored per pupil. The app currently supports free-text fields
      (names, behaviour notes, assessment comments). Ask: does the display need a full name, or
      would initials suffice for on-screen use?
- [ ] Agree a staff convention: e.g. use first name + last initial in the roster rather than full
      legal names, unless a process genuinely needs the full name.
- [ ] Avoid entering special-category data (medical conditions, SEN detail, safeguarding notes) in
      free-text behaviour or assessment fields. Those belong in your MIS, not a planner app.

---

## 3. Retention & erasure

- [ ] **Year-end wipe:** at the end of each academic year, each teacher should export then delete
      their class data. The app's per-account export + wipe mechanism is the intended route. Agree
      who checks this has happened (e.g. IT coordinator runs a reminder in July).
- [ ] **Erasure requests:** if a parent or pupil exercises their right to erasure, identify which
      teacher account(s) hold data for that child, use the per-account export to confirm scope,
      then wipe. Document the action in your erasure log.
- [ ] **Leavers:** when a teacher leaves the school, their Firebase account should be disabled or
      deleted in the Firebase Console (Authentication → Users). Their data path in the Realtime
      Database should be deleted separately (the two are not linked automatically).
- [ ] Confirm a written retention schedule covers this app (e.g. "class data deleted within one
      month of academic year end").

---

## 4. Access control as a privacy control

The recent multi-user work delivers these privacy properties — note them in your risk register:

- **Session clear on sign-out:** signing out (or using Switch teacher) wipes the local session and
  in-memory class data, so the next person to open the app on the device cannot see a previous
  teacher's pupils.
- **No cross-account data leakage:** Firebase security rules restrict each teacher to reading and
  writing only their own data path (`users/{uid}/…`). A teacher cannot query another teacher's
  class even with a valid login.
- **No auto-seed on shared devices:** if a device already holds class data from account A and
  account B signs in, the app prompts rather than silently copying A's data into B's account.

> These are technical controls, not substitutes for policy. They reduce risk but do not remove the
> need for training staff on appropriate use.

---

## 5. Sub-processor: Google / Firebase

- [ ] Google LLC (trading as Firebase) is a **data processor** for this app. Add Google to your
      school's Data Processing Agreement (DPA) register. Google's standard processor terms are
      accepted when you create a Firebase project — confirm this is in your records.
- [ ] **Data residency:** the Realtime Database is configured for **europe-west1 (Belgium)**. This
      is within the EU/EEA and is UK-appropriate under the UK GDPR adequacy framework as it
      currently stands. **Do not move the database to a non-EEA region** without a fresh adequacy
      or transfer-mechanism assessment.
- [ ] Mention Firebase/Google as a sub-processor in your school's privacy notice (the one you
      publish to parents) if this app processes any pupil data.

---

## 6. Authorised domains (Firebase Authentication)

- [ ] In the Firebase Console go to **Authentication → Settings → Authorised domains**.
- [ ] The list should contain **only** your school's real hosting domain(s) (e.g.
      `theteepeenetwork.github.io` or your own domain). Remove any stray or test entries before
      going live — each authorised domain is a potential phishing surface.
- [ ] `localhost` is allowed by default for development; ensure it is removed or understood to be
      a local-only entry before staff use the live URL.

---

## 7. Human action items — things no code can do for you

The following must be completed by a person at the school. They are not automated.

- [ ] Transfer (or re-create) the Firebase project under a school-owned Google account.
- [ ] Add at least one backup Owner to the Firebase project.
- [ ] Lock Authorised domains to the school's live host(s); remove stray domains.
- [ ] Register Google/Firebase as a sub-processor in your DPA register.
- [ ] Update the school privacy notice to mention Firebase as a sub-processor.
- [ ] Write (or update) a retention schedule that explicitly covers this app.
- [ ] Decide and document your data-minimisation convention (initials vs full names, etc.).
- [ ] Schedule a year-end wipe reminder for all teachers using the app.
- [ ] Establish a process for disabling/deleting Firebase accounts when teachers leave.
- [ ] Confirm the DPO (or equivalent) has reviewed this checklist and signed off rollout.

---

*Last updated: June 2026. Review annually or whenever the app's data handling changes materially.*
