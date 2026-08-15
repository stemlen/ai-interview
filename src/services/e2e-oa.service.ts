import { dbService } from "./db.service";
import { evaluationService } from "./evaluation.service";
import { judgeService } from "./judge.service";
import { aiService } from "./ai.service";
import {
  getBuiltinAptitudeQuestions,
  getBuiltinCodingQuestions,
  getBuiltinMCQs,
} from "@/src/data/e2e-builtin-questions";
import { fallbackBlueprint } from "./offline-fallbacks";
import { buildOAReport } from "./report-engine";
import type {
  InterviewContext,
  InterviewSession,
  OAReport,
} from "@/src/types";

function sanitizeQuestions(session: InterviewSession) {
  return {
    mcqQuestions: session.mcqQuestions.map(
      ({ correctAnswer, explanation, ...rest }) => rest
    ),
    codingQuestions: session.codingQuestions,
    aptitudeQuestions: session.aptitudeQuestions.map(
      ({ correctAnswer, explanation, ...rest }) => rest
    ),
  };
}

export const e2eOAService = {
  async startSession(userId: string, context: InterviewContext): Promise<InterviewSession> {
    // DeepSeek V4 Flash (30s timeout → local builtin bank)
    const blueprint = await aiService
      .generateBlueprint(context)
      .catch(() => fallbackBlueprint(context));
    const sessionId = `e2e-oa-${Math.random().toString(36).slice(2, 11)}`;

    const [mcqQuestions, codingQuestions, aptitudeQuestions] = await Promise.all([
      aiService.generateMCQs(blueprint).catch(() => getBuiltinMCQs(blueprint.skills)),
      aiService.generateCodingQuestions(blueprint).catch(() => getBuiltinCodingQuestions()),
      aiService
        .generateAptitudeQuestions(blueprint)
        .catch(() => getBuiltinAptitudeQuestions()),
    ]);

    const session: InterviewSession = {
      id: sessionId,
      userId,
      blueprint,
      mcqStatus: "not_started",
      codingStatus: "not_started",
      aptitudeStatus: "not_started",
      mcqQuestions:
        mcqQuestions?.length > 0 ? mcqQuestions : getBuiltinMCQs(blueprint.skills),
      codingQuestions:
        codingQuestions?.length > 0 ? codingQuestions : getBuiltinCodingQuestions(),
      aptitudeQuestions:
        aptitudeQuestions?.length > 0
          ? aptitudeQuestions
          : getBuiltinAptitudeQuestions(),
      mcqAnswers: {},
      codingAnswers: {},
      aptitudeAnswers: {},
      violations: [],
      evaluation: null,
      report: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dbService.createSession(session);
    return session;
  },

  async getSession(sessionId: string) {
    return dbService.getSession(sessionId);
  },

  getClientQuestions(session: InterviewSession) {
    return sanitizeQuestions(session);
  },

  async submitMCQ(
    sessionId: string,
    answers: Record<string, string>,
    violations: { type: string; timestamp: string }[] = []
  ) {
    const session = await dbService.getSession(sessionId);
    if (!session) throw new Error("OA session not found.");

    session.mcqAnswers = answers;
    session.mcqStatus = "completed";
    session.codingStatus = "in_progress";
    session.violations = [...(session.violations || []), ...violations];
    session.updatedAt = new Date().toISOString();
    await dbService.saveSession(session);
    return session;
  },

  async submitCoding(
    sessionId: string,
    questionId: string,
    code: string,
    language: string,
    submitAll = false,
    violations: { type: string; timestamp: string }[] = []
  ) {
    const session = await dbService.getSession(sessionId);
    if (!session) throw new Error("OA session not found.");

    const question = session.codingQuestions.find((q) => q.id === questionId);
    if (!question) throw new Error("Coding question not found.");

    const runResult = await judgeService.executeCode(code, language, question);
    const feedback = await aiService.evaluateCodeSubmission(
      question,
      code,
      language,
      {
        passed: runResult.passed,
        total: runResult.total,
      }
    );

    session.codingAnswers[questionId] = {
      code,
      language,
      passedCount: runResult.passed,
      totalCount: runResult.total,
      status: runResult.status,
      feedback,
    };
    session.violations = [...(session.violations || []), ...violations];

    if (submitAll) {
      session.codingStatus = "completed";
      session.aptitudeStatus = "in_progress";
    }

    session.updatedAt = new Date().toISOString();
    await dbService.saveSession(session);

    return {
      session,
      compilerStatus: runResult.status,
      passed: runResult.passed,
      total: runResult.total,
      results: runResult.results,
      runtime: runResult.runtime,
      memory: runResult.memory,
      feedback,
    };
  },

  async submitAptitude(
    sessionId: string,
    answers: Record<string, string>,
    violations: { type: string; timestamp: string }[] = []
  ) {
    const session = await dbService.getSession(sessionId);
    if (!session) throw new Error("OA session not found.");

    const intermediate: InterviewSession = {
      ...session,
      aptitudeAnswers: answers,
      aptitudeStatus: "completed",
      violations: [...(session.violations || []), ...violations],
      updatedAt: new Date().toISOString(),
    };

    const evaluation = await evaluationService.evaluateSession(intermediate);
    intermediate.evaluation = evaluation;

    const report: OAReport = await buildOAReport(intermediate);

    intermediate.report = report;
    await dbService.saveSession(intermediate);

    return {
      session: intermediate,
      passed: evaluation.passed,
      overallScore: evaluation.overallScore,
      report,
    };
  },
};
