import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-2xl font-bold">ไม่พบหน้านี้</h1>
        <p className="text-muted">ลิงก์อาจผิด หรือรายการถูกลบไปแล้ว</p>
        <LinkButton href="/" variant="primary">
          กลับหน้าแรก
        </LinkButton>
      </div>
    </main>
  );
}
