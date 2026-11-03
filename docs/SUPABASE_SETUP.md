# WebGISTA v2 Supabase Setup

Phase 2A is migration-first and local by default. No hosted project is linked, no remote migration has been applied, and no credentials are stored in this repository.

## Requirements

- Supabase CLI 3.0.0 or a reviewed compatible newer version.
- A Docker-compatible container runtime for the standard local stack.
- Enough free disk space for the Supabase service images. Stop the stack when not in use on an 8 GB development machine.

The CLI may be installed globally or run as a pinned project tool. This repository does not add it to the preserved v1 or Phase 1 frontend dependency trees. Examples below use `npx` with an explicit version:

```sh
npx --yes supabase@3.0.0 --version
```

## Repository layout

```text
supabase/
├── config.toml
├── migrations/
│   ├── 20261103000100_phase_2a_schema.sql
│   └── 20261103000200_phase_2a_security.sql
└── tests/
    └── phase_2a_security.test.sql
```

The local configuration disables public sign-up, anonymous Auth users, Realtime, automatic table exposure, and seed execution. These are deliberate Phase 2A defaults, not a complete production Auth configuration.

## Reproduce locally

From the repository root:

```sh
npx --yes supabase@3.0.0 start
npx --yes supabase@3.0.0 db reset
npx --yes supabase@3.0.0 test db
```

`db reset` rebuilds the local database from the ordered migrations. `test db` runs pgTAP files transactionally and rolls their fixtures back. Stop the local services without deleting their data:

```sh
npx --yes supabase@3.0.0 stop
```

To discard only the local Supabase database after deliberately deciding it is safe:

```sh
npx --yes supabase@3.0.0 stop --no-backup
```

This command is destructive to the local Supabase development database. It does not target WebGISTA v1, but it should not be run casually.

## Migration workflow

1. Add a new timestamped SQL file; never edit a migration already applied to a shared environment.
2. Run `db reset` locally from an empty database.
3. Run `test db` and database linting.
4. Review generated schema changes and the allow/deny test matrix.
5. Link and push to a hosted development project only after explicit project-owner approval.
6. Apply production migrations separately after backup and review.

Commands with `--remote`, `link`, or `db push` are intentionally absent from the normal local workflow because they can affect hosted data. Phase 2A did not execute them.

## Local verification status

Performed on 2026-11-03:

| Check | Result |
|---|---|
| Read audit/architecture/migration documents | Completed before schema work. |
| Current CLI lookup | `npx --yes supabase@latest --version` returned `3.0.0`. |
| Current config generation | `supabase init --force` succeeded in a disposable directory; committed configuration uses the current format. |
| CLI command compatibility | `supabase test db --help` and `supabase db reset --help` succeeded. |
| Local runtime availability | Blocked: `docker`, `psql`, and a globally installed `supabase` command are unavailable. |
| Migration execution | Attempted with CLI 3.0.0; failed with `LocalDbRunningError: failed to inspect service` because no local stack was running. |
| pgTAP security suite | Attempted with CLI 3.0.0; failed to connect to `127.0.0.1:54322` (`ECONNREFUSED`). No passing security test is claimed. |
| Remote database operations | Not attempted. No project was linked. |

Before Phase 2B, run the reset and test commands on a machine with a container runtime. Treat any migration or pgTAP failure as a release blocker; do not work around an RLS failure in the frontend.

## GitHub Actions verification

`.github/workflows/phase2a-db-test.yml` avoids requiring Docker on the Apple M1 development machine by using `ubuntu-latest`, where GitHub provides the container runtime. The job:

1. checks out the repository with `contents: read` as its only token permission;
2. installs Supabase CLI 3.0.0 with `supabase/setup-cli@v3`;
3. runs `supabase db start`, which creates a temporary Postgres database and applies all migrations;
4. runs database linting for `public` and `private` functions;
5. runs the complete `phase_2a_security.test.sql` pgTAP suite;
6. always stops services and removes local CI volumes with `supabase stop --no-backup`.

It runs for relevant changes pushed to `feat/webgista-v2`, for pull requests that change the workflow or `supabase/**`, and by manual dispatch. It contains no project reference, access token, database password, link, push, deployment, or remote flag.

The workflow is prepared but has not yet run in GitHub Actions. Do not mark Phase 2A database verification complete until its `Migrations and pgTAP` job succeeds. The job log is the authoritative migration and test report.

To trigger it from the current `feat/webgista-v2` branch after reviewing the changes:

```sh
git add .github/workflows/phase2a-db-test.yml supabase docs/DATABASE_SCHEMA_V2.md docs/SECURITY_MODEL_V2.md docs/SUPABASE_SETUP.md
git commit -m "test: verify Phase 2A database policies in CI"
git push -u origin feat/webgista-v2
```

These commands are documentation only; Phase 2A verification preparation did not commit or push anything.

## Secrets

- Keep local secrets in ignored `supabase/.env` files or the provider's secret manager.
- The frontend may eventually receive only the Supabase project URL and public anon/publishable key.
- Never place database passwords, private camera credentials, JWT signing keys, or service-role keys in `apps/web/.env*`.
- Do not commit CLI login tokens or generated signing keys.

## Official references

- [Supabase CLI local development](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Supabase CLI configuration](https://supabase.com/docs/guides/local-development/cli/config)
- [Database testing and linting](https://supabase.com/docs/guides/local-development/cli/testing-and-linting)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

