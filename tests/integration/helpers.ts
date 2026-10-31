/** Build a FormData from a plain object (what a browser form would send). */
export const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

export const DENIED_ADMIN = { ok: false, error: "เฉพาะหัวก๊วนเท่านั้น" };
export const DENIED_LOGIN = { ok: false, error: "กรุณาเข้าสู่ระบบ" };
