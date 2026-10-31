import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { getSettings } from "@/server/settings";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings().catch(() => null);
  return { title: { default: s?.groupName ?? "ก๊วนแบด", template: `%s · ${s?.groupName ?? "ก๊วนแบด"}` }, description: "ระบบจัดการก๊วนแบดมินตัน" };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#144c37" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600&family=Chakra+Petch:wght@500;600;700&display=swap" />
      </head>
      <body>
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
