"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-xl font-bold">โหลดหน้านี้ไม่สำเร็จ</h1>
      <p className="text-muted">อาจเป็นปัญหาการเชื่อมต่อชั่วคราว</p>
      <Button variant="primary" onClick={reset}>
        ลองใหม่
      </Button>
    </div>
  );
}
