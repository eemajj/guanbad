#!/usr/bin/env bash
# สำรองฐานข้อมูลเป็นไฟล์ .dump (รูปแบบ custom ของ pg_dump กู้คืนได้ด้วย scripts/restore.sh)
#   DATABASE_URL="postgresql://..." scripts/backup.sh [โฟลเดอร์ปลายทาง]
set -euo pipefail

: "${DATABASE_URL:?ตั้ง DATABASE_URL ก่อน}"
out_dir="${1:-backups}"
mkdir -p "$out_dir"
file="$out_dir/guan-$(date -u +%Y%m%d-%H%M%S).dump"

# Prisma's "?schema=public" is not understood by pg_dump.
url="${DATABASE_URL%%\?*}"

pg_dump --format=custom --no-owner --no-privileges --file="$file" "$url"
echo "สำรองแล้ว: $file ($(du -h "$file" | cut -f1))"
