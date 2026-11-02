import NextAuth, { CredentialsSignin, type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { checkMemberPin, clientIp, type PinCheck } from "@/server/pin";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
    pinVersion?: number;
  }
  interface User {
    pinVersion?: number;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    uid?: string;
    pv?: number;
  }
}

/** `code` ends up in the login page URL, so it only says which message to show. */
export class PinSignInError extends CredentialsSignin {
  constructor(public code: Extract<PinCheck, { ok: false }>["reason"]) {
    super();
  }
}

/** Every member who logs in gets a User row, which carries the role (admin or member). */
async function userForMember(memberId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${memberId}))`;
    const m = await tx.member.findUniqueOrThrow({ where: { id: memberId }, include: { user: true } });
    if (m.user) return m.user;
    const user = await tx.user.create({ data: { name: m.nickname } });
    await tx.member.update({ where: { id: m.id }, data: { userId: user.id } });
    return user;
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 60 },
  pages: { signIn: "/login" },
  // A wrong PIN is normal use, not a server error worth a stack trace.
  logger: { error: (e) => { if (!(e instanceof CredentialsSignin)) console.error(e); } },
  providers: [
    Credentials({
      id: "pin",
      name: "PIN",
      credentials: { memberId: {}, pin: {} },
      authorize: async (c, request) => {
        const memberId = String(c?.memberId ?? "");
        const pin = String(c?.pin ?? "");
        if (!memberId || !/^\d{1,8}$/.test(pin)) throw new PinSignInError("wrong");
        const result = await checkMemberPin(memberId, pin, clientIp(request.headers));
        if (!result.ok) throw new PinSignInError(result.reason);
        const user = await userForMember(memberId);
        return { id: user.id, name: user.name, pinVersion: result.pinVersion };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.pv = user.pinVersion;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) session.user.id = token.uid;
      session.pinVersion = token.pv;
      return session;
    },
  },
});
