import type {
  InterviewSession,
  AIInterviewSession,
  AudioInterviewSession,
  FullInterviewSession,
  UnifiedAssignmentReport,
  UnifiedReportSection,
} from "@/src/types";
import {
  verbalSessionToUnified,
  VERBAL_PASS_THRESHOLD,
  OA_PASS_THRESHOLD,
} from "@/src/services/report-engine";

export function formatToUnifiedReport(
  session: any,
  type?: "oa" | "ai" | "audio" | "full"
): UnifiedAssignmentReport {
  const interviewType = (type || session.interviewType || "oa") as "oa" | "ai" | "audio" | "full";

  if (interviewType === "ai" || interviewType === "audio") {
    return verbalSessionToUnified(
      session as AIInterviewSession | AudioInterviewSession,
      interviewType
    );
  }

  const id = session.id || "session_id";
  const userId = session.userId || "user";
  const candidateName = session.blueprint?.candidateName || "Candidate";
  const role = session.blueprint?.role || "Software Engineer";
  const createdAt = session.createdAt || new Date().toISOString();
  const updatedAt = session.updatedAt || new Date().toISOString();
  const status =
    session.status === "completed" || session.aptitudeStatus === "completed"
      ? "completed"
      : "in_progress";

  const violations = session.violations || [];
  const tabSwitches = violations.filter(
    (v: any) => v.type === "tab_switch" || v.type === "visibility_change"
  ).length;
  const fullscreenExits = violations.filter((v: any) => v.type === "fullscreen_exit").length;
  const violationsCount = violations.length;
  const proctoringStatus: "Clean" | "Flagged" | "Suspicious" =
    violationsCount === 0 ? "Clean" : violationsCount < 4 ? "Flagged" : "Suspicious";

  if (interviewType === "oa") {
    const oaSession = session as InterviewSession;
    const overallScore = oaSession.evaluation?.overallScore ?? 0;
    const passed = oaSession.evaluation?.passed ?? overallScore >= OA_PASS_THRESHOLD;
    const sections: UnifiedReportSection[] = [];

    if (oaSession.mcqQuestions?.length) {
      sections.push({
        id: "mcq-section",
        title: "Technical MCQ Round",
        type: "mcq",
        score: oaSession.evaluation?.mcqScore ?? 0,
        maxScore: 100,
        summary: `Scored ${oaSession.evaluation?.mcqScore ?? 0}% in core technical concepts.`,
        items: oaSession.mcqQuestions.map((q) => {
          const userAnswer = oaSession.mcqAnswers?.[q.id] || "Skipped";
          const isCorrect = userAnswer === q.correctAnswer;
          return {
            question: q.question,
            answer: userAnswer,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            status: isCorrect ? "Correct" : userAnswer === "Skipped" ? "Skipped" : "Incorrect",
            score: isCorrect ? 100 : 0,
          };
        }),
      });
    }

    if (oaSession.codingQuestions?.length) {
      sections.push({
        id: "coding-section",
        title: "Hands-on Coding Round",
        type: "coding",
        score: oaSession.evaluation?.codingScore ?? 0,
        maxScore: 100,
        summary: `Scored ${oaSession.evaluation?.codingScore ?? 0}% on algorithmic problem solving.`,
        items: oaSession.codingQuestions.map((q) => {
          const ans = oaSession.codingAnswers?.[q.id] || {
            code: "// No code submitted",
            language: "javascript",
          };
          return {
            question: q.title + ": " + q.problemStatement,
            userCode: ans.code,
            language: ans.language || "javascript",
            testCasesPassed: ans.passedCount || 0,
            totalTestCases: ans.totalCount || q.testCases?.length || 2,
            status: ans.status || (ans.passedCount ? "Passed" : "Attempted"),
            score: ans.totalCount
              ? Math.round(((ans.passedCount || 0) / ans.totalCount) * 100)
              : 0,
            feedback: ans.feedback ? JSON.stringify(ans.feedback) : undefined,
          };
        }),
      });
    }

    if (oaSession.aptitudeQuestions?.length) {
      sections.push({
        id: "aptitude-section",
        title: "Logical & Quantitative Aptitude",
        type: "aptitude",
        score: oaSession.evaluation?.aptitudeScore ?? 0,
        maxScore: 100,
        summary: `Scored ${oaSession.evaluation?.aptitudeScore ?? 0}% in reasoning and analytical skills.`,
        items: oaSession.aptitudeQuestions.map((q) => {
          const userAnswer = oaSession.aptitudeAnswers?.[q.id] || "Skipped";
          const isCorrect = userAnswer === q.correctAnswer;
          return {
            question: q.question,
            answer: userAnswer,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            status: isCorrect ? "Correct" : userAnswer === "Skipped" ? "Skipped" : "Incorrect",
            score: isCorrect ? 100 : 0,
          };
        }),
      });
    }

    return {
      id: `report_${id}`,
      sessionId: id,
      userId,
      interviewType,
      role,
      candidateName,
      status,
      createdAt,
      updatedAt,
      durationMinutes: oaSession.evaluation?.timeTaken || 20,
      overallScore,
      passed,
      metrics: {
        technicalScore: oaSession.evaluation?.mcqScore ?? 0,
        communicationScore: 0,
        problemSolvingScore: oaSession.evaluation?.codingScore ?? 0,
        confidenceScore: 0,
        aptitudeScore: oaSession.evaluation?.aptitudeScore ?? 0,
      },
      strengths: oaSession.report?.strongAreas?.length
        ? oaSession.report.strongAreas
        : ["No standout strengths recorded for this OA."],
      weaknesses: oaSession.report?.weakAreas || [],
      recommendations: oaSession.report?.personalizedLearningPath || [],
      finalVerdict:
        oaSession.report?.finalRecommendation ||
        (passed ? "Proceed to AI Interview Round" : "Retry OA Assessment"),
      proctoring: {
        tabSwitches,
        fullscreenExits,
        violationsCount,
        status: proctoringStatus,
      },
      sections,
    };
  }

  // Full E2E
  const fullSession = session as FullInterviewSession;
  const overallScore = fullSession.evaluation?.overallScore ?? 0;
  const passed = fullSession.evaluation?.passed ?? overallScore >= 55;
  const report = fullSession.report;

  return {
    id: `report_${id}`,
    sessionId: id,
    userId,
    interviewType: "full",
    role,
    candidateName,
    status,
    createdAt,
    updatedAt,
    durationMinutes: 45,
    overallScore,
    passed,
    metrics: {
      technicalScore: report?.candidateSummary?.technicalScore ?? overallScore,
      communicationScore: report?.candidateSummary?.communicationScore ?? 0,
      problemSolvingScore: report?.candidateSummary?.problemSolvingScore ?? overallScore,
      confidenceScore: report?.candidateSummary?.confidenceScore ?? 0,
      aptitudeScore: 0,
    },
    strengths: report?.strengths?.length
      ? report.strengths
      : ["No material strengths identified."],
    weaknesses: report?.weaknesses || [],
    recommendations: report?.recommendations || [],
    finalVerdict: passed
      ? `Pass — overall ${overallScore}%`
      : `Needs practice — overall ${overallScore}% (threshold 55%)`,
    proctoring: {
      tabSwitches: report?.proctoringSummary?.tabSwitches ?? tabSwitches,
      fullscreenExits: report?.proctoringSummary?.fullscreenExits ?? fullscreenExits,
      violationsCount,
      status: report?.proctoringSummary?.status ?? proctoringStatus,
    },
    sections:
      report?.sections?.length
        ? report.sections
        : [
            {
              id: "full-summary-section",
              title: "Full End-to-End Summary",
              type: "round_summary",
              score: overallScore,
              maxScore: 100,
              summary: `Combined OA + AI evaluation. Verbal pass bar ${VERBAL_PASS_THRESHOLD}%.`,
              items: (report?.roundSummaries || []).map((r) => ({
                question: r.name,
                score: r.score,
                status: r.score >= 55 ? "Adequate" : "Weak",
                feedback: r.improvements?.join("; "),
              })),
            },
          ],
    transcript: report?.transcript,
  };
}
