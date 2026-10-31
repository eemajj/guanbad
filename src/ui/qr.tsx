import QRCode from "qrcode";

/** Server-rendered QR code as inline SVG (no client JavaScript needed). */
export async function QrCode({ text, size = 240, label }: { text: string; size?: number; label: string }) {
  const svg = await QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#0b1a13", light: "#ffffff" },
  });
  return <div role="img" aria-label={label} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
