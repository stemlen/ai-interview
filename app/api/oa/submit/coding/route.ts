import { NextResponse } from "next/server";
import { dbService } from "@/src/services/db.service";
import { judgeService } from "@/src/services/judge.service";
import { aiService } from "@/src/services/ai.service";
import type { InterviewSession } from "@/src/types";

export async function POST(req: Request) {
  try {
    const { sessionId, questionId, code, language, submitAll, violations } = await req.json();

    if (!sessionId || !questionId || code === undefined || !language) {
      return NextResponse.json(
        { error: "sessionId, questionId, code, and language are required fields." },
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

    const question = session.codingQuestions.find((q) => q.id === questionId);
    if (!question) {
      return NextResponse.json(
        { error: "Coding question not found in this session." },
        { status: 404 }
      );
    }

    // 1. Compile & run test cases
    const runResult = await judgeService.executeCode(code, language, question);

    // 2. Perform AI code analysis (GPT OSS 20b)
    const feedback = await aiService.evaluateCodeSubmission(
      question,
      code,
      language,
      {
        passed: runResult.passed,
        total: runResult.total,
        compilerOutput: runResult.compilerOutput,
      }
    );

    // 3. Save submission details
    const codingAnswers = session.codingAnswers || {};
    codingAnswers[questionId] = {
      code,
      language,
      passedCount: runResult.passed,
      totalCount: runResult.total,
      status: runResult.status,
      feedback,
    };

    // Append violations
    const existingViolations = session.violations || [];
    const newViolations = violations || [];
    const combinedViolations = [...existingViolations, ...newViolations];

    // Check if we are locking the entire coding round
    let codingStatus = session.codingStatus;
    let aptitudeStatus = session.aptitudeStatus;

    if (submitAll) {
      codingStatus = "completed";
      aptitudeStatus = "in_progress"; // Auto-unlock aptitude
    }

    const updatedSession: InterviewSession = {
      ...session,
      codingAnswers,
      violations: combinedViolations,
      codingStatus,
      aptitudeStatus,
      updatedAt: new Date().toISOString(),
    };

    await dbService.saveSession(updatedSession);

    return NextResponse.json({
      compilerStatus: runResult.status,
      passed: runResult.passed,
      total: runResult.total,
      results: runResult.results,
      feedback,
    });
  } catch (err: any) {
    console.error("Error evaluating coding submission:", err);
    return NextResponse.json(
      { error: err.message || "Failed to compile or evaluate code." },
      { status: 500 }
    );
  }
}
