import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { getSettings } from "@/features/settings/queries";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings().catch(() => null);
  const name = s?.groupName ?? "ก๊วนแบด";
  return {
    title: { default: name, template: `%s · ${name}` },
    description: "ระบบจัดการก๊วนแบดมินตัน",
    // iPhone "Add to Home Screen": open full-screen with the app's own name.
    appleWebApp: { capable: true, title: name, statusBarStyle: "black-translucent" },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#144c37" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600&family=Chakra+Petch:wght@500;600;700&display=swap"
        />
      </head>
      <body>
        {children}
        <Toaster
          position="top-center"
          closeButton
          toastOptions={{
            // App colours instead of sonner's light presets, so text stays readable (WCAG AA) in sunlight and dark mode.
            classNames: {
              toast: "!bg-surface !text-ink !border-line !shadow-card font-sans",
              success: "!border-l-4 !border-l-ok",
              error: "!border-l-4 !border-l-danger",
              description: "!text-muted",
              actionButton: "!bg-brand !text-brand-ink !font-semibold",
              closeButton: "!bg-surface !text-ink !border-line",
            },
          }}
        />
      </body>
    </html>
  );
}
