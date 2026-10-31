# 0004 · Server action เป็นฟังก์ชันธรรมดาที่ห่อด้วย asAdmin / asUser

- สถานะ: ตัดสินแล้ว

## บริบท
ทุก action ต้องตรวจสิทธิ์ แปลง error เป็นข้อความภาษาไทย และสั่งให้หน้าที่เกี่ยวข้องโหลดใหม่ ถ้าเขียนซ้ำทุกที่จะหลุดง่าย เช่น เคยลืมตรวจสถานะเกมก่อนยกเลิก (บั๊ก P1 ใน ROADMAP)

ทางเลือกที่พิจารณา: สร้าง action ด้วย factory (`export const x = defineAction(...)`) ก็เป็นไปได้ แต่ไฟล์ `"use server"` ใน Next.js ต้อง export เป็น async function และเครื่องมือหลายตัว (tsc, IDE, Next) ทำงานกับ `export async function` ได้ตรงไปตรงมากว่า

## ตัดสินใจ
- action เขียนเป็น `export async function` เสมอ และในฟังก์ชันใช้ helper ตามหน้าที่:

  | helper | อยู่ที่ | หน้าที่ |
  |---|---|---|
  | `asAdmin(fn)` / `asUser(fn)` | `server/action.ts` | ตรวจสิทธิ์ แปลง error |
  | `inSessionLock(id, fn)` / `inMatchLock(id, fn)` | `server/lock.ts` | transaction + advisory lock ต่อรอบ |
  | `refresh.*` | `server/revalidate.ts` | สั่งโหลดหน้าใหม่ตามสิ่งที่เปลี่ยน (ใช้ `paths`) |

- ข้อมูลจากฟอร์มตรวจด้วย zod ใน `*-schema.ts` ของ feature นั้น

## ผลที่ตามมา
- action ทุกตัวหน้าตาเหมือนกัน อ่านง่าย และ integration test เรียกได้ตรงๆ
- การบันทึกประวัติการแก้ไข (เฟส 2) เพิ่มได้ที่ helper จุดเดียว
