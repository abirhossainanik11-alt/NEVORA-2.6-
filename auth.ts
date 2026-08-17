import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";

const SESSION_COOKIE = "nevora_session";
const secret = () => new TextEncoder().encode(requireEnv("NEVORA_SESSION_SECRET"));

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. Simple auth requires a session secret in the environment.`);
  return v;
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function createSession(userId: string, role: "USER" | "ADMIN") {
  const token = await new SignJWT({ sub: userId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  cookies().delete(SESSION_COOKIE);
}

export async function getSession(): Promise<{ userId: string; role: "USER" | "ADMIN" } | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { userId: payload.sub as string, role: payload.role as "USER" | "ADMIN" };
  } catch {
    return null; // expired / tampered — treat as logged out
  }
}

/** Use at the top of every /api/admin/* route. Server-side enforcement, not just a hidden button (§75). */
export async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new AuthError(401, "Not authenticated.");
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.role !== "ADMIN") throw new AuthError(403, "Admin access required.");
  return user;
}

export async function requireUser() {
  const session = await getSession();
  if (!session) throw new AuthError(401, "Not authenticated.");
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) throw new AuthError(401, "Not authenticated.");
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
