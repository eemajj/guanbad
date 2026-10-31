/**
 * สร้างข้อความ QR พร้อมเพย์ตามมาตรฐาน EMVCo (Thai QR Payment)
 * รองรับเบอร์มือถือ (10 หลัก), เลขประจำตัวประชาชน (13 หลัก) และ e-Wallet ID (15 หลัก)
 */

const tlv = (id: string, value: string) => id + String(value.length).padStart(2, "0") + value;

export function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function normalizePromptpayId(raw: string): { type: "phone" | "nationalId" | "ewallet"; value: string } | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("0")) return { type: "phone", value: digits };
  if (digits.length === 13) return { type: "nationalId", value: digits };
  if (digits.length === 15) return { type: "ewallet", value: digits };
  return null;
}

/** @param amountBaht ยอดเงินเป็นบาท (ไม่ใส่ = ให้ผู้จ่ายกรอกเอง) */
export function promptpayPayload(target: string, amountBaht?: number): string | null {
  const id = normalizePromptpayId(target);
  if (!id) return null;

  let account: string;
  if (id.type === "phone") account = tlv("01", ("0000000000000" + "66" + id.value.slice(1)).slice(-13));
  else if (id.type === "nationalId") account = tlv("02", id.value);
  else account = tlv("03", id.value);

  const hasAmount = amountBaht !== undefined && amountBaht > 0;
  const body =
    tlv("00", "01") +
    tlv("01", hasAmount ? "12" : "11") +
    tlv("29", tlv("00", "A000000677010111") + account) +
    tlv("53", "764") +
    (hasAmount ? tlv("54", amountBaht.toFixed(2)) : "") +
    tlv("58", "TH") +
    "6304";
  return body + crc16(body);
}
