import type { MetadataRoute } from "next";
import { getSettings } from "@/features/settings/queries";

/** Lets members "Add to Home Screen" so the app opens full-screen like a native app. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings().catch(() => null);
  const name = s?.groupName ?? "ก๊วนแบด";
  return {
    name,
    short_name: name.length > 12 ? "ก๊วนแบด" : name,
    description: "ลงชื่อรอบตี ดูคิว และจ่ายค่าคอร์ท",
    lang: "th",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f1f5f2",
    theme_color: "#144c37",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
