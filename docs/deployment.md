# Deployment (Docker)

The site runs as four containers defined in `deploy/docker-compose.yml`:

| Service   | Image                        | Purpose                                                                 |
|-----------|------------------------------|-------------------------------------------------------------------------|
| `caddy`   | `caddy:2-alpine`             | Public entry point on ports 80/443. Automatic HTTPS (Let's Encrypt).    |
| `app`     | built from `Dockerfile` (`runner`) | Next.js standalone server. Not published — only Caddy can reach it. |
| `migrate` | built from `Dockerfile` (`tools`)  | Runs once per start: `prisma migrate deploy`, then the idempotent seed. |
| `db`      | `postgres:17-alpine`         | Database.                                                               |

Persistent data lives in named volumes: `pgdata` (database), `uploads` (images and form files), `caddy_data` (certificates).

## 1. Server prerequisites

- A Linux VPS (2 GB RAM minimum; 4 GB recommended so image builds don't swap).
- Docker Engine 24+ with the Compose plugin.
- A domain name whose DNS `A` (and `AAAA`, if you have IPv6) record points at the server.
- Ports 80 and 443 open in the firewall. Nothing else needs to be exposed.

## 2. First deployment

```bash
git clone <your-repo-url> gfg && cd gfg/deploy
cp .env.example .env
nano .env        # fill in DOMAIN, POSTGRES_PASSWORD, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
docker compose up -d --build
docker compose ps   # app should report "healthy"
```

- `POSTGRES_PASSWORD`: letters and digits only (it is embedded in a connection URL). `openssl rand -hex 24` works well.
- `SUPERADMIN_PASSWORD` must satisfy the app's password policy; the `migrate` service fails with a clear message if it doesn't (`docker compose logs migrate`).
- The first start builds two images and requests a certificate; allow a few minutes. Then open `https://<DOMAIN>/admin/login`.
- After signing in, change the super admin password from **Account**, fill in **Site settings**, and invite other admins. You can then clear `SUPERADMIN_PASSWORD` from `.env` — the seed only creates the admin when it doesn't exist.

## 3. Updating to a new version

```bash
cd gfg && git pull
cd deploy && ./backup.sh && docker compose up -d --build
```

`migrate` applies any new migrations before the new `app` container starts; if a migration fails, the old data is untouched and `app` does not start (see `docker compose logs migrate`). Clean up old images occasionally with `docker image prune`.

## 4. Backups

`deploy/backup.sh` writes `deploy/backups/<UTC timestamp>/` containing:

- `db.dump` — `pg_dump` custom-format dump of the database.
- `uploads.tar.gz` — every uploaded image and private form file.

It keeps the latest 14 and is safe to run while the site is live. Schedule it daily and copy the folder off the server — a backup on the same disk is not a backup:

```cron
15 3 * * * /home/deploy/gfg/deploy/backup.sh >> /home/deploy/gfg/deploy/backups/backup.log 2>&1
```

`deploy/backups/` is git-ignored; it contains personal data (form responses, uploaded files) — store copies encrypted.

## 5. Restoring

```bash
cd deploy
./restore.sh backups/20261001T031500Z   # asks you to type "restore"
```

This stops the app, replaces the database and uploads with the backup, then starts the stack again (running migrations, so an older backup is brought up to the current schema). Test a restore on a spare machine at least once.

## 6. Operations

| Task | Command (from `deploy/`) |
|------|---------|
| Status / health | `docker compose ps` · `curl -s https://<DOMAIN>/api/health` |
| Logs | `docker compose logs -f app` (or `caddy`, `db`, `migrate`) |
| Restart | `docker compose restart app` |
| Stop everything | `docker compose down` (volumes and data are kept) |
| Reset the super admin password | set `SUPERADMIN_PASSWORD` + `SEED_RESET_SUPERADMIN=1` in `.env`, `docker compose up -d`, then set it back to `0` |
| Database shell | `docker compose exec db psql -U gfg -d gfg` |

## 7. Security notes

- **Client IPs.** The app rate-limits sign-in, invites, public forms and analytics by the `X-Real-IP` header. Caddy overwrites that header with the real peer address, and the app container is deliberately not published, so clients cannot spoof it. Do not add a `ports:` entry to the `app` service.
- **HTTPS is required in production.** Session cookies are marked `Secure`, so signing in over plain HTTP will not work.
- **Single app replica.** Rate-limit counters live in the app's memory; run one `app` container (the default). They reset when the container restarts.
- Secrets live only in `deploy/.env` (git-ignored). Keep its permissions tight: `chmod 600 deploy/.env`.

## 8. Using your own reverse proxy instead of Caddy

If the server already runs nginx/Traefik: delete the `caddy` service, give `app` a loopback-only port (`ports: ["127.0.0.1:3000:3000"]`), and make the proxy set the client address itself, overwriting anything the client sent. For nginx:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 20m;
}
```

## 9. Trying it locally

Set `DOMAIN=localhost` in `deploy/.env`. Caddy then issues a certificate from its own local CA (your browser will warn; that's expected). Everything else behaves as in production.

## 10. Verifying registration capacity on real PostgreSQL

Development uses `prisma dev`, which serializes all queries, so concurrency tests there prove little. The integration suite includes a concurrent-submission test (`src/server/forms/submit.int.test.ts`, "never overfills a capped form or event…") that must also pass against a real server:

```bash
docker run -d --rm --name gfg-racetest -e POSTGRES_PASSWORD=race -e POSTGRES_DB=race -p 55432:5432 postgres:17-alpine
TEST_DATABASE_URL="postgres://postgres:race@localhost:55432/race?sslmode=disable" npm run test:int
docker rm -f gfg-racetest
```

Last verified 2026-09-27: 137/137 passing against PostgreSQL 17 (12 concurrent submissions for 3 spots → exactly 3 accepted; 10 for 2 event seats → exactly 2).
