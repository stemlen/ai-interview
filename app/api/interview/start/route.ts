import { NextResponse } from "next/server";
import { dbService } from "@/src/services/db.service";
import { aiService } from "@/src/services/ai.service";
import { fallbackBlueprint } from "@/src/services/offline-fallbacks";
import type { FullInterviewSession, InterviewContext } from "@/src/types";

export async function POST(req: Request) {
  try {
    const { context, userId } = await req.json();

    if (!context || !userId) {
      return NextResponse.json(
        { error: "Context and userId are required fields." },
        { status: 400 }
      );
    }

    // GPT OSS 20b blueprint (30s timeout → local fallback)
    const blueprint = await aiService
      .generateBlueprint(context as InterviewContext)
      .catch(() => fallbackBlueprint(context as InterviewContext));

    const sessionId = `full-session-${Math.random().toString(36).substr(2, 9)}`;
    const session: FullInterviewSession = {
      id: sessionId,
      userId,
      blueprint,
      status: "in_progress",
      oaSessionId: null,
      aiSessionId: null,
      audioSessionId: null,
      currentRound: "oa",
      evaluation: null,
      report: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dbService.saveFullSession(session);

    return NextResponse.json({
      sessionId,
      session,
    });
  } catch (err: any) {
    console.error("Error starting Full Interview:", err);
    return NextResponse.json(
      { error: err.message || "Failed to start full interview." },
      { status: 500 }
    );
  }
}
