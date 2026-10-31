import NextAuth, { type DefaultSession } from "next-auth";
import Line from "next-auth/providers/line";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/server/db";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

export const devLoginEnabled = process.env.ALLOW_DEV_LOGIN === "true";
export const lineLoginEnabled = Boolean(process.env.AUTH_LINE_ID && process.env.AUTH_LINE_SECRET);

const adminLineIds = (process.env.ADMIN_LINE_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Create or update our own User row for an external login, and decide the role. */
async function upsertUser(externalId: string, name: string, image?: string | null) {
  const existing = await prisma.user.findUnique({ where: { lineId: externalId } });
  if (existing) {
    return prisma.user.update({ where: { id: existing.id }, data: { name, image: image ?? existing.image } });
  }
  const listedAdmin = adminLineIds.includes(externalId.replace(/^line:/, ""));
  const anyAdmin = await prisma.user.count({ where: { role: "ADMIN" } });
  return prisma.user.create({
    data: { lineId: externalId, name, image, role: listedAdmin || anyAdmin === 0 ? "ADMIN" : "MEMBER" },
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 60 },
  pages: { signIn: "/login" },
  providers: [
    ...(lineLoginEnabled ? [Line] : []),
    ...(devLoginEnabled
      ? [
          Credentials({
            id: "dev",
            name: "ทดสอบ",
            credentials: { name: { label: "ชื่อ" } },
            authorize: async (c) => {
              const name = String(c?.name ?? "")
                .trim()
                .slice(0, 40);
              return name ? { id: `dev:${name}`, name } : null;
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, account, user, profile }) {
      if (account) {
        const externalId = account.provider === "line" ? `line:${account.providerAccountId}` : String(user?.id);
        const name = (profile?.name as string | undefined) ?? user?.name ?? "สมาชิก";
        const image = (profile?.picture as string | undefined) ?? user?.image ?? null;
        const dbUser = await upsertUser(externalId, name, image);
        token.uid = dbUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
});
