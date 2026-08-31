# Fund Tracker — Android app

A Capacitor-wrapped Android app for tracking a small group's monthly
contributions, dues, and expenses. The UI is the same passbook-style
tracker as before; data is now stored **on-device** (via Capacitor's
Preferences plugin) instead of in Claude's artifact storage, since a
real APK has no connection back to Claude.

**This means: each phone that installs the app keeps its own separate
data.** It's built for one person (e.g. the treasurer) to track the
group's fund on their own phone — not for every friend's phone to
stay in sync automatically. If you want everyone's app to show the
same live ledger, that needs a real backend (e.g. Firebase) added on
top — happy to help with that as a follow-up if you want it.

## Why you're building this yourself

Compiling an Android APK requires the Android SDK and Gradle, both of
which are downloaded from Google's and Gradle's servers. The
sandbox this project was generated in only has access to a small
allow-list of domains (npm, PyPI, GitHub, etc.) and can't reach
those, so the actual compile step has to happen somewhere with full
internet access — either GitHub's free build servers, or your own
computer.

## Option A — Build in the cloud with GitHub Actions (no installs needed)

This is the easiest path. You only need a free GitHub account.

1. Go to [github.com/new](https://github.com/new) and create a new
   **public or private** repository (any name, e.g. `fund-tracker`).
2. On your computer, unzip this project, then in a terminal:
   ```
   cd fund-tracker-app
   git init
   git add .
   git commit -m "Fund Tracker app"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
   (No `git` or terminal experience? GitHub also lets you drag-and-drop
   the unzipped folder's contents into the repo via the "Add file →
   Upload files" button on the repo's web page.)
3. Once pushed, click the **Actions** tab on your GitHub repo. A
   workflow called "Build APK" will already be running (it starts
   automatically on push). It takes about 3–5 minutes.
4. When it finishes, click into the completed run, scroll to
   **Artifacts**, and download `fund-tracker-debug-apk`. Unzip it —
   inside is `app-debug.apk`.
5. Transfer that `.apk` file to your Android phone (email it to
   yourself, use a cloud drive, or a USB cable) and tap it to install.
   Android will warn about installing from an unknown source — that's
   expected for an app not from the Play Store; you'll need to allow
   it in the prompt it shows.

## Option B — Build locally with Android Studio

Use this if you'd rather not use GitHub, or want to open the project
in an IDE.

1. Install [Android Studio](https://developer.android.com/studio)
   (it bundles the Android SDK — first launch will walk you through
   the setup).
2. Unzip this project, then open the `android/` folder in Android
   Studio (**File → Open**, select the `android` folder specifically,
   not the project root).
3. Let it sync (first sync can take several minutes while it
   downloads Gradle and SDK components).
4. Click **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
5. When it finishes, click the **locate** link in the notification to
   find `app-debug.apk`, or look in
   `android/app/build/outputs/apk/debug/`.
6. Transfer it to your phone as described in Option A step 5, or
   connect your phone via USB with Developer Mode + USB debugging
   enabled and click the green **Run** button in Android Studio to
   install it directly.

## Making changes to the app later

The source lives in `src/App.jsx` (plus `src/storage.js` for the
on-device storage). After editing:

```
npm install        # first time only
npx vite build      # rebuilds the web bundle into dist/
npx cap sync android # copies the new build into the native project
```

Then rebuild the APK using either option above.

## About the debug APK

The APK produced here is a **debug build** — perfectly fine to
install and use on your own phone, but it's signed with a generic
debug key, not meant for the Play Store. If you ever want to publish
this on the Play Store or share a "release" build, that needs a
proper signing key and a couple of extra config steps — ask if you'd
like help setting that up.

## App details

- Package name: `com.friendsgroup.fundtracker`
- App name: Fund Tracker
- Default currency: ₹ (change anytime in the app's Settings screen)
- Default monthly due: ₹500 per member (also editable in Settings)
