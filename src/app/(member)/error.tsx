"use client";

import { Button } from "@/ui/button";

/** Shown when a page fails to load. The reference matches the `ref` in the server log. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-xl font-bold">โหลดหน้านี้ไม่สำเร็จ</h1>
      <p className="text-muted">อาจเป็นปัญหาการเชื่อมต่อชั่วคราว ลองใหม่อีกครั้ง</p>
      <Button variant="primary" onClick={reset}>
        ลองใหม่
      </Button>
      {error.digest && <p className="text-xs text-muted">ถ้ายังไม่ได้ แจ้งหัวก๊วนพร้อมรหัสอ้างอิง: {error.digest}</p>}
    </div>
  );
}
