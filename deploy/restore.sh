#!/usr/bin/env bash
# Restores a backup made by backup.sh:  ./restore.sh backups/20261001T020000Z
# DESTRUCTIVE: replaces the current database contents and uploaded files.
set -euo pipefail
cd "$(dirname "$0")"

src="${1:?usage: ./restore.sh backups/<timestamp>}"
[[ -f "${src}/db.dump" && -f "${src}/uploads.tar.gz" ]] || { echo "Missing db.dump or uploads.tar.gz in ${src}" >&2; exit 1; }

read -r -p "This REPLACES the live database and uploads with ${src}. Type 'restore' to continue: " answer
[[ "${answer}" == "restore" ]] || { echo "Aborted."; exit 1; }

echo "Stopping the app..."
docker compose stop app caddy

echo "Restoring database..."
docker compose exec -T db pg_restore -U gfg -d gfg --clean --if-exists --no-owner --single-transaction < "${src}/db.dump"

echo "Restoring uploads..."
docker compose run --rm --no-deps -T --entrypoint sh app -c 'find /data/uploads -mindepth 1 -delete && tar -C /data/uploads -xzf -' < "${src}/uploads.tar.gz"

echo "Starting the stack (migrations run first)..."
docker compose up -d

echo "Restore complete."
