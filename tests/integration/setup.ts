import { vi } from "vitest";

/** Who is "logged in" for the next action call. Set with actAs(). */
export const session: { userId: string | null } = { userId: null };

vi.mock("@/server/auth", () => ({
  auth: async () => (session.userId ? { user: { id: session.userId } } : null),
  signIn: vi.fn(),
  signOut: vi.fn(),
  devLoginEnabled: true,
  lineLoginEnabled: false,
}));

// Cache invalidation needs a running Next.js server; in tests it is a no-op.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock("server-only", () => ({}));
