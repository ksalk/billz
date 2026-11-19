# Billz

Billz is a self-hosted tracker for bills and recurring payments. It puts due
payments on a calendar, keeps a plain editable table of every bill, and records
what was actually paid or skipped.

> **Security note:** Billz currently has no authentication. Run it only on a
> trusted private network and never expose it to the internet. See
> [Security](#security).

## Features

- Month calendar with due tiles, overdue highlighting, and paid/skipped status.
- Bills table with add, edit, and delete.
- Structured schedules: one-off, every N weeks, every N months, quarterly,
  semi-annual, and every N years (interval 1–60).
- Month-end clamping: a bill anchored to the 31st is due on the last day of
  shorter months, including leap-year February.
- Mark an occurrence paid with a paid date and actual amount, skip it, or reset
  it to pending. Payment history stays visible after a schedule edit.
- Optional category and free-text notes per bill.
- Single currency configured for the deployment, with locale-aware formatting.
- One SQLite database file and one container; no external services or background
  jobs.

## Architecture

```text
SolidJS SPA (published assets)
          │  same-origin JSON
          ▼
ASP.NET Core Minimal API ── EF Core ── SQLite (/data/billz.db)
```

The API and built frontend are served by a single .NET process. Calendar
occurrences are computed on demand from each bill's schedule and sparse
payment rows; there are no scheduled jobs, pollers, or caches.

Dates are date-only values. The browser supplies its local "today" for overdue
display, and the server does not depend on a timezone. Money is stored as integer
minor units.

## Quick start with Docker

```bash
cp .env.example .env
# set BILLZ_CURRENCY in .env
# to reach Billz from other LAN devices, set BILLZ_BIND=0.0.0.0 and add the
# LAN hostname/IP to BILLZ_ALLOWED_HOSTS
docker compose up -d --build
```

Open `http://localhost:8080` (or the port in `BILLZ_PORT`). The published port
binds to `127.0.0.1` by default; Billz only becomes reachable from other devices
when `BILLZ_BIND` is explicitly widened to a trusted LAN interface.

The container runs as a non-root user with a read-only root filesystem when
deployed with the provided Compose stack. SQLite lives on the named volume
`billz-data` at `/data/billz.db`; deleting that volume deletes all bills and
payment history.

The Dockerfile supports `linux/amd64` and `linux/arm64` builds; CI builds,
smokes, and scans the amd64 image. A plain `docker build` produces a
host-architecture image only; use `docker buildx` for a multi-arch publish.

## Local development

Prerequisites: [mise](https://mise.jdx.dev/).

```bash
mise run setup
mise run dev
```

The API listens on `http://localhost:5080`; the Vite dev server runs on
`http://localhost:5173` and proxies `/api` to the API. Development uses the
`PLN` currency from `src/Billz.Api/appsettings.Development.json`; override it
with `Billz__Currency` if needed.

Useful tasks:

| Task | Purpose |
|---|---|
| `mise run lint` | .NET formatting, Biome, TypeScript |
| `mise run test` | xUnit and Vitest |
| `mise run test:e2e` | Build and run the Playwright journey against the published app |
| `mise run build` | Build the SPA and publish the API |
| `mise run verify` | Lint, test, build and end-to-end checks |
| `mise run docker-build` | Build the container image |
| `mise run verify:docker` | Clean-state Compose smoke test |
| `mise run format` | Apply formatting |

The end-to-end test starts the published app on port `5199` with a disposable
database, controls the browser clock, and covers add → edit → pay → delete plus
overdue/skip and mobile calendar flows.

## Container configuration

These variables are consumed by the Docker Compose stack.

| Variable | Purpose | Default |
|---|---|---|
| `BILLZ_CURRENCY` | ISO 4217 currency code | required |
| `BILLZ_BIND` | Host interface for the published port | `127.0.0.1` |
| `BILLZ_ALLOWED_HOSTS` | Accepted HTTP Host values, semicolon-separated | `localhost;127.0.0.1;[::1]` |
| `BILLZ_PORT` | Host port for Docker Compose | `8080` |
| `BILLZ_IMAGE` | Image name/tag for Compose | `billz:local` |
| `BILLZ_VOLUME_NAME` | Docker volume for SQLite | `billz-data` |

Copy `.env.example` to `.env` for local container use. Never commit `.env`.

When running the API directly instead of through Compose, use the standard .NET
configuration name `Billz__Currency`; Compose maps `BILLZ_CURRENCY` to it.
`Billz__DatabasePath` overrides the SQLite path.

## Data and backups

SQLite is the only datastore. Outside Docker the database defaults to the
platform's per-user data directory (`~/.local/share/billz/billz.db` on Linux);
set `Billz__DatabasePath` to an absolute path to override it. Relative paths
resolve against the application directory and are not recommended. The Docker
image uses `/data/billz.db` on the `billz-data` volume.

Do not deploy over the data directory. Back up while Billz is stopped. A copy of
`billz.db` alone can be stale because of WAL; copy `billz.db`, `billz.db-wal`,
and `billz.db-shm` together, or use SQLite's `VACUUM INTO` on a quiesced
database. Timestamps are stored in SQLite as UTC epoch milliseconds and returned
by the API as ISO 8601 strings.

Runtime migrations run automatically at startup. Do not run
`dotnet ef database update`; the design-time factory points at a throwaway file
and will not update the real database.

## Container operations

```bash
docker compose logs -f billz
docker compose restart billz
```

Upgrade by stopping the service, taking a backup, rebuilding, and starting it
again. Database migrations run automatically at startup. If you deploy a
registry image instead of building locally, pull the new tag before starting.

Back up the SQLite volume while the service is stopped. The volume name follows
`BILLZ_VOLUME_NAME` if you changed it:

```bash
mkdir -p backups
docker compose stop billz
docker run --rm \
  -v "${BILLZ_VOLUME_NAME:-billz-data}":/data \
  -v "$PWD/backups":/backup \
  alpine:3.22 tar czf /backup/billz-backup.tgz -C /data .
docker compose start billz
```

Restore only with the service stopped, replacing the volume contents from the
archive:

```bash
docker compose stop billz
docker run --rm \
  -v "${BILLZ_VOLUME_NAME:-billz-data}":/data \
  -v "$PWD/backups":/backup \
  alpine:3.22 sh -c 'rm -rf /data/* /data/.[!.]* /data/..?*; tar xzf /backup/billz-backup.tgz -C /data'
docker compose start billz
```

To publish an image to a private registry:

```bash
docker build -t registry.example.com/team/billz:1.0.0 .
docker push registry.example.com/team/billz:1.0.0
# then set BILLZ_IMAGE in .env or the shell

# or publish both supported architectures:
docker buildx build --platform linux/amd64,linux/arm64 \
  -t registry.example.com/team/billz:1.0.0 --push .
```

## API

All routes are public by design. The main surface is:

| Method | Route |
|---|---|
| `GET`, `HEAD` | `/api/health` |
| `GET` | `/api/config` |
| `GET`, `POST` | `/api/bills` |
| `GET`, `PUT`, `DELETE` | `/api/bills/{id}` |
| `GET` | `/api/occurrences?from=YYYY-MM-DD&to=YYYY-MM-DD` |
| `PUT`, `DELETE` | `/api/bills/{id}/occurrences/{dueDate}` |

Dates are ISO `YYYY-MM-DD`; occurrence ranges are capped at 366 days; errors use
`application/problem+json`.

## Security

Billz deliberately ships without authentication, by project decision. Every
device that can reach the port can read and change all data. Keep it on a trusted
LAN, do not port-forward it, and do not put it behind a public reverse proxy
without adding authentication first.

The same-origin/JSON request guard is header-based hardening only. It is not
authentication or an authorization boundary; clients that omit browser
`Origin`/`Sec-Fetch-Site` headers (such as `curl` or a script on the LAN) are not
constrained by it. Kestrel also restricts `Host` headers to an allowlist. Compose
maps it from `BILLZ_ALLOWED_HOSTS`; a direct .NET run uses the standard
`AllowedHosts` configuration key (for example
`AllowedHosts=localhost;127.0.0.1;192.168.1.50`). Add the LAN hostname or IP when
exposing Billz beyond localhost, and do not set the list to `*`. This blocks
DNS-rebinding requests that use a foreign hostname.

The Compose stack binds to `127.0.0.1` by default; widening `BILLZ_BIND` is an
explicit exposure decision and requires adding the reachable hostname/IP to the
host allowlist as well.

Run Billz directly on Kestrel. If TLS terminates at a reverse proxy, add the
external origin to `Billz:AllowedOrigins`; forwarded headers are not trusted
automatically. Plain-HTTP proxies must preserve the original `Host`, otherwise
browser mutations will be rejected. HSTS is only emitted when Kestrel itself
terminates TLS; a TLS-terminating proxy must add its own HSTS header.

The image runs as UID 1654 and disables .NET diagnostics. The Compose stack
drops all capabilities, sets `no-new-privileges`, uses a read-only root
filesystem with a small `/tmp` tmpfs, and keeps only `/data` writable.

CI runs formatting, tests, dependency audits, Playwright, a clean-volume Compose
smoke test, secret scanning, and Trivy scans of the repository and runtime
image. Dependabot checks NuGet, pnpm, Docker base images, and GitHub Actions.

## Troubleshooting

- **Container unhealthy:** `docker compose ps` shows health; `docker compose logs
  -f billz` shows startup and request problems. The health endpoint is
  `http://localhost:8080/api/health`.
- **Container restarts immediately:** check that `BILLZ_CURRENCY` is a
  three-letter code and that the SQLite volume is writable by UID 1654.
- **Port already in use:** change `BILLZ_PORT` in `.env` and restart Compose.
- **Lost access after an upgrade:** keep the named volume; removing it during
  cleanup deletes the database. Restore a backup into a clean volume.
- **HTTP 400 "Bad Request" for every request:** the requested `Host` is not in
  the allowlist. Add the hostname or IP to `BILLZ_ALLOWED_HOSTS` for Compose, or
  to `AllowedHosts` for a direct .NET run.
- **Browser mutations rejected behind a proxy:** add the external origin to
  `Billz:AllowedOrigins` or run Billz directly on Kestrel as described in
  [Security](#security).

## Limitations and non-goals

- No authentication, multi-user ownership, or remote access story.
- No reminders, notifications, email, or push.
- No bank integrations or automatic payment execution.
- One currency per deployment.
- One SQLite writer/instance; no horizontal scaling.
- Semi-monthly schedules (for example the 1st and 15th) are represented as two
  bills.

## CI

`.github/workflows/ci.yml` has three jobs:

- `verify`: restore, lint, tests, dependency audits, build and Playwright.
- `container`: clean-volume Compose smoke test and a runtime-image Trivy scan.
- `security`: gitleaks history scan and a repository dependency Trivy scan.

Playwright failure artifacts are uploaded when the `verify` job fails.

## License

MIT. See [LICENSE](LICENSE).
