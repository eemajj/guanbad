"use client";

import { toast } from "sonner";
import { Button } from "@/ui/button";

export function CopyButton({ text, label }: { text: string; label: string }) {
  return (
    <Button
      onClick={() =>
        navigator.clipboard.writeText(text).then(
          () => toast.success("คัดลอกแล้ว"),
          () => toast.message(text),
        )
      }
    >
      {label}
    </Button>
  );
}
