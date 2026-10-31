import { z } from "zod";
import { dateFromISO, toSatang } from "@/lib/format";

const time = z.string().regex(/^\d{2}:\d{2}$/, "เวลาไม่ถูกต้อง");
const baht = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label}ต้องเป็นตัวเลข` })
    .min(0, `${label}ต้องไม่ติดลบ`)
    .max(100000);

const sessionSchema = z.object({
  venue: z.string().trim().min(1, "กรุณาใส่ชื่อสนาม").max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "กรุณาเลือกวันที่"),
  startTime: time,
  endTime: time,
  courts: z
    .string()
    .transform((v) =>
      v
        .split(/[,\s]+/)
        .map((x) => x.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().max(10)).min(1, "ต้องมีอย่างน้อย 1 คอร์ท").max(12, "สูงสุด 12 คอร์ท")),
  courtRate: baht("ค่าคอร์ท"),
  shuttlePrice: baht("ราคาลูก"),
  feeMode: z.enum(["SPLIT", "FLAT"]),
  flatFee: baht("ค่าคอร์ทต่อหัว").default(0),
  maxPlayers: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce.number().int().min(4, "รับขั้นต่ำ 4 คน").max(200).nullable(),
  ),
  selfSignup: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  note: z.string().trim().max(500).optional(),
});

/** Session form → database fields (money in satang) + court names. */
export function parseSessionForm(form: FormData) {
  const d = sessionSchema.parse(Object.fromEntries(form));
  return {
    courtNames: d.courts,
    data: {
      venue: d.venue,
      date: dateFromISO(d.date),
      startTime: d.startTime,
      endTime: d.endTime,
      courtRate: toSatang(d.courtRate),
      shuttlePrice: toSatang(d.shuttlePrice),
      feeMode: d.feeMode,
      flatFee: toSatang(d.flatFee ?? 0),
      maxPlayers: d.maxPlayers,
      selfSignup: d.selfSignup,
      note: d.note || null,
    },
  };
}
