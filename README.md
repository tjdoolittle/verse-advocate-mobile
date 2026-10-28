# Verse & Advocate — Capacitor wrapper

Native app wrapper around the static web app in
[verse-advocate](https://github.com/tjdoolittle/verse-advocate).
App id: `com.tjdoolittle.verseadvocate` (same on both platforms).

## ⚠ Signing material is NOT in this repo

`verse-advocate.keystore` and `android/keystore.properties` are gitignored,
because a keystore plus its plaintext password does not belong in version
control. They are therefore **not backed up by this repo** — keep the keystore
somewhere durable (encrypted backup / password manager). If it is lost, the
Play Store listing can never be updated again; a new app id would be required.

## Store assets

`store-listing/` holds everything both stores ask for: app icon, Play feature
graphic, listing copy, and screenshots at every required size — Android phone,
7" and 10" tablet, Chromebook, plus 6.9" iPhone and 13" iPad for the App Store.

## First-time setup on a new machine (Mac or Windows)

Everything works straight from this repo — no sibling checkouts, no manual
file copying.

```
git clone https://github.com/tjdoolittle/verse-advocate-mobile.git
cd verse-advocate-mobile
npm install
npm run sync        # pulls latest web app into www/, then cap sync
```

On macOS also mark the Gradle wrapper executable if git didn't:
`chmod +x android/gradlew`

## Updating the app after web changes

`npm run sync` downloads the current web app from the public
[verse-advocate](https://github.com/tjdoolittle/verse-advocate) repo into
`www/` and syncs both native projects. Variants: `sync:web` (download only),
`sync:ios`, `sync:android`.

The NET Bible files are never fetched — that translation is licensed for
non-commercial use only and is not redistributed.

## Debug build (sideload / testing)

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
cd android
.\gradlew.bat assembleDebug
```

APK lands at `android\app\build\outputs\apk\debug\app-debug.apk`.
Copy to a phone and open it (enable "install unknown apps"), or with a phone
plugged in over USB debugging: `adb install app-debug.apk`.

## Release build for the Play Store

1. One-time: create a signing keystore (keep it safe — losing it means you can
   never update the app):

   ```powershell
   & "$env:JAVA_HOME\bin\keytool.exe" -genkey -v -keystore verse-advocate.keystore -alias verseadvocate -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Configure signing in `android\app\build.gradle` (`signingConfigs` block) or
   via Android Studio: Build → Generate Signed App Bundle.

3. Build the bundle: `.\gradlew.bat bundleRelease` →
   `android\app\build\outputs\bundle\release\app-release.aab`

4. Upload the `.aab` in the [Play Console](https://play.google.com/console)
   ($25 one-time developer registration). You'll need store listing assets:
   screenshots, a 512×512 icon (`assets/icon.png` scaled), feature graphic,
   privacy policy URL (the app sends no data anywhere — a one-line policy works).

## iOS

The `ios/` project is already scaffolded, with icons, splash screens, and all
web assets in place. Bundle id and display name match Android; version is 1.1
(build 2). Capacitor 8 uses Swift Package Manager, so there is no CocoaPods
step and no `pod install` to run.

You need an Apple Developer account ($99/yr) either way. You do **not** need a
Mac — GitHub Actions supplies one.

### Building in CI (the normal path)

| Workflow | Trigger | What it does |
|---|---|---|
| `iOS build check` | push/PR touching `ios/`, `www/`, deps | Compiles for the simulator, signing off. No secrets needed — works today. |
| `iOS release` | Actions → Run workflow | Archives a signed `.ipa`, uploads it to TestFlight. |

Releases need eight repository secrets (certificate, provisioning profile, App
Store Connect API key, team and app ids). Creating all of them is a web UI plus
`openssl`, doable from Windows: **[docs/ios-ci-setup.md](docs/ios-ci-setup.md)**.

Signing is deliberately *manual* rather than Xcode-automatic. Automatic signing
on a throwaway runner asks Apple for a new distribution certificate every run,
and Apple caps you at three.

Note that this repo is private, so macOS runner minutes bill at a 10×
multiplier — about 200 macOS minutes/month on the Free plan. The build check is
path-filtered to stay inside that.

### On a Mac (optional)

Still worth doing once if you want to drive the app in a simulator, which CI
cannot do for you.

`ios/App/App/public` (the copy of `www/` that ships in the bundle) is
gitignored and generated, so `cap sync` is not optional after a fresh clone —
without it the app builds and launches to a blank screen.

```bash
git clone https://github.com/tjdoolittle/verse-advocate-mobile.git
cd verse-advocate-mobile
npm install
npm run sync:ios      # refreshes www/, then copies it into the iOS bundle
npm run open:ios      # opens ios/App/App.xcodeproj in Xcode
```

1. App target → Signing & Capabilities → check "Automatically manage signing"
   and pick your Team. (Local only — CI signs manually, for the reason above.)
2. Run on a simulator or device to smoke-test. Check that search returns
   results, "Copy for your argument" pastes correctly, and all three
   translations load — the Bible JSON is bundled, so this works in airplane mode.

Archiving by hand is the fallback if CI is unavailable: Product → Destination →
"Any iOS Device", then Product → Archive → Distribute App → App Store Connect.

### Submitting in App Store Connect

Needed once, whichever way the build was produced:

1. Create the app record with the same bundle id, and fill the listing from
   `store-listing/descriptions.md`, the privacy policy URL, and the ready-made
   `ios-iphone69-*` (1320×2868) and `ios-ipad13-*` (2064×2752) screenshots.
2. App Privacy: answer "Data Not Collected" — the app makes no network calls
   at all. Age rating: no objectionable content, though the questionnaire's
   "Religious content" style questions apply if asked.
3. Copy the numeric Apple ID from App Information into the `APPSTORE_APP_ID`
   secret, which the release workflow needs to route uploads.

Export compliance is already declared in `Info.plist`
(`ITSAppUsesNonExemptEncryption = false`), so App Store Connect will not ask
the encryption question on each upload.

Apple review takes ~1-3 days and has no equivalent of Google's 12-tester rule.

### Updating the web assets

```bash
npm run sync:ios
```

That downloads the current web app from the public repo and copies it into the
iOS bundle — no sibling checkout needed. Commit the resulting `www/` change:
CI builds from what is committed rather than re-downloading, so a release is
reproducible from its commit.

App Store Connect rejects a build number it has already seen. The `iOS release`
workflow handles this by defaulting the build number to the workflow run
number; only bump `MARKETING_VERSION` when you want a new user-visible version,
either in Xcode's General tab or via the workflow's `marketing_version` input.

## Icons / splash

Masters live in `assets/` (icon.png 1024², splash.png 2732²), generated by a
Pillow script. Regenerate platform assets with:

```powershell
npx @capacitor/assets generate --android
npx @capacitor/assets generate --ios
```
