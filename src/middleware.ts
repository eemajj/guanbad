import { NextResponse, type NextRequest } from "next/server";

/**
 * Passes the requested path to server components, so a member who opens a shared session link
 * while signed out lands back on that session after entering their PIN (see requireViewer).
 */
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/((?!api|_next|login|pay|favicon.ico).*)"] };
