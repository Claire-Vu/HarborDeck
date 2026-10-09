# Releasing Harbor Deck

A release is a version tag. `.github/workflows/release.yml` builds the macOS app for Apple Silicon and Intel and uploads to a **draft** GitHub release:

| File | For |
|---|---|
| `Harbor-Deck-<version>-arm64.dmg`, `Harbor-Deck-<version>-x64.dmg` | people downloading the app |
| `Harbor-Deck-<version>-<arch>-mac.zip` + `.blockmap` | the in-app updater |
| `latest-mac.yml` | the in-app updater: newest version, file names, checksums |

## Cut a release

1. Bump `version` in `package.json` (and `package-lock.json`: `npm version 0.2.0 --no-git-tag-version`), commit, merge.
2. Tag the merge commit and push the tag: `git tag v0.2.0 && git push origin v0.2.0`. The workflow fails if the tag is not `v` + the `package.json` version.
3. When the workflow finishes, open the draft under GitHub > Releases, write the notes, and **Publish**. Running apps only see published releases.

Local builds: `npm run dist` (just `dist/mac-arm64/Harbor Deck.app`, as before), `npm run dist:dmg` (dmg + zip for this Mac). `npm run release:adhoc` is what the workflow runs without signing secrets; it uploads, so it needs `GH_TOKEN`.

## Unsigned builds (today)

`"identity": null` in `package.json` turns signing off for local builds. The workflow ad-hoc signs (`-c.mac.identity=- -c.mac.hardenedRuntime=false`) so Apple Silicon sees an intact signature instead of a "damaged" app. Without an Apple Developer ID:

- **First open**: macOS says it cannot verify the developer. The user opens it once with System Settings > Privacy & Security > **Open Anyway** (on macOS 14 and older, right-click > Open also works), or runs `xattr -dr com.apple.quarantine "/Applications/Harbor Deck.app"`.
- **Updates**: the app checks GitHub Releases 15 s after launch and every 6 hours (File/App menu > **Check for Updates…** checks now). Squirrel.Mac only installs an update whose signature matches the running app's by a Developer ID, which an ad-hoc build never has, so an unsigned build does not download anything: it shows "Harbor Deck X is out" with a **Download** button that opens the release page. The user replaces the app by hand (drag the new one into Applications). A signed build whose download or install fails falls back to the same link.
- A source checkout (`npm start`) never checks; it updates with git.

## Turning on signing and notarization

Needs a paid Apple Developer Program membership.

1. In the Apple Developer site, create a **Developer ID Application** certificate. Export it from Keychain Access as a `.p12` with a password.
2. In App Store Connect > Users and Access > Integrations > App Store Connect API, create a key with Developer access. Download `AuthKey_<id>.p8`; note the Key ID and the Issuer ID.
3. Add repository secrets (Settings > Secrets and variables > Actions):

   | Secret | Value |
   |---|---|
   | `MAC_CERTIFICATE_P12_BASE64` | `base64 -i cert.p12` |
   | `MAC_CERTIFICATE_PASSWORD` | the `.p12` password |
   | `APPLE_API_KEY_P8_BASE64` | `base64 -i AuthKey_<id>.p8` |
   | `APPLE_API_KEY_ID` | the Key ID |
   | `APPLE_API_ISSUER` | the Issuer ID |

4. In `package.json` > `build.mac`, delete `"identity": null` (electron-builder then finds the Developer ID from `CSC_LINK`). Keep `"hardenedRuntime": true`; notarization needs it.
5. Tag a release. With `MAC_CERTIFICATE_P12_BASE64` set the workflow runs `npm run release`: it signs with the Developer ID, notarizes with the API key (electron-builder notarizes whenever `APPLE_API_KEY`, `APPLE_API_KEY_ID` and `APPLE_API_ISSUER` are set) and staples the ticket.
6. Check the result on a Mac: `codesign -dv --verbose=2 "Harbor Deck.app"` lists `Authority=Developer ID Application: …`, and `spctl -a -vv "Harbor Deck.app"` says `accepted, source=Notarized Developer ID`.

From the first signed release on, that build updates itself in place ("Restart to update"). People on an older unsigned build still get the Download link once, then are on the signed line.
