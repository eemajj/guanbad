# 0006 · อัปเกรดเป็น Next.js 16 เพื่อแก้หน้าจอค้างหลังกดปุ่ม

- สถานะ: ตัดสินแล้ว (เฟส 4)

## บริบท
ระหว่างทำเฟส 4 พบว่าหลังกดบันทึก (เช่น บันทึกรายจ่าย เพิ่มคนในรอบ) server action ตอบกลับใน ~60 ms แต่หน้าจอ**ไม่อัปเดต** จนกว่าจะมีอย่างอื่นทำให้ React render ใหม่ เช่น toast หายไป (~4.4 วินาที) ถ้าไม่มี toast หน้าจะค้างข้อมูลเก่าไปเลย อาการเดียวกับที่ ADR 0005 เจอใน live refresh

ไล่หาสาเหตุ (หน้า probe ชั่วคราว ลบออกแล้ว):
- ตัดออกทีละอย่าง: ฟอนต์, toast, ActionForm, Dialog, ปุ่มที่ bind action ไว้ 200 ปุ่ม, ลิงก์ 200 ลิงก์, component ที่ async, prefetch ไม่มีตัวไหนทำให้ค้างเมื่ออยู่ตัวเดียว
- หน้าที่ซับซ้อนพอ (หน้าการเงินจริง) ค้าง **ทุกครั้ง** แม้ใช้ `<form action>` ธรรมดาที่ไม่มีโค้ดของเราเลย
- ดู state ภายใน React ตอนค้าง: lane ของ transition ถูก mark ว่า suspended (`RootSuspendedWithDelay`) แต่ promise ที่รออยู่ทุกตัว resolve ไปแล้ว ไม่มี async action ค้าง ไม่มี CPU ทำงาน คือ **สัญญาณปลุก (ping) หาย** เป็นบั๊กของ React ที่มากับ Next.js 15.5
- เวอร์ชันที่ push ไปแล้วในเฟส 3 ก็เป็น (วัดได้ 4.4 วินาที) ไม่ใช่ของใหม่ในเฟส 4

## ตัดสินใจ
อัปเกรด `next` 15.5.28 → **16.4.2**, `react`/`react-dom` → 19.2.9 (เลือกเวอร์ชันที่ออกมาแล้วอย่างน้อย 2 สัปดาห์)

สิ่งที่ต้องแก้ตาม Next 16:
- `revalidateTag(tag)` ต้องมี argument ที่สอง → ใช้ `updateTag("results")` ใน `server/revalidate.ts` (ใน server action ได้ข้อมูลใหม่ทันที ไม่ใช่ stale-while-revalidate)
- `eslint-config-next` 16 เป็น flat config แล้ว → `eslint.config.mjs` import ตรง ไม่ต้องใช้ `@eslint/eslintrc`
- `tsconfig.json`: `jsx: react-jsx` และ include `.next/dev/types` (Next ตั้งให้เอง)
- build ใช้ Turbopack เป็นค่าเริ่มต้น

## ผลวัด (หน้าเดียวกัน เครื่องเดียวกัน)
| | Next 15.5 | Next 16.4 |
|---|---|---|
| บันทึกรายจ่าย → เห็นในรายการ (มี toast) | 4.4 วินาที | 0.13–0.23 วินาที |
| เหมือนกันแต่ไม่มี toast | ไม่อัปเดตเลย | 0.13–0.16 วินาที |
| หน้า probe การเงินเต็มหน้า (`<form action>` ธรรมดา) | ค้างทุกครั้ง | 0.08–0.13 วินาที |

typecheck, lint, unit 25 ข้อ, integration 64 ข้อ (coverage 98%) และ E2E ทั้งชุดผ่าน

## ผลที่ตามมา
- fallback reload ใน `LiveRefresh` (ADR 0005) ยังเก็บไว้เป็นตาข่ายกันพลาด แต่ควรแทบไม่ทำงานแล้ว
- ลบ workaround ที่ไม่ได้ผลออก (`setTimeout` รอบ toast ใน `ui/action.tsx`)
- อัปเกรด Next ครั้งต่อไป ให้รัน `tests/e2e/live.spec.ts` และดูเวลาที่ E2E ใช้ ถ้าเวลาเพิ่มเป็นวินาทีโดยไม่มีเหตุผล ให้สงสัยปัญหานี้ก่อน
