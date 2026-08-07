import { NextResponse } from "next/server";
import { aiInterviewService } from "@/src/services/ai-interview.service";

/** Dedicated E2E AI start — GPT OSS 20b questions (local fallback after 30s). */
export async function POST(req: Request) {
  try {
    const { context, userId } = await req.json();
    if (!context || !userId) {
      return NextResponse.json(
        { error: "context and userId are required." },
        { status: 400 }
      );
    }
    const session = await aiInterviewService.startSession(userId, context);
    return NextResponse.json({ sessionId: session.id, session });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to start E2E AI interview." },
      { status: 500 }
    );
  }
}
