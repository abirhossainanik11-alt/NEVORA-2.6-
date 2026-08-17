import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Mirrors the cookie name used in lib/auth.ts (kept in sync manually since
// middleware runs on the Edge runtime and can't import the Prisma-backed
// lib/auth.ts helpers directly).
const SESSION_COOKIE = "nevora_session";

// Routes that never require a session.
const PUBLIC_PATHS = new Set(["/login", "/privacy", "/terms"]);

async function getSessionFromRequest(req: NextRequest): Promise<{ userId: string; role: "USER" | "ADMIN" } | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const secretValue = process.env.NEVORA_SESSION_SECRET;
  if (!secretValue) return null; // misconfigured deployment — treat as logged out, never crash the request

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secretValue));
    if (typeof payload.sub !== "string" || (payload.role !== "USER" && payload.role !== "ADMIN")) return null;
    return { userId: payload.sub, role: payload.role };
  } catch {
    return null; // expired / tampered — treat as logged out
  }
}

/**
 * Page-level route guard. This is a UX layer on top of, not a replacement
 * for, the server-side requireUser()/requireAdmin() checks already enforced
 * inside every /api route handler — those remain the real authorization
 * boundary. This middleware only decides which PAGE to render/redirect to.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await getSessionFromRequest(req);

  if (pathname === "/login") {
    return session ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  }

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on all page routes; explicitly skip API routes (which enforce their
  // own auth and must return JSON, not redirects), static assets, and Next
  // internals.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
