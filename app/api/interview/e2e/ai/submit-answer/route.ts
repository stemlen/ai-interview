import { NextResponse } from "next/server";
import { aiInterviewService } from "@/src/services/ai-interview.service";

/** Dedicated E2E AI submit — DeepSeek V4 Flash evaluation (local fallback after 30s). */
export async function POST(req: Request) {
  try {
    const { sessionId, questionId, answerText, violations, endInterview } =
      await req.json();
    if (!sessionId || !questionId) {
      return NextResponse.json(
        { error: "sessionId and questionId are required." },
        { status: 400 }
      );
    }
    const session = await aiInterviewService.submitAnswer(
      sessionId,
      questionId,
      answerText || "",
      violations || [],
      Boolean(endInterview)
    );
    return NextResponse.json({ session });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to submit answer." },
      { status: 500 }
    );
  }
}
