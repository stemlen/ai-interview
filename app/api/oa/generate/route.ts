import { NextResponse } from "next/server";
import { aiService } from "@/src/services/ai.service";
import { dbService } from "@/src/services/db.service";
import {
  fallbackMCQs,
  fallbackCodingQuestions,
  fallbackAptitudeQuestions,
} from "@/src/services/offline-fallbacks";
import type { InterviewSession } from "@/src/types";

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required." },
        { status: 400 }
      );
    }

    const session = await dbService.getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found." },
        { status: 404 }
      );
    }

    // Check if questions are already generated
    const hasMCQs = session.mcqQuestions?.length > 0;
    const hasCoding = session.codingQuestions?.length > 0;
    const hasAptitude = session.aptitudeQuestions?.length > 0;

    if (hasMCQs && hasCoding && hasAptitude) {
      // Omit correct answers and explanations for cheating prevention
      const cleanMCQs = session.mcqQuestions.map(({ correctAnswer, explanation, ...rest }) => rest);
      const cleanAptitude = session.aptitudeQuestions.map(({ correctAnswer, explanation, ...rest }) => rest);

      return NextResponse.json({
        mcqQuestions: cleanMCQs,
        codingQuestions: session.codingQuestions, // Coding questions do not contain simple answers
        aptitudeQuestions: cleanAptitude,
      });
    }

    // Generate in parallel with fallback protection
    const [rawMCQs, rawCoding, rawAptitude] = await Promise.all([
      aiService.generateMCQs(session.blueprint).catch(() => fallbackMCQs(session.blueprint)),
      aiService.generateCodingQuestions(session.blueprint).catch(() => fallbackCodingQuestions()),
      aiService.generateAptitudeQuestions(session.blueprint).catch(() => fallbackAptitudeQuestions()),
    ]);

    const mcqQuestions = rawMCQs?.length > 0 ? rawMCQs : fallbackMCQs(session.blueprint);
    const codingQuestions = rawCoding?.length > 0 ? rawCoding : fallbackCodingQuestions();
    const aptitudeQuestions = rawAptitude?.length > 0 ? rawAptitude : fallbackAptitudeQuestions();

    // Update session
    const updatedSession: InterviewSession = {
      ...session,
      mcqQuestions,
      codingQuestions,
      aptitudeQuestions,
      updatedAt: new Date().toISOString(),
    };

    await dbService.saveSession(updatedSession);

    // Omit correct answers and explanations for cheating prevention
    const cleanMCQs = mcqQuestions.map(({ correctAnswer, explanation, ...rest }) => rest);
    const cleanAptitude = aptitudeQuestions.map(({ correctAnswer, explanation, ...rest }) => rest);

    return NextResponse.json({
      mcqQuestions: cleanMCQs,
      codingQuestions,
      aptitudeQuestions: cleanAptitude,
    });
  } catch (err: any) {
    console.error("Error generating questions:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate assessment questions." },
      { status: 500 }
    );
  }
}
