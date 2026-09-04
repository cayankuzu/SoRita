# SoRita — Docker Quality Environment

- Candidate commit: `b8c8dd9bc822d4d66f55befcbde88ecb38704c3c`
- Date: 2026-09-03
- Verified on: Docker 29.6.2, Supabase CLI 2.116.0, Windows host

## What Docker is for here, and what it is not for

Docker provides a repeatable backend and tooling verification environment. It
does not build, run or sign the mobile application.

| Used for | Not used for |
|---|---|
| Supabase local stack, migration replay, DB lint | Running the React Native app |
| pgTAP RLS and IDOR suites | Android emulator or iOS simulator |
| Dump and isolated restore drills | Signed AAB or IPA production builds |
| Worker contract tests and type checks | Deploying the production Worker |
| Deterministic Maps mocking | Any call to a paid Maps provider |
| Fault injection and bounded load | Docker-in-Docker |

iOS archives require macOS. Android release builds stay on the existing Gradle
and EAS chain. Docker results are never presented as native artifact evidence.

## A defect this pass found and fixed

The Docker layer was **completely non-functional on this branch** before this
pass, and no gate caught it.

All three ignore files carried a stray diff marker, `+!App.tsx`. Docker reads
that as a literal pattern, so the re-include never applied, the leading `**` deny
kept the file out of the context, and every image build failed at the `COPY` of
`App.tsx`. The CI workflow did not catch it because it was running the profile
variant that skips the database, and the context guard only checked a fixed list
of patterns that happened not to include this one.

Three changes were made:

1. The stray marker was removed from all three ignore files.
2. `check-docker-context.mjs` now rejects any ignore line starting with `+` or
   `-` as a diff artifact.
3. The same guard now derives its expectations from the Dockerfile: every
   build-context `COPY` source must be re-included by every ignore file.

The third check is the durable one, because it cannot go stale. Adding a `COPY`
without an ignore entry now fails the guard instead of failing the build later
inside BuildKit. Both checks were verified by reintroducing the bug and observing
a failure, then restoring and observing a pass.

## Topology

There is one Docker stack, at `infra/docker/`, and one root-level alias:

```text
compose.quality.yml          # include: infra/docker/compose.yaml
infra/docker/
  compose.yaml               # all profiles
  Dockerfile.tooling         # one multi-stage image for every runner
  Dockerfile.tooling.dockerignore
  .dockerignore
  mocks/maps-server.mjs      # deterministic geocoding contract mock
  load/representative-flows.k6.js
  scripts/                   # profile drivers, invoked through npm
```

A second parallel `docker/` and `scripts/docker/` tree was **not** created. It
would duplicate the same profiles under different names, and two definitions of
one stack is the failure mode the brief's KISS rule exists to prevent. The root
`compose.quality.yml` provides the expected entry point without a second copy.

The npm scripts are the cross-platform wrappers. They are Node, not shell, so
Windows and Linux run identical logic rather than two divergent scripts.

## Profiles

| Profile | Purpose |
|---|---|
| `quality` | typecheck, lint, format, unit and integration, feature freeze |
| `worker` | Worker type check, lint and contract tests |
| `db-tools` | pinned `psql`, `pg_dump`, `pg_restore` |
| `load` | k6 |
| `security` | container security contracts |
| `test` | worker and Maps contract profile, plus Supabase validation |
| `maps-mock` | deterministic geocoding responses |
| `resilience` | Toxiproxy fault injection |

## Commands

| Command | Action |
|---|---|
| `npm run docker:build` | Build the tooling image |
| `npm run docker:config` | Validate ignore, Compose and security contracts |
| `npm run docker:test` | Full profile: containers plus Supabase validation |
| `npm run docker:quality` | Root quality gates in the immutable image |
| `npm run docker:worker` | Container contract profile without the database |
| `npm run docker:supabase:start` | Start the isolated Supabase stack |
| `npm run docker:supabase:test` | Reset, lint, pgTAP |
| `npm run docker:supabase:restore` | Dump and isolated restore drill |
| `npm run docker:load:smoke` | Bounded k6 smoke |
| `npm run docker:load:staged` | Staged k6 profile |
| `npm run docker:security` | Container security contracts |
| `npm run docker:verify` | Full verification sweep |
| `npm run docker:clean` | Remove test volumes, requires explicit confirmation |

## Container hardening

Every runner inherits one hardened anchor in `compose.yaml`:

| Setting | Value |
|---|---|
| Base image | `node:24.18.0-bookworm-slim`, pinned by SHA-256 digest |
| Build | multi-stage, dependencies separate from tooling |
| User | non-root, `1000:1000` |
| Filesystem | `read_only: true` |
| Writable space | `tmpfs` on `/tmp`, `noexec,nosuid,nodev`, 64 MB |
| Capabilities | `cap_drop: ALL` |
| Privilege escalation | `no-new-privileges:true` |
| Limits | 128 PIDs, 768 MB memory, 1.5 CPUs |
| Network | internal only, no published ports |
| Docker socket | not mounted |
| Privileged mode | not used |

Credentials are denied by the ignore contract itself. The context starts from a
full deny and re-includes named paths, and credential patterns are additionally
denied even inside allowed directories.

## Verified result on this commit

`npm run docker:test` was executed on this machine and exited 0.

| Stage | Result |
|---|---|
| Ignore, Compose and security contracts | pass |
| Image build | succeeded after the context fix |
| Worker contract tests in-container | 34 passed across 3 files |
| Supabase local stack start | healthy |
| Migration replay on a clean database | all migrations applied |
| DB lint at error level | no schema errors |
| pgTAP suites | 180 passed across 6 files |
| Dump and isolated restore | pass |
| Post-restore parity | 22 tables, 70 routines, 50 RLS policies, 3 buckets |
| Teardown | stack stopped, no orphan volumes |

The six pgTAP suites are account deletion and moderation retention, Cloudflare
origin security, media upload session security, moderation ops security, push
delivery hardening, and RLS and security.

## Image attestation and what the digests actually mean

The Docker workflow builds the tooling image twice: once as an OCI export
carrying provenance and SBOM attestations, and once with `--load` so the test
profiles have an image in the local daemon.

It is tempting to compare a digest across those two builds and call it a
reproducibility proof. **Nothing is comparable across that boundary.** All three
candidates were measured on a real build:

| Candidate | OCI export side | Loaded side | Comparable? |
|---|---|---|---|
| Image config digest | `ba421644…` from the image manifest | `docker image inspect .Id` returns `78e3ebda…` | No. The daemon recomputes the config on import. |
| Rootfs layers | 30 `diff_ids` in the OCI config | 30 entries in `RootFS.Layers` | No. Only the base-image layers match; the daemon re-tars built layers on import. |
| `containerimage.digest` | index digest including attestations | index digest without them | No. Two different indexes by construction. |

A check comparing any of these would either fail on a perfectly correct build,
or be rewritten until it passed and then prove nothing. Both outcomes are worse
than not having the check.

`record-image-build-evidence.mjs` therefore records the verifiable facts and
states the limitation in the artifact itself:

**Proves**

- the attested build produced full SLSA v1 provenance;
- the attested build produced an SPDX SBOM;
- the loaded image carries the candidate commit as its revision label, so the
  image the test profiles run against is the image built from this commit.

**Does not prove**

- rebuild determinism. No second independent build is compared, so a
  non-deterministic build step would not be detected here.

Closing that gap honestly requires two independent builds of the **same** output
type, with the build cache cold, and comparing their image config digests. That
costs a second full uncached build in CI and has not been adopted for that
reason. It is recorded as an open gate rather than papered over.

### Attestation format notes

Two BuildKit behaviours cost real debugging time and are worth stating:

- `docker buildx build --output type=oci` nests the real manifest list one level
  below `index.json`. Code that assumes a flat layout finds no attestations.
- Current BuildKit emits in-toto Statement **v1**, and an unnamed OCI export
  carries an **empty** `subject` list. The image binding comes from the
  attestation manifest's `vnd.docker.reference.digest` annotation, not from the
  statement subject.


## CI parity

`.github/workflows/docker-validation.yml` now runs `npm run docker:test`, so the
database half of the profile executes in CI rather than being skipped. The
workflow also runs hadolint, Trivy with HIGH and CRITICAL as failures, SBOM
generation, provenance attestation extraction and an image reproducibility check,
and it emits checksum-bound evidence tagged with the commit SHA.

## Limits of this evidence

The Docker lane proves the schema, policies, contracts and tooling are correct on
a clean database. It does not prove anything about the hosted Supabase project,
the deployed Worker, signed binaries or real devices. Those remain open and are
listed in [MANUAL_STEPS.md](./MANUAL_STEPS.md).
