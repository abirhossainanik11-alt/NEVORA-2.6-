import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import { requireUser, AuthError } from "../../../lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(); const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const convo = await prisma.conversation.findFirstOrThrow({ where: { id, userId: user.id }, include: { messages: { orderBy: { createdAt: "asc" }, include: { sources: true } } } });
      return NextResponse.json(convo);
    }
    return NextResponse.json(await prisma.conversation.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, include: { subject: true }, take: 100 }));
  } catch (err) { if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status }); return NextResponse.json({ error: "Conversation not found." }, { status: 404 }); }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser(); const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
    const deleted = await prisma.conversation.deleteMany({ where: { id, userId: user.id } });
    if (!deleted.count) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) { if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status }); return NextResponse.json({ error: "Could not delete conversation." }, { status: 500 }); }
}
