# สถาปัตยกรรม

เอกสารนี้ตอบ 2 คำถาม: **โค้ดแต่ละแบบอยู่ที่ไหน** และ **ข้อมูลไหลยังไง**
ถ้าจะเพิ่มอะไร ให้ดูหัวข้อ "จะเพิ่ม…ต้องแก้ที่ไหน" ก่อน

## ภาพรวม

```
เบราว์เซอร์ (มือถือ)
   │  กดปุ่ม → Server Action             เปิดหน้า → Server Component
   ▼                                        ▼
features/<x>/actions.ts               app/**/page.tsx
   │ asAdmin / asUser (สิทธิ์ + error)      │
   │ inSessionLock (transaction + lock)     │ features/<x>/queries.ts
   │ domain/* (กติกา: จัดคู่ คิดเงิน ผล)     │ features/sessions/state.ts (deriveState)
   ▼                                        ▼
                PostgreSQL (Prisma)
```

- **อ่านข้อมูล:** หน้าเป็น Server Component เรียก `features/*/queries.ts` แล้วส่งผลให้ component แสดง
- **เขียนข้อมูล:** ปุ่มและฟอร์มเรียก server action ใน `features/*/actions.ts` ซึ่ง:
  - ตรวจสิทธิ์
  - ตรวจข้อมูลด้วย zod
  - ทำงานใน transaction
  - สั่ง `refresh.*` ให้หน้าที่เกี่ยวข้องโหลดใหม่
- **กติกาทั้งหมดอยู่ใน `domain/`** ไม่มี I/O และมี unit test ทุกไฟล์ เช่น:
  - ใครได้ลงก่อน
  - แบ่งทีมยังไง
  - ค่าคอร์ทหารยังไง
  - แต้มแบบไหนใช้ได้
  - QR พร้อมเพย์

## โฟลเดอร์

```
src/
├─ app/                 Route เท่านั้น: รับ params ตรวจสิทธิ์หน้า เรียก queries แล้วประกอบ component
│  ├─ (member)/         หน้าหลังล็อกอิน มีเมนู (layout.tsx)
│  ├─ (public)/         login, welcome, claim/[token], pay/[id] (pay เปิดได้โดยไม่ล็อกอิน)
│  └─ api/auth/         Auth.js
├─ features/            หนึ่งโฟลเดอร์ = หนึ่งเรื่องที่ผู้ใช้เข้าใจ
│  ├─ sessions/         รอบตี: สร้าง แก้ เริ่ม จบรอบ + ลงชื่อ/พัก (signup-actions.ts)
│  │                    state.ts = ข้อมูลรอบที่คำนวณแล้ว · engine.ts = จัดคู่ลงคอร์ท
│  ├─ play/             คอร์ท คิว จบเกม แก้ผล เปลี่ยนตัว
│  ├─ billing/          บิลรายคน หน้าจ่ายเงิน แจ้งโอน ยืนยันรับเงิน ยอดค้าง
│  ├─ finance/          รายรับรายจ่ายรายเดือน บันทึกรายจ่าย
│  ├─ members/          ทะเบียน โปรไฟล์ สถิติรายคน ลิงก์ผูกบัญชี
│  ├─ stats/            อันดับ คู่ที่เข้าขา ความครบของข้อมูลผล
│  └─ settings/         ชื่อก๊วน พร้อมเพย์ หัวก๊วน
├─ domain/              กติกาล้วน + เทสต์ (matchmaking, fees, results, promptpay, levels, labels)
├─ ui/                  Design system: ปุ่ม การ์ด ตาราง dialog ฟอร์ม ฯลฯ ไม่รู้จักฟีเจอร์
├─ server/              โครงฝั่งเซิร์ฟเวอร์: db, auth, viewer (ใครล็อกอิน), action, lock, revalidate
└─ lib/                 ใช้ได้ทั้งสองฝั่ง: paths (URL ทุกหน้า), format (เงิน/วันที่), cn
```

ในแต่ละ feature มีไฟล์ตามหน้าที่ ไม่จำเป็นต้องมีครบทุกไฟล์:

| ไฟล์ | หน้าที่ | ใช้ที่ไหนได้ |
|---|---|---|
| `actions.ts` | server actions (`"use server"`) | component ฝั่ง client |
| `queries.ts` | อ่านข้อมูล (`server-only`) | หน้าใน `app/` และ server component |
| `components/` | UI ของเรื่องนั้น | หน้าใน `app/` และ feature อื่น |
| `*-schema.ts` | ตรวจและแปลงข้อมูลจากฟอร์ม | `actions.ts` |

## กฎ (ESLint ตรวจให้)

| โฟลเดอร์ | ห้าม import | เหตุผล |
|---|---|---|
| `domain/` | ทุกอย่างในแอป, Next, React, Prisma (ยกเว้น type) | กติกาต้องเทสต์ได้โดยไม่มีฐานข้อมูล |
| `lib/` | `server/`, `features/`, `ui/`, `app/` | ถูกใช้ทั้งในเบราว์เซอร์และเซิร์ฟเวอร์ |
| `ui/` | `server/`, `features/`, `app/` | ใช้ซ้ำได้ทุกที่ ไม่ผูกกับฟีเจอร์ |
| `app/`, `features/*/components/` | `@/server/db`, `@prisma/client` | การอ่านข้อมูลอยู่ใน `queries.ts` ที่เดียว |

นอกจากที่ ESLint ตรวจ มีข้อตกลงเพิ่มเติม:
- **server action:**
  - เริ่มด้วย `asAdmin(...)` หรือ `asUser(...)` เสมอ
  - อะไรที่แตะคิวหรือคอร์ทต้องอยู่ใน `inSessionLock` / `inMatchLock`
- **URL:** ใช้ `paths.*` เท่านั้น ห้ามเขียน string เอง
- **ข้อความสถานะภาษาไทย:** ใช้จาก `domain/labels.ts`
- **เงิน:** เก็บเป็นสตางค์ (integer) แปลงเป็นบาทตอนแสดงผลด้วย `baht()` เท่านั้น
- **ความยาวไฟล์:** ไม่เกิน 200 บรรทัด ถ้าเกินให้แยก component

## จะเพิ่ม…ต้องแก้ที่ไหน

| อยากทำ | แก้ที่ |
|---|---|
| เปลี่ยนวิธีจัดคู่ / น้ำหนักการแบ่งทีม | `domain/matchmaking.ts` (+ เทสต์ใน `domain.test.ts`) |
| เปลี่ยนวิธีคิดเงิน | `domain/fees.ts` แล้วดู `closeSession` ใน `features/sessions/actions.ts` |
| เพิ่มปุ่มใหม่ที่เปลี่ยนข้อมูล | action ใน `features/<x>/actions.ts` → ปุ่มใช้ `<ActionButton>` หรือ `<ActionForm>` จาก `ui/action.tsx` |
| เพิ่มหน้าใหม่ | `app/(member)/<path>/page.tsx` + เพิ่ม URL ใน `lib/paths.ts` + เมนูใน `app/(member)/layout.tsx` |
| เพิ่มคอลัมน์ในฐานข้อมูล | `prisma/schema.prisma` → `npx prisma migrate dev --name <ชื่อ>` |
| เปลี่ยนสี / ตัวอักษร | token ใน `app/globals.css` (`:root` และโหมดมืด) |

## เทสต์

| ชนิด | อยู่ที่ | ทดสอบอะไร | คำสั่ง |
|---|---|---|---|
| Unit | `src/domain/*.test.ts` | กติกาล้วน | `npm test` |
| Integration | `tests/integration/` | server action กับ PostgreSQL จริง: สิทธิ์ การล็อก การออกบิล | `npm run test:integration` |
| E2E | `tests/e2e/` | เปิดเบราว์เซอร์มือถือ เดินครบทั้งรอบแบบผู้ใช้จริง | `npm run test:e2e` |

integration กับ E2E สร้างฐานข้อมูลใหม่ทุกครั้งที่รัน ไม่ลบของเดิม ดู [ADR 0003](adr/0003-fresh-database-per-test-run.md)

## การตัดสินใจสำคัญ

ดูใน [docs/adr](adr/) แต่ละไฟล์บอกว่าเลือกอะไร เพราะอะไร และต้องแลกกับอะไร
