import type { Level } from "@prisma/client";

/** เกณฑ์ประเมินมือของก๊วน เรียงจากอ่อนไปเก่ง */
export const LEVELS: Record<Level, { code: string; name: string; description: string; rank: number }> = {
  BG: { code: "BG", name: "Beginner", rank: 1, description: "มือใหม่เพิ่งเริ่มตี ยังไม่คล่อง อาจตีลูกไม่ข้ามเน็ตหรือตีไม่แม่น" },
  N_MINUS: { code: "N-", name: "Novice-", rank: 2, description: "มือใหม่พัฒนาขึ้นมาหน่อย ตีโต้ได้บ้างแต่ยังไม่แม่นมาก" },
  N: { code: "N", name: "Novice", rank: 3, description: "ตีโต้ได้พอสมควร รับเสิร์ฟ รับลูกตบเบื้องต้นได้" },
  NS: { code: "NS", name: "Novice-Standard", rank: 4, description: "ระดับกลางของ N กับ S เริ่มเข้าเกมได้ดีขึ้น เข้าใจตำแหน่งในคอร์ท" },
  S: { code: "S", name: "Standard", rank: 5, description: "เล่นเป็นเกมได้ดี ตีโต้ได้ทุกลูกพื้นฐาน ตำแหน่งดีพอสมควร" },
  P_MINUS: { code: "P-", name: "Pre-Pro", rank: 6, description: "ใกล้ระดับแข่งจริงแล้ว ฟอร์มดี ลูกแม่น ตำแหน่งแม่นยำ มีแผนการเล่น" },
  P: { code: "P", name: "Pro / Professional", rank: 7, description: "มือแข่ง เล่นในระดับสโมสร มีความฟิต เทคนิค และแท็กติกครบ" },
};

export const LEVEL_ORDER = Object.keys(LEVELS) as Level[];

export const levelRank = (level: Level) => LEVELS[level].rank;
export const levelCode = (level: Level) => LEVELS[level].code;
// Object.hasOwn, not `in`: "constructor" or "toString" would pass via the prototype chain.
export const isLevel = (v: unknown): v is Level => typeof v === "string" && Object.hasOwn(LEVELS, v);
