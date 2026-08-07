import { NextResponse } from "next/server";
import { aiService } from "@/src/services/ai.service";
import { dbService } from "@/src/services/db.service";
import { fallbackBlueprint } from "@/src/services/offline-fallbacks";
import type { InterviewSession, InterviewBlueprint } from "@/src/types";

export async function POST(req: Request) {
  try {
    const { context, userId } = await req.json();

    if (!context || !userId) {
      return NextResponse.json(
        { error: "Context and userId are required fields." },
        { status: 400 }
      );
    }

    // 1. Generate Interview Blueprint with fallback protection
    const blueprint: InterviewBlueprint = await aiService
      .generateBlueprint(context)
      .catch(() => fallbackBlueprint(context));

    // 2. Initialize Session ID and structure
    const sessionId = `session-${Math.random().toString(36).substr(2, 9)}`;
    const session: InterviewSession = {
      id: sessionId,
      userId,
      blueprint,
      mcqStatus: "not_started",
      codingStatus: "not_started",
      aptitudeStatus: "not_started",
      mcqQuestions: [],
      codingQuestions: [],
      aptitudeQuestions: [],
      mcqAnswers: {},
      codingAnswers: {},
      aptitudeAnswers: {},
      violations: [],
      evaluation: null,
      report: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 3. Save to database
    await dbService.createSession(session);

    return NextResponse.json({
      sessionId,
      blueprint,
    });
  } catch (err: any) {
    console.error("Error starting OA assessment:", err);
    return NextResponse.json(
      { error: err.message || "Failed to start assessment." },
      { status: 500 }
    );
  }
}
