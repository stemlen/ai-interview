import type {
  AIInterviewSession,
  AudioInterviewSession,
  AIInterviewReport,
  InterviewSession,
  OAReport,
  InterviewBlueprint,
  UnifiedAssignmentReport,
  UnifiedReportSection,
} from "@/src/types";
import { aiService } from "@/src/services/ai.service";
import { evaluateVerbalAnswers } from "./evaluate-answers";
import {
  aggregateVerbalEvaluations,
  hiringRecommendationFromScore,
  readinessFromScore,
  VERBAL_PASS_THRESHOLD,
  OA_PASS_THRESHOLD,
  type AnswerEvaluationResult,
  type VerbalRollup,
} from "./aggregate";
import {
  getVerbalNarrativeReportPrompt,
  getOANarrativeReportPrompt,
  getFullInterviewNarrativePrompt,
} from "@/src/prompts/report-engine.prompt";

function durationLabel(createdAt: string): string {
  const mins = Math.max(
    1,
    Math.round((Date.now() - new Date(createdAt).getTime()) / 60000)
  );
  return `${mins}:00`;
}

function violationsSummary(
  violations: { type: string; timestamp: string }[]
): {
  tabSwitches: number;
  fullscreenExits: number;
  screenShareInterruptions: number;
  status: "Clean" | "Flagged" | "Suspicious";
  text: string;
} {
  const tabSwitches = violations.filter((v) => v.type === "tab_switch").length;
  const fullscreenExits = violations.filter((v) => v.type === "fullscreen_exit").length;
  const screenShareInterruptions = violations.filter(
    (v) => v.type === "screen_share_interrupted"
  ).length;
  const total = violations.length;
  const status: "Clean" | "Flagged" | "Suspicious" =
    total === 0 ? "Clean" : total < 4 ? "Flagged" : "Suspicious";
  return {
    tabSwitches,
    fullscreenExits,
    screenShareInterruptions,
    status,
    text: `${total} violation(s); tab=${tabSwitches}, fullscreen=${fullscreenExits}, screenshare=${screenShareInterruptions}; status=${status}`,
  };
}

async function narrativeVerbal(input: {
  module: "ai" | "audio";
  blueprint: InterviewBlueprint;
  rollup: VerbalRollup;
  hiringRecommendation: string;
  questions: {
    questionText: string;
    answerText: string;
    evaluation: AnswerEvaluationResult;
  }[];
  settingsSummary?: string;
  violationsSummary: string;
}): Promise<{
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  finalVerdict: string;
  executiveSummary: string;
}> {
  const prompt = getVerbalNarrativeReportPrompt(input);
  const fallback = () => {
    const low = input.rollup.overallScore < VERBAL_PASS_THRESHOLD;
    return {
      strengths: low
        ? input.rollup.refusedCount > 0
          ? []
          : ["Showed up and attempted the interview session."]
        : [
            "Demonstrated usable technical communication on several questions.",
            "Provided structured responses on stronger answers.",
          ],
      weaknesses: low
        ? [
            input.rollup.refusedCount > 0
              ? `Declined or gave non-answers on ${input.rollup.refusedCount} question(s).`
              : "Answers lacked technical depth and concrete examples.",
            "Did not meet the minimum bar for this role level.",
          ]
        : [
            "Some answers needed more depth on trade-offs and edge cases.",
            "Could strengthen production-level examples.",
          ],
      recommendations: [
        "Practice answering out loud with concrete project examples.",
        "Review core concepts tied to the target role skills.",
        "Avoid skipping — attempt a structured partial answer when unsure.",
      ],
      finalVerdict: `${input.hiringRecommendation}. Overall score ${input.rollup.overallScore}%.`,
      executiveSummary: low
        ? `Performance was below the ${VERBAL_PASS_THRESHOLD}% pass threshold (${input.rollup.overallScore}%).`
        : `Candidate cleared the verbal interview bar at ${input.rollup.overallScore}%.`,
    };
  };

  return aiService.generateJSON(prompt, fallback);
}

function toAIInterviewReport(args: {
  rollup: VerbalRollup;
  narrative: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    finalVerdict: string;
  };
  questions: {
    questionText: string;
    answerText: string;
    evaluation: AnswerEvaluationResult;
  }[];
  createdAt: string;
  proctoring: ReturnType<typeof violationsSummary>;
}): AIInterviewReport {
  const transcript = args.questions.flatMap((q, idx) => [
    { speaker: "AI" as const, text: q.questionText, timestamp: `${idx * 2}:00` },
    {
      speaker: "Candidate" as const,
      text: q.answerText,
      timestamp: `${idx * 2 + 1}:15`,
    },
  ]);

  return {
    candidateSummary: {
      overallScore: args.rollup.overallScore,
      technicalScore: args.rollup.technicalScore,
      communicationScore: args.rollup.communicationScore,
      problemSolvingScore: args.rollup.problemSolvingScore,
      confidenceScore: args.rollup.confidenceScore,
      duration: durationLabel(args.createdAt),
    },
    questionFeedback: args.questions.map((q) => ({
      question: q.questionText,
      answer: q.answerText,
      score: q.evaluation.score,
      feedback: q.evaluation.feedback,
      metrics: {
        accuracy: q.evaluation.technicalAccuracy,
        communication: q.evaluation.communication,
        problemSolving: q.evaluation.problemSolving,
        confidence: q.evaluation.confidence,
      },
    })),
    strengths:
      args.narrative.strengths.length > 0
        ? args.narrative.strengths
        : ["No material strengths identified in this session."],
    weaknesses: args.narrative.weaknesses,
    recommendations: args.narrative.recommendations,
    transcript,
    timeline: [
      { timestamp: "00:00", label: "Introduction" },
      { timestamp: "02:00", label: "Technical Q&A" },
      { timestamp: durationLabel(args.createdAt), label: "Interview Completed" },
    ],
    proctoringSummary: {
      tabSwitches: args.proctoring.tabSwitches,
      fullscreenExits: args.proctoring.fullscreenExits,
      screenShareInterruptions: args.proctoring.screenShareInterruptions,
      status: args.proctoring.status,
    },
  };
}

export async function buildVerbalInterviewReport(
  session: AIInterviewSession | AudioInterviewSession,
  module: "ai" | "audio"
): Promise<{
  evaluation: {
    overallScore: number;
    technicalScore: number;
    communicationScore: number;
    problemSolvingScore: number;
    confidenceScore: number;
    passed: boolean;
  };
  report: AIInterviewReport;
  rollup: VerbalRollup;
  hiringRecommendation: string;
}> {
  const answered = session.questions.filter(
    (q) => q.answerText != null || q.evaluation != null
  );
  const pairs = answered.map((q) => ({
    id: q.id,
    questionText: q.questionText,
    answerText: q.answerText || "",
  }));

  const evalMap = await evaluateVerbalAnswers(pairs, session.blueprint);

  // Attach evaluations onto a working copy
  const enriched = answered.map((q) => {
    const evaluation = evalMap.get(q.id)!;
    q.evaluation = evaluation;
    return {
      questionText: q.questionText,
      answerText: q.answerText || "(No answer)",
      evaluation,
    };
  });

  const rollup = aggregateVerbalEvaluations(enriched);
  const hiringRecommendation = hiringRecommendationFromScore(
    rollup.overallScore,
    rollup.refusedCount,
    enriched.length
  );
  const proctoring = violationsSummary(session.violations || []);

  const settingsSummary =
    module === "audio" && "settings" in session
      ? `duration=${session.settings.duration}m, difficulty=${session.settings.difficulty}, mode=${session.settings.practiceMode}, type=${session.settings.interviewType}`
      : undefined;

  const narrative = await narrativeVerbal({
    module,
    blueprint: session.blueprint,
    rollup,
    hiringRecommendation,
    questions: enriched,
    settingsSummary,
    violationsSummary: proctoring.text,
  });

  const report = toAIInterviewReport({
    rollup,
    narrative,
    questions: enriched,
    createdAt: session.createdAt,
    proctoring,
  });

  // Prefer GPT verdict text but keep recommendation aligned
  if (!report.recommendations.length && narrative.recommendations.length) {
    report.recommendations = narrative.recommendations;
  }

  return {
    evaluation: {
      overallScore: rollup.overallScore,
      technicalScore: rollup.technicalScore,
      communicationScore: rollup.communicationScore,
      problemSolvingScore: rollup.problemSolvingScore,
      confidenceScore: rollup.confidenceScore,
      passed: rollup.passed,
    },
    report,
    rollup,
    hiringRecommendation,
  };
}

export async function buildOAReport(session: InterviewSession): Promise<OAReport> {
  if (!session.evaluation) {
    throw new Error("OA session must be evaluated before report generation.");
  }
  const evalData = session.evaluation;
  const prompt = getOANarrativeReportPrompt({
    name: session.blueprint.candidateName,
    role: session.blueprint.role,
    experience: `${session.blueprint.yearsOfExperience} Years (${session.blueprint.experienceLevel})`,
    difficulty: session.blueprint.suggestedDifficulty,
    duration: `${evalData.timeTaken} Mins`,
    overallScore: evalData.overallScore,
    mcqScore: evalData.mcqScore,
    codingScore: evalData.codingScore,
    aptitudeScore: evalData.aptitudeScore,
    passed: evalData.passed,
    mcqStats: evalData.mcqStats,
    codingStats: {
      problemsAttempted: evalData.codingStats.problemsAttempted,
      passed: evalData.codingStats.passed,
      failed: evalData.codingStats.failed,
    },
    aptitudeStats: evalData.aptitudeStats,
    skills: session.blueprint.skills || [],
  });

  const narrative = await aiService.generateJSON<{
    strongAreas: string[];
    weakAreas: string[];
    personalizedLearningPath: string[];
    interviewReadiness: OAReport["interviewReadiness"];
    finalRecommendation: OAReport["finalRecommendation"];
    codingPerformance: {
      codeQuality: string;
      optimization: string;
      suggestions: string;
    };
    aptitudePerformance: OAReport["aptitudePerformance"];
    technicalPerformance: Record<string, number>;
  }>(prompt, () => {
    const low = evalData.overallScore < OA_PASS_THRESHOLD;
    return {
      strongAreas: low
        ? []
        : session.blueprint.skills.slice(0, 2).concat(["Basic problem setup"]),
      weakAreas: low
        ? ["Core fundamentals", "Coding correctness under time pressure"]
        : ["Edge-case handling", "Complexity optimization"],
      personalizedLearningPath: [
        "Practice timed MCQs on your core stack.",
        "Complete 3–5 coding problems focusing on arrays, hashes, and trees.",
        "Review aptitude mixed sets with a 15-minute timer.",
      ],
      interviewReadiness: readinessFromScore(evalData.overallScore),
      finalRecommendation: evalData.passed
        ? "Proceed to AI Interview"
        : "Retry OA Assessment",
      codingPerformance: {
        codeQuality: low
          ? "Submissions did not demonstrate reliable correctness."
          : "Submissions show workable structure with room to tighten edge cases.",
        optimization: "Focus on linear-time approaches and clear I/O handling.",
        suggestions: "Re-run failed cases locally and add boundary checks.",
      },
      aptitudePerformance: {
        logical: evalData.aptitudeScore,
        numerical: Math.round(evalData.aptitudeScore * 0.95),
        verbal: Math.round(evalData.aptitudeScore * 1.0),
        analytical: Math.round(evalData.aptitudeScore * 0.9),
      },
      technicalPerformance: {
        "Core Technical MCQs": evalData.mcqScore,
        "Problem Solving": evalData.codingScore,
        "Logical Aptitude": evalData.aptitudeScore,
      },
    };
  });

  return {
    candidateSummary: {
      name: session.blueprint.candidateName,
      role: session.blueprint.role,
      experience: `${session.blueprint.yearsOfExperience} Years (${session.blueprint.experienceLevel})`,
      difficulty: session.blueprint.suggestedDifficulty,
      duration: `${evalData.timeTaken} Mins`,
      overallScore: evalData.overallScore,
    },
    technicalPerformance: narrative.technicalPerformance || {
      "Core Technical MCQs": evalData.mcqScore,
      "Problem Solving": evalData.codingScore,
      "Logical Aptitude": evalData.aptitudeScore,
    },
    codingPerformance: {
      problemsAttempted: evalData.codingStats.problemsAttempted,
      passed: evalData.codingStats.passed,
      failed: evalData.codingStats.failed,
      codeQuality: narrative.codingPerformance.codeQuality,
      optimization: narrative.codingPerformance.optimization,
      suggestions: narrative.codingPerformance.suggestions,
    },
    aptitudePerformance: narrative.aptitudePerformance,
    strongAreas:
      narrative.strongAreas?.length > 0
        ? narrative.strongAreas
        : ["No standout strengths in this OA attempt."],
    weakAreas: narrative.weakAreas || [],
    personalizedLearningPath: narrative.personalizedLearningPath || [],
    interviewReadiness: narrative.interviewReadiness || readinessFromScore(evalData.overallScore),
    finalRecommendation:
      narrative.finalRecommendation ||
      (evalData.passed ? "Proceed to AI Interview" : "Retry OA Assessment"),
  };
}

export async function buildFullInterviewNarrative(input: {
  role: string;
  overallScore: number;
  passed: boolean;
  oaScore: number | null;
  aiScore: number | null;
  roundNotes: string;
}): Promise<{
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  finalVerdict: string;
  executiveSummary: string;
}> {
  const prompt = getFullInterviewNarrativePrompt(input);
  return aiService.generateJSON(prompt, () => ({
    strengths: input.passed
      ? ["Completed the multi-round interview flow."]
      : [],
    weaknesses: input.passed
      ? ["Continue deepening system design and coding edge cases."]
      : [
          "Overall score below the end-to-end pass threshold.",
          "One or more rounds need substantial improvement.",
        ],
    recommendations: [
      "Review weak round details in the section breakdown.",
      "Practice the lowest-scoring round before retrying.",
    ],
    finalVerdict: input.passed
      ? `Pass — overall ${input.overallScore}%.`
      : `Needs practice — overall ${input.overallScore}%.`,
    executiveSummary: `Combined interview score ${input.overallScore}% (OA ${input.oaScore ?? "n/a"}, AI ${input.aiScore ?? "n/a"}).`,
  }));
}

/** Convert AI/Audio session + report into unified assignment report. */
export function verbalSessionToUnified(
  session: AIInterviewSession | AudioInterviewSession,
  interviewType: "ai" | "audio",
  hiringRecommendation?: string
): UnifiedAssignmentReport {
  const report = session.report;
  const evaluation = session.evaluation;
  const overallScore = evaluation?.overallScore ?? report?.candidateSummary.overallScore ?? 0;
  const passed = evaluation?.passed ?? overallScore >= VERBAL_PASS_THRESHOLD;
  const proctor = report?.proctoringSummary;
  const violations = session.violations || [];

  const sections: UnifiedReportSection[] = [
    {
      id: "qa-section",
      title: interviewType === "audio" ? "Audio Interview Q&A" : "AI / Video Interview Q&A",
      type: "qa",
      score: overallScore,
      maxScore: 100,
      summary: `Evaluated ${session.questions.length} question(s). Pass threshold ${VERBAL_PASS_THRESHOLD}%.`,
      items: session.questions.map((q) => ({
        question: q.questionText,
        answer: q.answerText || "No response recorded",
        score: q.evaluation?.score ?? 0,
        feedback: q.evaluation?.feedback || "",
        status:
          (q.evaluation?.score ?? 0) >= 70
            ? "Strong"
            : (q.evaluation?.score ?? 0) >= VERBAL_PASS_THRESHOLD
              ? "Adequate"
              : (q.evaluation?.score ?? 0) <= 10
                ? "Non-answer"
                : "Weak",
        metrics: {
          accuracy: (q.evaluation?.technicalAccuracy ?? 0) * 10,
          communication: (q.evaluation?.communication ?? 0) * 10,
          problemSolving: (q.evaluation?.problemSolving ?? 0) * 10,
          confidence: (q.evaluation?.confidence ?? 0) * 10,
        },
      })),
    },
  ];

  if (interviewType === "audio" && "settings" in session) {
    sections.push({
      id: "audio-settings",
      title: "Audio Module Settings",
      type: "round_summary",
      score: overallScore,
      maxScore: 100,
      summary: "Audio-only configuration used for this attempt.",
      items: [
        {
          question: "Practice mode",
          answer: session.settings.practiceMode,
          status: "Info",
        },
        {
          question: "Difficulty / Duration / Voice",
          answer: `${session.settings.difficulty} · ${session.settings.duration} min · ${session.settings.voice} (${session.settings.accent})`,
          status: "Info",
        },
      ],
    });
  }

  return {
    id: `report_${session.id}`,
    sessionId: session.id,
    userId: session.userId,
    interviewType,
    role: session.blueprint.role,
    candidateName: session.blueprint.candidateName,
    status: session.status === "completed" ? "completed" : "in_progress",
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    durationMinutes: Math.max(
      1,
      Math.round((new Date(session.updatedAt).getTime() - new Date(session.createdAt).getTime()) / 60000)
    ),
    overallScore,
    passed,
    metrics: {
      technicalScore: evaluation?.technicalScore ?? 0,
      communicationScore: evaluation?.communicationScore ?? 0,
      problemSolvingScore: evaluation?.problemSolvingScore ?? 0,
      confidenceScore: evaluation?.confidenceScore ?? 0,
      aptitudeScore: 0,
    },
    strengths: report?.strengths || [],
    weaknesses: report?.weaknesses || [],
    recommendations: report?.recommendations || [],
    finalVerdict:
      hiringRecommendation ||
      (passed ? "Lean Hire / Proceed" : "Needs Practice / No Hire"),
    proctoring: {
      tabSwitches: proctor?.tabSwitches ?? violations.filter((v) => v.type === "tab_switch").length,
      fullscreenExits:
        proctor?.fullscreenExits ?? violations.filter((v) => v.type === "fullscreen_exit").length,
      violationsCount: violations.length,
      status: proctor?.status ?? (violations.length === 0 ? "Clean" : "Flagged"),
    },
    sections,
    transcript: report?.transcript,
  };
}
