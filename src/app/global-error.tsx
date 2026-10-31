"use client";

/** Last-resort error screen when even the root layout fails. Plain HTML, no app styles available. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="th">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100dvh",
          margin: 0,
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: 20 }}>ระบบขัดข้องชั่วคราว</h1>
          <p>ลองใหม่อีกครั้งในอีกสักครู่</p>
          <button onClick={reset} style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid #ccc", fontSize: 15 }}>
            ลองใหม่
          </button>
          {error.digest && <p style={{ fontSize: 12, color: "#666" }}>รหัสอ้างอิง: {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}
