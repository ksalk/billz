# Billz

Billz is a self-hosted tracker for bills and recurring payments. It shows what is
due on a calendar and keeps a plain table of every bill for quick editing.

> **Security note:** Billz currently has no authentication. Run it only on a
> trusted private network and never expose it to the internet. See
> [Security](#security).

The project is under active development. The calendar, bills table, SQLite
persistence, Docker packaging and deployment documentation land in subsequent
commits.

## Stack

- .NET 10 Minimal API with EF Core and SQLite
- SolidJS, Vite and TypeScript
- mise for the pinned toolchain and task runner
- Docker and Docker Compose for deployment

## Local development

Prerequisites: [mise](https://mise.jdx.dev/).

```bash
mise run setup
mise run dev
```

The API listens on `http://localhost:5080`; the Vite dev server runs on
`http://localhost:5173` and proxies `/api` to the API.

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

## Docker

```bash
cp .env.example .env
# set BILLZ_CURRENCY in .env
# set BILLZ_BIND=0.0.0.0 to reach Billz from other LAN devices
docker compose up -d --build
```

Open `http://localhost:8080` (or the port in `BILLZ_PORT`). The published port
binds to `127.0.0.1` by default; Billz only becomes reachable from other devices
when `BILLZ_BIND` is explicitly widened to a trusted LAN interface.

The container runs as a non-root user with a read-only root filesystem when
deployed with the provided Compose stack. SQLite lives on the named volume
`billz-data` at `/data/billz.db`; deleting that volume deletes all bills and
payment history.

To publish an image to a private registry:

```bash
docker build -t registry.example.com/team/billz:1.0.0 .
docker push registry.example.com/team/billz:1.0.0
# then set BILLZ_IMAGE in .env or the shell
```

### Container operations

```bash
docker compose logs -f billz
docker compose restart billz
```

Upgrade by stopping the service, taking a backup, rebuilding, and starting it
again. Database migrations run automatically at startup.

Back up the SQLite volume while the service is stopped:

```bash
mkdir -p backups
docker compose stop billz
docker run --rm \
  -v billz-data:/data \
  -v "$PWD/backups":/backup \
  alpine tar czf /backup/billz-backup.tgz -C /data .
docker compose start billz
```

Restore only with the service stopped, and extract the archive into a clean
volume. The volume name follows `BILLZ_VOLUME_NAME` if you changed it.

## Data

SQLite is the only datastore. By default the database lives in the platform's
per-user data directory (`~/.local/share/billz/billz.db` on Linux); set
`Billz__DatabasePath` to an absolute path to override it. Relative paths resolve
against the application directory and are not recommended. The Docker image uses
`/data/billz.db` on the `billz-data` volume.

Do not deploy over the data directory. Back up while Billz is stopped and copy
`billz.db`, `billz.db-wal`, and `billz.db-shm` together, or use SQLite's
`VACUUM INTO` on a quiesced database. A copy of `billz.db` alone can be stale
because of WAL. The container volume backup command is shown under
[Container operations](#container-operations). Timestamps are stored and
returned as UTC milliseconds.

Runtime migrations run automatically at startup. Do not run
`dotnet ef database update`; the design-time factory points at a throwaway file
and will not update the real database.

## Container configuration

These variables are consumed by the Docker Compose stack.

| Variable | Purpose | Default |
|---|---|---|
| `BILLZ_CURRENCY` | ISO 4217 currency code | required |
| `BILLZ_BIND` | Host interface for the published port | `127.0.0.1` |
| `BILLZ_PORT` | Host port for Docker Compose | `8080` |
| `BILLZ_IMAGE` | Image name/tag for Compose | `billz:local` |
| `BILLZ_VOLUME_NAME` | Docker volume for SQLite | `billz-data` |

Copy `.env.example` to `.env` for local container use. Never commit `.env`.

When running the API directly instead of through Compose, use the standard .NET
configuration name `Billz__Currency`; Compose maps `BILLZ_CURRENCY` to it.

## Security

Billz deliberately ships without authentication, by project decision. Every
device that can reach the port can read and change all data. Keep it on a trusted
LAN, do not port-forward it, and do not put it behind a public reverse proxy
without adding authentication first. The Compose stack binds to `127.0.0.1` by
default; widening `BILLZ_BIND` is an explicit exposure decision.

The same-origin/JSON request guard is header-based hardening only. It is not
authentication or an authorization boundary; clients that omit browser
`Origin`/`Sec-Fetch-Site` headers (such as `curl` or a script on the LAN) are not
constrained by it.

Run Billz directly on Kestrel. If TLS terminates at a reverse proxy, add the
external origin to `Billz:AllowedOrigins`; forwarded headers are not trusted
automatically. Plain-HTTP proxies must preserve the original `Host`, otherwise
browser mutations will be rejected. HSTS is only emitted when Kestrel itself
terminates TLS; a TLS-terminating proxy must add its own HSTS header.

## License

MIT. See [LICENSE](LICENSE).
