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

- .NET 10 Minimal API (EF Core and SQLite planned)
- SolidJS, Vite and TypeScript
- mise for the pinned toolchain and task runner
- Docker and Docker Compose for deployment (planned)

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
| `mise run build` | Build the SPA and publish the API |
| `mise run verify` | Lint, test and build |
| `mise run format` | Apply formatting |

## Data

SQLite is the only datastore. By default the database lives in the platform's
per-user data directory (`~/.local/share/billz/billz.db` on Linux); set
`Billz__DatabasePath` to an absolute path to override it. Relative paths resolve
against the application directory and are not recommended. The planned Docker
image will use `/data/billz.db` on a named volume.

Do not deploy over the data directory. Back up while Billz is stopped and copy
`billz.db`, `billz.db-wal`, and `billz.db-shm` together, or use SQLite's
`VACUUM INTO` on a quiesced database. A copy of `billz.db` alone can be stale
because of WAL. Timestamps are stored and returned as UTC milliseconds.

Runtime migrations run automatically at startup. Do not run
`dotnet ef database update`; the design-time factory points at a throwaway file
and will not update the real database.

## Planned container configuration

These variables are consumed by the Docker Compose stack added with the
container packaging commit.

| Variable | Purpose | Default |
|---|---|---|
| `BILLZ_CURRENCY` | ISO 4217 currency code | required |
| `BILLZ_PORT` | Host port for Docker Compose | `8080` |
| `BILLZ_IMAGE` | Image name/tag for Compose | `billz:local` |

Copy `.env.example` to `.env` for local container use. Never commit `.env`.

## Security

Billz deliberately ships without authentication, by project decision. Every
device that can reach the port can read and change all data. Keep it on a trusted
LAN, do not port-forward it, and do not put it behind a public reverse proxy
without adding authentication first.

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
