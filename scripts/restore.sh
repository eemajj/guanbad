#!/usr/bin/env bash
# กู้คืนไฟล์สำรองลงฐานข้อมูล "ว่าง" เท่านั้น (ไม่เขียนทับข้อมูลที่มีอยู่)
#   scripts/restore.sh <ไฟล์.dump> <URL ของฐานข้อมูลว่างปลายทาง>
# ตัวอย่างซ้อมกู้คืน: สร้างฐานข้อมูลใหม่ชื่อ guan_restore_check แล้วกู้ลงไป เทียบจำนวนแถวกับของจริง
set -euo pipefail

dump="${1:?ระบุไฟล์ .dump}"
target="${2:?ระบุ URL ฐานข้อมูลปลายทาง (ต้องว่าง)}"
target="${target%%\?*}"

tables=$(psql "$target" -Atc "select count(*) from information_schema.tables where table_schema = 'public'")
if [ "$tables" != "0" ]; then
  echo "ฐานข้อมูลปลายทางมีตารางอยู่แล้ว ($tables ตาราง) จะไม่กู้คืนทับ ให้สร้างฐานข้อมูลใหม่แล้วลองอีกครั้ง" >&2
  exit 1
fi

pg_restore --no-owner --no-privileges --exit-on-error --dbname="$target" "$dump"
echo "กู้คืนแล้ว จำนวนแถว:"
psql "$target" -c 'select (select count(*) from "Member") as members, (select count(*) from "Session") as sessions, (select count(*) from "Match") as games, (select count(*) from "Charge") as bills, (select count(*) from "Activity") as history'
