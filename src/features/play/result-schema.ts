import { z } from "zod";
import { normalizeResult } from "@/domain/results";
import { ActionError } from "@/server/viewer";

const optionalInt = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.coerce.number({ invalid_type_error: "แต้มต้องเป็นตัวเลข" }).nullable(),
);

const resultSchema = z.object({
  winner: z.enum(["A", "B", ""]).transform((v) => (v === "" ? null : v)),
  scoreA: optionalInt,
  scoreB: optionalInt,
  shuttles: z.coerce.number().int().min(0, "จำนวนลูกต้องไม่ติดลบ").max(30),
});

/** Parse winner/points/shuttles from the result form and apply the result rules (see domain/results). */
export function parseResultForm(form: FormData) {
  const d = resultSchema.parse(Object.fromEntries(form));
  const r = normalizeResult({ winner: d.winner, scoreA: d.scoreA, scoreB: d.scoreB });
  if (!r.ok) throw new ActionError(r.error);
  return { ...r.value, shuttles: d.shuttles };
}
