import { NextResponse } from "next/server";
import { dbService } from "@/src/services/db.service";
import { buildFullInterviewNarrative } from "@/src/services/report-engine";
import type {
  AIInterviewReport,
  InterviewSession,
  UnifiedReportSection,
} from "@/src/types";

function buildOASections(oa: InterviewSession): {
  sections: UnifiedReportSection[];
  summaries: {
    name: string;
    attempted: number;
    correct: number;
    wrong: number;
    skipped: number;
    score: number;
    improvements: string[];
  }[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
} {
  const sections: UnifiedReportSection[] = [];
  const summaries: {
    name: string;
    attempted: number;
    correct: number;
    wrong: number;
    skipped: number;
    score: number;
    improvements: string[];
  }[] = [];
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  // MCQ
  let mcqCorrect = 0;
  let mcqWrong = 0;
  let mcqSkipped = 0;
  const mcqItems = oa.mcqQuestions.map((q) => {
    const ans = oa.mcqAnswers?.[q.id];
    if (!ans) {
      mcqSkipped++;
      return {
        question: q.question,
        answer: "(Skipped)",
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        status: "skipped",
        score: 0,
        feedback: "Not attempted.",
      };
    }
    const ok = ans.trim() === q.correctAnswer.trim();
    if (ok) mcqCorrect++;
    else mcqWrong++;
    return {
      question: q.question,
      answer: ans,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      status: ok ? "correct" : "wrong",
      score: ok ? 100 : 0,
      feedback: ok
        ? "Correct."
        : `Incorrect. Correct answer: ${q.correctAnswer}. ${q.explanation || ""}`,
    };
  });
  const mcqScore = oa.evaluation?.mcqScore ?? Math.round(
    (mcqCorrect / Math.max(oa.mcqQuestions.length, 1)) * 100
  );
  sections.push({
    id: "oa-mcq",
    title: "OA · MCQ Section",
    type: "mcq",
    score: mcqScore,
    maxScore: 100,
    summary: `Attempted ${mcqCorrect + mcqWrong}/${oa.mcqQuestions.length}. Correct ${mcqCorrect}, Wrong ${mcqWrong}, Skipped ${mcqSkipped}.`,
    items: mcqItems,
  });
  summaries.push({
    name: "MCQ",
    attempted: mcqCorrect + mcqWrong,
    correct: mcqCorrect,
    wrong: mcqWrong,
    skipped: mcqSkipped,
    score: mcqScore,
    improvements:
      mcqScore < 70
        ? [
            "Revise core JS/React/Node fundamentals with timed quizzes.",
            "Review explanations for every wrong MCQ before the next attempt.",
          ]
        : ["Keep drilling harder MCQs under a 20-minute timer."],
  });
  if (mcqScore >= 70) strengths.push(`MCQ: ${mcqCorrect}/${oa.mcqQuestions.length} correct (${mcqScore}%).`);
  else weaknesses.push(`MCQ needs work — ${mcqWrong} wrong, ${mcqSkipped} skipped (${mcqScore}%).`);

  // Coding
  let codingAttempted = 0;
  let codingPassedCases = 0;
  let codingTotalCases = 0;
  const codingItems = oa.codingQuestions.map((q) => {
    const sub = oa.codingAnswers?.[q.id];
    if (!sub) {
      codingTotalCases += q.testCases?.length || 0;
      return {
        question: q.title,
        userCode: "",
        language: "",
        status: "skipped",
        testCasesPassed: 0,
        totalTestCases: q.testCases?.length || 0,
        score: 0,
        feedback: "Problem not submitted.",
      };
    }
    codingAttempted++;
    codingPassedCases += sub.passedCount || 0;
    codingTotalCases += sub.totalCount || q.testCases?.length || 0;
    const pct = Math.round(
      ((sub.passedCount || 0) / Math.max(sub.totalCount || q.testCases.length || 1, 1)) * 100
    );
    return {
      question: q.title,
      userCode: sub.code?.slice(0, 2000) || "",
      language: sub.language,
      status: pct === 100 ? "correct" : pct > 0 ? "partial" : "wrong",
      testCasesPassed: sub.passedCount || 0,
      totalTestCases: sub.totalCount || q.testCases.length,
      score: pct,
      feedback:
        typeof sub.feedback === "object"
          ? `${sub.feedback.codeQuality || ""} ${sub.feedback.suggestions || ""}`.trim()
          : String(sub.feedback || "Submitted."),
    };
  });
  const codingScore =
    oa.evaluation?.codingScore ??
    Math.round((codingPassedCases / Math.max(codingTotalCases, 1)) * 100);
  sections.push({
    id: "oa-coding",
    title: "OA · Coding Section",
    type: "coding",
    score: codingScore,
    maxScore: 100,
    summary: `Problems attempted ${codingAttempted}/${oa.codingQuestions.length}. Test cases passed ${codingPassedCases}/${codingTotalCases}.`,
    items: codingItems,
  });
  summaries.push({
    name: "Coding",
    attempted: codingAttempted,
    correct: codingItems.filter((i) => i.status === "correct").length,
    wrong: codingItems.filter((i) => i.status === "wrong" || i.status === "partial").length,
    skipped: oa.codingQuestions.length - codingAttempted,
    score: codingScore,
    improvements:
      codingScore < 70
        ? [
            "Practice arrays/strings/stacks with visible + hidden tests.",
            "Always run custom edge cases before final submit.",
          ]
        : ["Add complexity analysis and cleaner naming in submissions."],
  });
  if (codingScore >= 70) strengths.push(`Coding score ${codingScore}% across ${codingAttempted} problems.`);
  else weaknesses.push(`Coding score ${codingScore}% — strengthen edge-case handling.`);

  // Aptitude
  let aptCorrect = 0;
  let aptWrong = 0;
  let aptSkipped = 0;
  const aptItems = oa.aptitudeQuestions.map((q) => {
    const ans = oa.aptitudeAnswers?.[q.id];
    if (!ans) {
      aptSkipped++;
      return {
        question: q.question,
        answer: "(Skipped)",
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        status: "skipped",
        score: 0,
        feedback: "Not attempted.",
      };
    }
    const ok = ans.trim() === q.correctAnswer.trim();
    if (ok) aptCorrect++;
    else aptWrong++;
    return {
      question: q.question,
      answer: ans,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      status: ok ? "correct" : "wrong",
      score: ok ? 100 : 0,
      feedback: ok
        ? "Correct."
        : `Incorrect. Correct: ${q.correctAnswer}. ${q.explanation || ""}`,
    };
  });
  const aptScore = oa.evaluation?.aptitudeScore ?? Math.round(
    (aptCorrect / Math.max(oa.aptitudeQuestions.length, 1)) * 100
  );
  sections.push({
    id: "oa-aptitude",
    title: "OA · Aptitude Section",
    type: "aptitude",
    score: aptScore,
    maxScore: 100,
    summary: `Attempted ${aptCorrect + aptWrong}/${oa.aptitudeQuestions.length}. Correct ${aptCorrect}, Wrong ${aptWrong}, Skipped ${aptSkipped}.`,
    items: aptItems,
  });
  summaries.push({
    name: "Aptitude",
    attempted: aptCorrect + aptWrong,
    correct: aptCorrect,
    wrong: aptWrong,
    skipped: aptSkipped,
    score: aptScore,
    improvements:
      aptScore < 70
        ? [
            "Daily 15-minute mixed aptitude sets (numerical + logical).",
            "Review ratio/percentage and series patterns.",
          ]
        : ["Maintain pace; try harder analytical puzzles."],
  });
  if (aptScore >= 70) strengths.push(`Aptitude: ${aptCorrect} correct (${aptScore}%).`);
  else weaknesses.push(`Aptitude accuracy low (${aptScore}%).`);

  recommendations.push(
    ...summaries.flatMap((s) => s.improvements).slice(0, 4)
  );

  return { sections, summaries, strengths, weaknesses, recommendations };
}

export async function POST(req: Request) {
  try {
    const { fullSessionId } = await req.json();

    if (!fullSessionId) {
      return NextResponse.json(
        { error: "fullSessionId is required." },
        { status: 400 }
      );
    }

    const session = await dbService.getFullSession(fullSessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Full Session not found." },
        { status: 404 }
      );
    }

    const oaSess = session.oaSessionId
      ? await dbService.getSession(session.oaSessionId)
      : null;
    const aiSess = session.aiSessionId
      ? await dbService.getAISession(session.aiSessionId)
      : null;

    const sections: UnifiedReportSection[] = [];
    const roundSummaries: {
      name: string;
      attempted: number;
      correct: number;
      wrong: number;
      skipped: number;
      score: number;
      improvements: string[];
    }[] = [];
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recommendations: string[] = [];
    const questionFeedback: AIInterviewReport["questionFeedback"] = [];

    if (oaSess) {
      const oaBuilt = buildOASections(oaSess);
      sections.push(...oaBuilt.sections);
      roundSummaries.push(...oaBuilt.summaries);
      strengths.push(...oaBuilt.strengths);
      weaknesses.push(...oaBuilt.weaknesses);
      recommendations.push(...oaBuilt.recommendations);

      for (const sec of oaBuilt.sections) {
        for (const item of sec.items || []) {
          questionFeedback.push({
            question: `[${sec.title}] ${item.question}`,
            answer: item.answer || item.userCode || "(No answer)",
            score: item.score ?? 0,
            feedback: item.feedback || item.status || "",
            metrics: {
              accuracy: item.score ?? 0,
              communication: 0,
              problemSolving: sec.type === "coding" ? item.score ?? 0 : 0,
              confidence: 0,
            },
          });
        }
      }
    } else {
      weaknesses.push("Online Assessment was not completed.");
      recommendations.push("Complete MCQ, Coding, and Aptitude in your next full interview.");
      roundSummaries.push({
        name: "OA (not started)",
        attempted: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        score: 0,
        improvements: ["Start and finish the full OA round under proctoring."],
      });
    }

    if (aiSess) {
      const answered = aiSess.questions.filter((q) => q.answerText || q.evaluation);
      const aiItems = answered.map((q) => ({
        question: q.questionText,
        answer: q.answerText || "(No verbal answer)",
        score: q.evaluation?.score ?? 0,
        feedback: q.evaluation?.feedback || "Evaluated.",
        status:
          (q.evaluation?.score ?? 0) >= 70
            ? "strong"
            : (q.evaluation?.score ?? 0) >= 50
              ? "average"
              : "weak",
        metrics: {
          accuracy: q.evaluation?.technicalAccuracy ?? 0,
          communication: q.evaluation?.communication ?? 0,
          problemSolving: q.evaluation?.problemSolving ?? 0,
          confidence: q.evaluation?.confidence ?? 0,
        },
      }));
      const aiScore = aiSess.evaluation?.overallScore ?? 0;
      sections.push({
        id: "ai-round",
        title: "Live AI Interview",
        type: "qa",
        score: aiScore,
        maxScore: 100,
        summary: `Answered ${answered.length} question(s). Overall AI score ${aiScore}%.`,
        items: aiItems,
      });
      roundSummaries.push({
        name: "AI Interview",
        attempted: answered.length,
        correct: aiItems.filter((i) => (i.score ?? 0) >= 70).length,
        wrong: aiItems.filter((i) => (i.score ?? 0) < 50).length,
        skipped: Math.max(0, 10 - answered.length),
        score: aiScore,
        improvements:
          aiScore < 70
            ? [
                "Structure answers: approach → trade-offs → example.",
                "Practice explaining debugging and system design out loud.",
              ]
            : ["Add more concrete production examples in answers."],
      });

      for (const item of aiItems) {
        questionFeedback.push({
          question: `[AI Interview] ${item.question}`,
          answer: item.answer,
          score: item.score,
          feedback: item.feedback,
          metrics: {
            accuracy: (item.metrics.accuracy || 0) * 10,
            communication: (item.metrics.communication || 0) * 10,
            problemSolving: (item.metrics.problemSolving || 0) * 10,
            confidence: (item.metrics.confidence || 0) * 10,
          },
        });
      }

      if (aiSess.report?.strengths) strengths.push(...aiSess.report.strengths.slice(0, 3));
      if (aiSess.report?.weaknesses) weaknesses.push(...aiSess.report.weaknesses.slice(0, 3));
      if (aiSess.report?.recommendations)
        recommendations.push(...aiSess.report.recommendations.slice(0, 3));
      else if (aiScore < 60) {
        weaknesses.push("Verbal technical depth needs improvement.");
        recommendations.push("Do mock live interviews focusing on clarity and structure.");
      } else {
        strengths.push(`AI Interview overall score ${aiScore}%.`);
      }
    } else {
      weaknesses.push("AI Interview round was not completed.");
      recommendations.push("Complete the live AI round for a full evaluation.");
      roundSummaries.push({
        name: "AI Interview (not started)",
        attempted: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        score: 0,
        improvements: ["Finish OA, then complete the full AI interview."],
      });
    }

    const oaScore = oaSess?.evaluation?.overallScore ?? null;
    const aiScore = aiSess?.evaluation?.overallScore ?? null;
    const scores = [oaScore, aiScore].filter((s): s is number => typeof s === "number");
    const overallScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
    const passed = overallScore >= 55;

    const technicalScore = Math.round(
      ((oaSess?.evaluation?.codingScore || 0) + (aiSess?.evaluation?.technicalScore || 0)) /
        (oaSess && aiSess ? 2 : 1) || overallScore
    );
    const communicationScore = aiSess?.evaluation?.communicationScore ?? 0;
    const problemSolvingScore = Math.round(
      ((oaSess?.evaluation?.codingScore || 0) + (aiSess?.evaluation?.problemSolvingScore || 0)) /
        (oaSess && aiSess ? 2 : 1) || overallScore
    );
    const confidenceScore = aiSess?.evaluation?.confidenceScore ?? 0;

    const narrative = await buildFullInterviewNarrative({
      role: session.blueprint.role,
      overallScore,
      passed,
      oaScore,
      aiScore,
      roundNotes: roundSummaries
        .map((r) => `${r.name}: score=${r.score}, attempted=${r.attempted}`)
        .join("\n"),
    });

    strengths.push(...narrative.strengths);
    weaknesses.push(...narrative.weaknesses);
    recommendations.push(...narrative.recommendations);

    const uniq = (arr: string[]) => [...new Set(arr.filter(Boolean))];

    const tabSwitches =
      (oaSess?.violations?.filter((v) => v.type === "tab_switch").length || 0) +
      (aiSess?.violations?.filter((v) => v.type === "tab_switch").length || 0);
    const fullscreenExits =
      (oaSess?.violations?.filter((v) => v.type === "fullscreen_exit").length || 0) +
      (aiSess?.violations?.filter((v) => v.type === "fullscreen_exit").length || 0);
    const screenShareInterruptions =
      (oaSess?.violations?.filter((v) => v.type === "screen_share_interrupted").length || 0) +
      (aiSess?.violations?.filter((v) => v.type === "screen_share_interrupted").length || 0);

    const masterReport: AIInterviewReport & {
      sections: UnifiedReportSection[];
      roundSummaries: typeof roundSummaries;
    } = {
      candidateSummary: {
        overallScore,
        technicalScore: Number.isFinite(technicalScore) ? technicalScore : overallScore,
        communicationScore,
        problemSolvingScore: Number.isFinite(problemSolvingScore)
          ? problemSolvingScore
          : overallScore,
        confidenceScore,
        duration: "Full E2E",
      },
      questionFeedback,
      strengths: uniq(strengths).slice(0, 8),
      weaknesses: uniq(weaknesses).slice(0, 8),
      recommendations: uniq(recommendations).slice(0, 10),
      transcript: aiSess?.report?.transcript || [],
      timeline: [
        { timestamp: "Start", label: "Full Interview Initialized" },
        {
          timestamp: "OA",
          label: oaSess
            ? `OA completed — overall ${oaScore ?? 0}%`
            : "Online Assessment incomplete",
        },
        {
          timestamp: "AI",
          label: aiSess
            ? `AI Interview completed — overall ${aiScore ?? 0}%`
            : "AI Interview incomplete",
        },
        { timestamp: "End", label: narrative.executiveSummary || "Master report generated" },
      ],
      proctoringSummary: {
        tabSwitches,
        fullscreenExits,
        screenShareInterruptions,
        status: tabSwitches > 3 ? "Suspicious" : tabSwitches > 0 ? "Flagged" : "Clean",
      },
      sections,
      roundSummaries,
    };

    if (masterReport.strengths.length === 0) {
      masterReport.strengths.push("No material strengths identified across completed rounds.");
    }
    if (masterReport.weaknesses.length === 0) {
      masterReport.weaknesses.push("Keep building depth across written and verbal rounds.");
    }

    session.status = "completed";
    session.currentRound = "completed";
    session.evaluation = {
      overallScore,
      passed,
    };
    session.report = masterReport;
    session.updatedAt = new Date().toISOString();

    await dbService.saveFullSession(session);

    return NextResponse.json({ session });
  } catch (err: any) {
    console.error("Error finalizing Full Session:", err);
    return NextResponse.json(
      { error: err.message || "Failed to finalize session." },
      { status: 500 }
    );
  }
}
