/**
 * Every URL in the app, in one place. Used both for links and for cache revalidation,
 * so renaming a route can't silently leave a page stale.
 */
export type SessionTab = "players" | "courts" | "bills" | "history";

export const paths = {
  home: "/",
  login: (next?: string) => (next ? `/login?next=${encodeURIComponent(next)}` : "/login"),
  welcome: "/welcome",
  me: "/me",

  sessions: "/sessions",
  pastSessions: "/sessions?show=past",
  newSession: "/sessions/new",
  session: (id: string, tab?: SessionTab) => `/sessions/${id}${tab ? `?tab=${tab}` : ""}`,
  editSession: (id: string) => `/sessions/${id}/edit`,

  members: "/members",
  newMember: "/members/new",
  member: (id: string) => `/members/${id}`,

  stats: "/stats",
  finance: "/finance",
  settings: "/settings",
  activity: (group?: string) => (group && group !== "all" ? `/activity?g=${group}` : "/activity"),

  pay: (chargeId: string) => `/pay/${chargeId}`,
  claim: (token: string) => `/claim/${token}`,

  api: { sessionVersion: (id: string) => `/api/sessions/${id}/version` },
} as const;
