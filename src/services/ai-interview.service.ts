import { dbService } from "./db.service";
import { aiService } from "./ai.service";
import { aiInterviewPrompts } from "../prompts/ai-interview.prompt";
import { fallbackBlueprint } from "./offline-fallbacks";
import {
  scoreAnswerLocally,
  buildVerbalInterviewReport,
} from "./report-engine";
import type {
  InterviewContext,
  AIInterviewSession,
  AIQuestion,
  InterviewBlueprint,
} from "../types";

export const AI_INTERVIEW_QUESTION_COUNT = 10;

const FALLBACK_QUESTIONS = [
  (role: string, skill: string) =>
    `Hello! Welcome to your technical interview for the ${role} position. To kick things off, can you explain the difference between let, const, and var in JavaScript, and when you would prefer one over the others?`,
  (_role: string, skill: string) =>
    `Great. Let's talk about ${skill}. Can you walk me through how you would design a reusable component or module using ${skill} in a production application?`,
  () =>
    `How do you handle asynchronous operations in JavaScript? Please compare callbacks, promises, and async/await with a practical example.`,
  (_role: string, skill: string) =>
    `Tell me about a challenging bug you faced while working with ${skill}. How did you diagnose and resolve it?`,
  () =>
    `Explain the difference between SQL and NoSQL databases. When would you choose MongoDB over PostgreSQL, or vice versa?`,
  () =>
    `How would you optimize the performance of a slow React application? Mention specific techniques you have used.`,
  () =>
    `Describe how authentication and authorization typically work in a Node.js / Express API. What security practices do you follow?`,
  () =>
    `Walk me through how you would design a REST API for a job board. Which endpoints would you create and why?`,
  () =>
    `Tell me about a project you are proud of. What was your role, the tech stack, and the hardest technical decision you made?`,
  () =>
    `Finally, how do you stay up to date with new technologies, and what would you want to learn next in your career?`,
];

function getFallbackQuestionText(index: number, blueprint: InterviewBlueprint): string {
  const role = blueprint.role || "Software Engineer";
  const skill = blueprint.skills[index % blueprint.skills.length] || "React";
  const factory = FALLBACK_QUESTIONS[Math.min(index, FALLBACK_QUESTIONS.length - 1)];
  return factory(role, skill);
}

function buildFallbackQuestionList(blueprint: InterviewBlueprint, count: number): string[] {
  return Array.from({ length: count }, (_, i) => getFallbackQuestionText(i, blueprint));
}

export const aiInterviewService = {
  async startSession(userId: string, context: InterviewContext): Promise<AIInterviewSession> {
    const sessionId = "ai-session-" + Math.random().toString(36).substring(2, 11);
    const targetCount = AI_INTERVIEW_QUESTION_COUNT;

    const blueprint = await aiService
      .generateBlueprint(context)
      .catch(() => fallbackBlueprint(context));

    const batchPrompt = aiInterviewPrompts.getAIBatchQuestionsPrompt(blueprint, targetCount);
    const batch = await aiService.generateJSON<{ questions: string[] }>(batchPrompt, () => ({
      questions: buildFallbackQuestionList(blueprint, targetCount),
    }));

    const texts = (batch.questions || [])
      .map((q) => (typeof q === "string" ? q.trim() : ""))
      .filter(Boolean);

    const fallbacks = buildFallbackQuestionList(blueprint, targetCount);
    while (texts.length < targetCount) {
      texts.push(fallbacks[texts.length % fallbacks.length]);
    }

    const questions: AIQuestion[] = texts.slice(0, targetCount).map((questionText, i) => ({
      id: `q-${i + 1}`,
      questionText,
      evaluation: null,
    }));

    const session: AIInterviewSession = {
      id: sessionId,
      userId,
      blueprint,
      status: "in_progress",
      currentQuestionIndex: 0,
      questions,
      violations: [],
      timeline: [
        {
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          label: "Introduction",
        },
      ],
      evaluation: null,
      report: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dbService.saveAISession(session);
    return session;
  },

  async finalizeWithReport(session: AIInterviewSession): Promise<AIInterviewSession> {
    session.questions = session.questions.filter(
      (q) => q.answerText != null || q.evaluation != null
    );

    const built = await buildVerbalInterviewReport(session, "ai");
    session.status = "completed";
    session.evaluation = built.evaluation;
    session.report = built.report;
    session.timeline = built.report.timeline || session.timeline;
    return session;
  },

  async submitAnswer(
    sessionId: string,
    questionId: string,
    answerText: string,
    violations: { type: string; timestamp: string }[] = [],
    endInterview = false
  ): Promise<AIInterviewSession> {
    const session = await dbService.getAISession(sessionId);
    if (!session) {
      throw new Error("AI Interview Session not found.");
    }

    const currentQuestionIndex = session.questions.findIndex((q) => q.id === questionId);
    if (currentQuestionIndex === -1) {
      throw new Error("Question not found in this session.");
    }

    session.questions[currentQuestionIndex].answerText = answerText || "(Skipped)";

    if (violations && violations.length > 0) {
      session.violations = [...session.violations, ...violations];
    }

    // Honest provisional score mid-interview (idk → ~0–8). Final GPT report re-scores at end.
    session.questions[currentQuestionIndex].evaluation = scoreAnswerLocally(answerText || "");

    const nextIndex = currentQuestionIndex + 1;
    const isLast = nextIndex >= session.questions.length;

    if (endInterview || isLast) {
      await this.finalizeWithReport(session);
    } else {
      session.currentQuestionIndex = nextIndex;

      if (nextIndex === 3) {
        session.timeline.push({
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          label: "Core Technical Concepts",
        });
      } else if (nextIndex === 6) {
        session.timeline.push({
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          label: "Project Architecture",
        });
      } else if (nextIndex === 8) {
        session.timeline.push({
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          label: "Behavioral & Scenarios",
        });
      }
    }

    session.updatedAt = new Date().toISOString();
    await dbService.saveAISession(session);
    return session;
  },
};
