# EAS credential portability

SoRita no longer depends on a workstation-specific `credentials.json`, keystore,
provisioning profile, or root-level `AuthKey_*.p8` path. All EAS build profiles
use `credentialsSource: remote`; production builds also use
`--freeze-credentials`, so non-interactive CI cannot silently create or replace
a signing identity.

The protected GitHub `production` environment owns the iOS delivery boundary.
It must require reviewers and expose these secret names (never their values):

- `EXPO_TOKEN`
- `EXPO_ASC_API_KEY_BASE64` (canonical single-line base64 of the PKCS#8 `.p8`)
- `EXPO_ASC_KEY_ID`
- `EXPO_ASC_ISSUER_ID`

Public runtime values remain GitHub environment variables. The tracked App Store
app/team identifiers and `com.cayan.sorita.socialmap` bundle identifier are
non-secret routing identity; changing them is a separate reviewed migration.

`.github/workflows/eas-production-ios.yml` can run only through
`workflow_dispatch` from the default branch. The requested lower-case full SHA
must equal both `github.sha` and the checked-out commit. The workflow:

1. validates the protected key as an EC P-256 PKCS#8 key without printing it;
2. immediately erases the preflight copy;
3. asks EAS Build for a production iOS store build using frozen remote signing
   credentials;
4. verifies the provider build ID, EAS project, source SHA, runtime, channel and
   bundle identifier before submission;
5. rematerializes the App Store Connect key under `RUNNER_TEMP` with mode `0600`,
   submits that exact build ID to TestFlight, and erases the file through both an
   exit trap and an `always()` cleanup step; and
6. uploads only a sanitized same-SHA receipt. Raw provider responses, artifact
   URLs and credential material are never uploaded.

Run `npm run eas:credentials:check` before release. Rotation means replacing the
three ASC secrets in the protected environment, verifying the key's least-
privilege App Store Connect role, running the guard, and revoking the prior key
after a successful protected submission. A failed run is safe to retry: EAS
build credentials remain remote and the ephemeral submit file is deleted on
success, failure, interruption, and the defensive cleanup step.
