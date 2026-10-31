import { cn } from "@/lib/cn";

const palette = ["bg-brand", "bg-accent", "bg-ok", "bg-warn", "bg-danger"];

export function Avatar({ name, image, size = 36, className }: { name: string; image?: string | null; size?: number; className?: string }) {
  const hue = palette[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % palette.length];
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" width={size} height={size} className={cn("shrink-0 rounded-full object-cover", className)} style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-full font-display font-bold text-white", hue, className)}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {[...name][0]}
    </span>
  );
}
