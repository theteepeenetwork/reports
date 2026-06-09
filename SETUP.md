# Turn on login + multi-device sync (Firebase)

Classroom Hub works fully offline with no account. To log in on several devices and have **Glow Getters
points sync instantly** (award on your iPad → it shows on the smartboard laptop in ~1 second), connect a
free Firebase project. ~10 minutes, one-time.

> The app only syncs once you've done steps 1–4. Until then it stays exactly as it is now (local only).

## 1. Create a Firebase project
1. Go to **https://console.firebase.google.com** and sign in with a Google account.
2. Click **Add project** → name it (e.g. `classroom-hub`) → you can disable Google Analytics → **Create**.

## 2. Add a Web app and copy the config
1. On the project home, click the **`</>` (Web)** icon to "Add an app".
2. Give it a nickname → **Register app**.
3. Firebase shows a `const firebaseConfig = { … }` snippet. **Copy the values.**
4. Open **`firebase-config.js`** in this project and paste your values over the `PASTE_…` placeholders.
   Make sure **`databaseURL`** is included (see step 3 for it).

## 3. Create the Realtime Database
1. Left menu → **Build → Realtime Database** → **Create Database**.
2. Pick a location → start in **Locked mode** → **Enable**.
3. Copy the database URL shown at the top (looks like `https://your-project-default-rtdb.firebaseio.com`)
   into `databaseURL` in `firebase-config.js`.
4. Open the **Rules** tab and paste the contents of **`firebase-rules.json`**, then **Publish**.
   (These rules let each teacher read/write only their own data.)

## 4. Turn on Email/Password login
1. Left menu → **Build → Authentication → Get started**.
2. **Sign-in method** tab → **Email/Password** → **Enable** → **Save**.

## 5. Host it online & add your domain
Login/sync need the app served over **https** (not opened from a file).
1. Host `index.html` (and the whole folder) anywhere static — e.g. **GitHub Pages**, which you already use.
2. In Firebase: **Authentication → Settings → Authorized domains → Add domain**, and add your site's
   domain (e.g. `theteepeenetwork.github.io`). `localhost` is allowed by default for testing.

## Done — how to use it
- Open the planner; a **Sign in to sync** box appears. **Register** once, then **Sign in** on every device
  with the same email/password.
- The status chip (top bar) shows your account when synced. Click it to sign out.
- Launch **Glow Getters** on the smartboard's browser (same one you signed in on) — it shares the login and
  updates live as you award points from another device.
- First sign-in on a device with an existing class asks whether to use the **account's** data or upload
  **this device's** data — pick once and you're set.

### Notes
- `firebase-config.js` is safe to commit — a Firebase **web** config is public; your data is protected by the
  rules in `firebase-rules.json`.
- Offline still works: changes queue locally and sync up when the device reconnects.
