# Building and shipping iOS from GitHub Actions (no Mac)

Two workflows:

| Workflow | Trigger | Secrets | What it does |
|---|---|---|---|
| `.github/workflows/ios-build.yml` | push/PR touching `ios/`, `www/`, deps | none | Compiles for the simulator, signing off. Catches build breakage. |
| `.github/workflows/ios-release.yml` | manual (Actions → Run workflow) | see below | Archives a signed `.ipa` and uploads it to TestFlight / App Store Connect. |

The build check works right now with no setup. Everything below is for the
release workflow.

**All of it can be done from Windows or Linux.** Apple's *toolchain* needs
macOS, but the GitHub runner provides that; the *account setup* is a web UI
plus openssl. You never have to touch a Mac.

---

## 1. Create the distribution certificate

A certificate is normally made by Keychain Access on a Mac. All Keychain
actually does is generate a keypair and a CSR, which openssl does too. On
Windows use Git Bash (ships with Git for Windows) or WSL.

```bash
# Private key — this is the irreplaceable part. Treat it like the Android keystore.
openssl genrsa -out dist.key 2048

# Certificate signing request. Use your real name and the Apple ID email.
openssl req -new -key dist.key -out dist.csr \
  -subj "/emailAddress=doolittle.thomas@gmail.com/CN=Thomas Doolittle/C=US"
```

In [developer.apple.com → Certificates](https://developer.apple.com/account/resources/certificates/list):
**+** → **Apple Distribution** → upload `dist.csr` → download `distribution.cer`.

Bundle the cert and key into a `.p12`:

```bash
openssl x509 -in distribution.cer -inform DER -out dist.pem -outform PEM
openssl pkcs12 -export -legacy \
  -inkey dist.key -in dist.pem -out dist.p12 \
  -passout pass:CHOOSE_A_PASSWORD
```

`-legacy` is not optional. OpenSSL 3 defaults to AES-encrypted PKCS#12, which
macOS `security import` rejects with a vague `MAC verification failed` — the
error blames the password, but the cause is the cipher.

> Apple allows **3 distribution certificates** per account, total. This is why
> the workflow uses manual signing: `-allowProvisioningUpdates` would mint a
> fresh one on every ephemeral runner and you would hit the cap in three runs.

## 2. Register the App ID

[Identifiers](https://developer.apple.com/account/resources/identifiers/list) →
**+** → **App IDs** → **App** → Bundle ID `com.tjdoolittle.verseadvocate`,
explicit. No capabilities needed — the app has no push, no sign-in, no
entitlements of any kind.

## 3. Create the provisioning profile

[Profiles](https://developer.apple.com/account/resources/profiles/list) → **+** →
**App Store Connect** (under Distribution) → pick the App ID from step 2 → pick
the certificate from step 1 → name it something stable like
`Verse and Advocate App Store` → download the `.mobileprovision`.

The workflow reads the profile's name out of the file itself, so you don't have
to tell it the name — but keep the name stable anyway, it makes logs readable.

> Profiles **expire after one year**. When a release run fails on signing a year
> from now, this is why: regenerate it here and update the secret.

## 4. Create an App Store Connect API key

[App Store Connect → Users and Access → Integrations → App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api)
→ **+** → role **App Manager** → download `AuthKey_XXXXXXXXXX.p8`.

**The .p8 downloads exactly once.** Save it before closing the page. Note the
**Key ID** and, at the top of the page, the **Issuer ID**.

App Manager is sufficient — the key is only used to upload builds, not to
create certificates.

## 5. Create the app record

In App Store Connect, **Apps → +** → New App, with the same bundle ID. Then
**App Information** → copy the **Apple ID** (a ~10-digit number, not your email).
That number is `APPSTORE_APP_ID`; `altool` needs it to route the upload.

Your Team ID is on the [Membership](https://developer.apple.com/account#MembershipDetailsCard)
page — 10 characters, like `A1B2C3D4E5`.

## 6. Base64 the three files

Secrets have to be text. On Windows PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("dist.p12"))                | Set-Clipboard
[Convert]::ToBase64String([IO.File]::ReadAllBytes("profile.mobileprovision")) | Set-Clipboard
[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_XXXXXXXXXX.p8"))   | Set-Clipboard
```

On Linux/macOS: `base64 -w0 dist.p12` (drop `-w0` on macOS).

## 7. Add the secrets

Repo → Settings → Secrets and variables → Actions → New repository secret.

| Secret | Value |
|---|---|
| `APPLE_TEAM_ID` | 10-char team id from Membership |
| `APPLE_DIST_CERT_P12` | base64 of `dist.p12` |
| `APPLE_DIST_CERT_PASSWORD` | the password from step 1 |
| `APPLE_PROVISIONING_PROFILE` | base64 of the `.mobileprovision` |
| `APPSTORE_API_KEY_ID` | Key ID from step 4 |
| `APPSTORE_API_ISSUER_ID` | Issuer ID from step 4 |
| `APPSTORE_API_PRIVATE_KEY` | base64 of the `.p8` |
| `APPSTORE_APP_ID` | numeric Apple ID from step 5 |

Or with the `gh` CLI:

```powershell
gh secret set APPLE_TEAM_ID --body "A1B2C3D4E5"
gh secret set APPLE_DIST_CERT_P12 --body (Get-Content dist.p12.b64 -Raw)
```

---

## Running a release

Actions → **iOS release** → Run workflow:

- **marketing_version** — blank keeps the project's `1.1`. Bump for a
  user-visible release.
- **build_number** — blank uses the workflow run number, which always
  increments. App Store Connect rejects a build number it has seen before, and
  this is the usual cause of a failed upload.
- **upload** — untick to get a signed `.ipa` as a run artifact without sending
  it to Apple. Good for the first run.

The `.ipa` is attached to every run as an artifact either way, so a failed
upload never means a lost build.

TestFlight processing takes 10–30 minutes after upload. Then submit for review
in App Store Connect: listing copy from `store-listing/descriptions.md`,
screenshots `ios-iphone69-*` and `ios-ipad13-*`, App Privacy → **Data Not
Collected**. Review takes ~1–3 days.

## Cost

This repo is private, and macOS runners bill at a **10× minute multiplier**. The
2,000 included minutes on the Free plan work out to **200 macOS minutes/month**
— roughly 20–40 runs, since a build check is ~5 min and a release ~10 min.

The build check is path-filtered so it only runs when `ios/`, `www/`, or the
dependencies change. If minutes get tight, drop its `push`/`pull_request`
triggers and leave it on `workflow_dispatch`. Making the repo public removes
the billing entirely — nothing in it is secret, since the keystore and signing
material are gitignored.

## Back up these two things

Losing either means you can never update the published apps:

1. `verse-advocate.keystore` + its password — Android, as the README says.
2. `dist.key` / `dist.p12` + its password — iOS. The certificate is
   replaceable (revoke and reissue, 3-cert cap permitting), but keeping the key
   means never rebuilding this setup.

Neither is in the repo. Put both in a password manager or an encrypted backup.
