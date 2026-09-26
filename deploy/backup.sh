#!/usr/bin/env bash
# Backs up the database (pg_dump custom format) and the uploads volume into ./backups/<timestamp>/.
# Run from anywhere; operates on the compose project in this directory. Safe while the site is live.
set -euo pipefail
cd "$(dirname "$0")"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dest="backups/${stamp}"
mkdir -p "${dest}"

echo "Dumping database..."
docker compose exec -T db pg_dump -U gfg -d gfg --format=custom --no-owner > "${dest}/db.dump"

echo "Archiving uploads..."
docker compose run --rm --no-deps -T --entrypoint tar app -C /data/uploads -czf - . > "${dest}/uploads.tar.gz"

# Keep the most recent 14 backups.
ls -1dt backups/*/ 2>/dev/null | tail -n +15 | xargs -r rm -rf

echo "Backup written to deploy/${dest} ($(du -sh "${dest}" | cut -f1))."
echo "Copy it off this server (e.g. rclone/rsync) — a backup on the same disk is not a backup."
