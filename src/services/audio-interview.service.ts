import { dbService } from "./db.service";
import { aiService } from "./ai.service";
import { audioInterviewPrompts } from "../prompts/audio-interview.prompt";
import { fallbackBlueprint } from "./offline-fallbacks";
import {
  scoreAnswerLocally,
  buildVerbalInterviewReport,
} from "./report-engine";
import type {
  InterviewContext,
  AudioInterviewSession,
  AudioInterviewSettings,
  AIQuestion,
  InterviewBlueprint,
} from "../types";

export function getAudioTargetQuestionCount(duration: number): number {
  if (duration === 5) return 5;
  if (duration === 10) return 10;
  if (duration === 20) return 15;
  if (duration === 30) return 20;
  return 10;
}

function buildFallbackAudioQuestions(
  blueprint: InterviewBlueprint,
  settings: AudioInterviewSettings,
  count: number
): string[] {
  const role = blueprint.role || "Software Engineer";
  const skills = blueprint.skills.length > 0 ? blueprint.skills : ["JavaScript", "React", "Node.js"];
  const bank: string[] = [
    `Hello, welcome to your audio mock interview for the ${role} position. Let's start with a core concept. Can you explain your experience with ${skills[0]} and how you typically apply it in your projects?`,
    `Great. Walk me through how you would design a reusable module using ${skills[1 % skills.length]} in a production application.`,
    `How do you handle asynchronous operations in JavaScript? Compare callbacks, promises, and async/await with a practical example.`,
    `Tell me about a challenging bug you faced with ${skills[2 % skills.length]}. How did you diagnose and resolve it?`,
    `Explain the difference between SQL and NoSQL databases. When would you choose one over the other?`,
    `How would you optimize the performance of a slow frontend application? Mention specific techniques you have used.`,
    `Describe how authentication and authorization typically work in a Node.js API. What security practices do you follow?`,
    `Walk me through how you would design a REST API for a job board. Which endpoints would you create and why?`,
    `Tell me about a project you are proud of. What was your role, the tech stack, and the hardest technical decision you made?`,
    `How do you stay up to date with new technologies, and what would you want to learn next?`,
    `Explain the difference between horizontal and vertical scaling, with an example from a system you know.`,
    `What is the event loop in Node.js, and how does it affect writing non-blocking code?`,
    `How would you approach debugging a production memory leak?`,
    `Describe a time you disagreed with a teammate on a technical decision. How did you resolve it?`,
    `What caching strategies have you used, and when would you choose Redis versus in-memory caching?`,
    `Explain idempotency in APIs and why it matters for payment or write endpoints.`,
    `How do you structure error handling across a large TypeScript codebase?`,
    `What trade-offs do you consider when choosing between monolith and microservices?`,
    `Walk me through your approach to writing meaningful unit and integration tests.`,
    `Finally, what questions would you ask your interviewer about the role or team?`,
  ];

  if (settings.practiceMode === "HR Round") {
    return Array.from({ length: count }, (_, i) =>
      [
        `Hello and welcome. Tell me about yourself and why you are interested in the ${role} role.`,
        `Where do you see yourself in five years?`,
        `Describe a conflict at work and how you handled it.`,
        `What motivates you in a team environment?`,
        `Why should we hire you for this position?`,
        `How do you handle tight deadlines and pressure?`,
        `What is your preferred work culture?`,
        `Tell me about a time you failed and what you learned.`,
        `How do you prioritize tasks when everything feels urgent?`,
        `Do you have any questions for us?`,
      ][i % 10]
    );
  }

  return Array.from({ length: count }, (_, i) => bank[i % bank.length]);
}

function evaluateAnswerLocal(answerText: string) {
  return scoreAnswerLocally(answerText);
}

async function completeAudioSession(session: AudioInterviewSession): Promise<void> {
  session.questions = session.questions.filter(
    (q) => q.answerText != null || q.evaluation != null
  );

  const built = await buildVerbalInterviewReport(session, "audio");
  session.status = "completed";
  session.evaluation = built.evaluation;
  session.report = built.report;
  session.timeline = built.report.timeline || session.timeline;
}

export const audioInterviewService = {
  /**
   * Start a new Audio Interview session with ALL questions pre-generated.
   */
  async startSession(
    userId: string,
    context: InterviewContext,
    settings: AudioInterviewSettings
  ): Promise<AudioInterviewSession> {
    const sessionId = "audio-session-" + Math.random().toString(36).substring(2, 11);
    const targetCount = getAudioTargetQuestionCount(settings.duration);

    const blueprint = await aiService
      .generateBlueprint(context)
      .catch(() => fallbackBlueprint(context));

    const batchPrompt = audioInterviewPrompts.getAudioBatchQuestionsPrompt(
      blueprint,
      settings,
      targetCount
    );

    const batch = await aiService.generateJSON<{ questions: string[] }>(batchPrompt, () => ({
      questions: buildFallbackAudioQuestions(blueprint, settings, targetCount),
    }));

    const texts = (batch.questions || [])
      .map((q) => (typeof q === "string" ? q.trim() : ""))
      .filter(Boolean);

    const fallbacks = buildFallbackAudioQuestions(blueprint, settings, targetCount);
    while (texts.length < targetCount) {
      texts.push(fallbacks[texts.length % fallbacks.length]);
    }

    const questions: AIQuestion[] = texts.slice(0, targetCount).map((questionText, i) => ({
      id: `q-${i + 1}`,
      questionText,
      evaluation: null,
    }));

    const session: AudioInterviewSession = {
      id: sessionId,
      userId,
      blueprint,
      settings,
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

    await dbService.saveAudioSession(session);
    return session;
  },

  /**
   * Submit answer and advance to the next preloaded question (no live question generation).
   */
  async submitAnswer(
    sessionId: string,
    questionId: string,
    answerText: string,
    violations: { type: string; timestamp: string }[] = [],
    endInterview: boolean = false
  ): Promise<AudioInterviewSession> {
    const session = await dbService.getAudioSession(sessionId);
    if (!session) {
      throw new Error("Audio Session not found.");
    }

    const currentQuestionIndex = session.questions.findIndex((q) => q.id === questionId);
    if (currentQuestionIndex === -1) {
      throw new Error("Question not found in session.");
    }

    session.questions[currentQuestionIndex].answerText =
      answerText || "(No verbal response provided)";

    if (violations && violations.length > 0) {
      session.violations = [...session.violations, ...violations];
    }

    // Instant local scoring — no GPT call mid-interview so the live flow stays smooth
    session.questions[currentQuestionIndex].evaluation = evaluateAnswerLocal(
      answerText || ""
    );

    const nextIndex = currentQuestionIndex + 1;
    const isLast = nextIndex >= session.questions.length;

    if (endInterview || isLast) {
      await completeAudioSession(session);
    } else {
      session.currentQuestionIndex = nextIndex;

      const total = session.questions.length;
      if (nextIndex === Math.floor(total / 4)) {
        session.timeline.push({
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          label: "Core Technical Concepts",
        });
      } else if (nextIndex === Math.floor(total / 2)) {
        session.timeline.push({
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          label: "Detailed Engineering Deep-Dive",
        });
      } else if (nextIndex === Math.floor((3 * total) / 4)) {
        session.timeline.push({
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          label: "Behavioral & Applied Scenarios",
        });
      }
    }

    session.updatedAt = new Date().toISOString();
    await dbService.saveAudioSession(session);
    return session;
  },
};
