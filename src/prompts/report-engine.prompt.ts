import type { InterviewBlueprint } from "@/src/types";
import type { VerbalRollup, AnswerEvaluationResult } from "@/src/services/report-engine/aggregate";

export function getBatchAnswerEvaluationPrompt(
  blueprint: InterviewBlueprint,
  pairs: { id: string; questionText: string; answerText: string }[]
): string {
  const role = blueprint.role || "Software Engineer";
  const skills = (blueprint.skills || []).join(", ");
  const items = pairs
    .map(
      (p, i) =>
        `[${i + 1}] id=${p.id}\nQ: ${p.questionText}\nA: ${p.answerText}`
    )
    .join("\n\n");

  return `You are a strict technical interview evaluator for a ${role} role.
Target skills: ${skills || "general software engineering"}.

Score EACH candidate answer independently using a HARD rubric.
CRITICAL RULES:
1. Non-answers ("idk", "I don't know", "skip", empty, filler) must score 0-10 overall.
2. Vague answers with no technical substance must score 15-35.
3. Partially correct / shallow answers: 40-59.
4. Solid correct answers with examples: 60-79.
5. Excellent depth + trade-offs + real experience: 80-100.
6. Do NOT inflate scores. Average candidates should land mid-range only when answers are actually decent.
7. Metrics are 0-10 integers. "score" is 0-100 integer.
8. Feedback must be honest and specific (1-2 sentences). Never praise empty/refusal answers.

Evaluate these Q&A pairs:
${items}

Respond ONLY with JSON:
{
  "evaluations": [
    {
      "id": "question-id",
      "technicalAccuracy": 0-10,
      "communication": 0-10,
      "problemSolving": 0-10,
      "confidence": 0-10,
      "completeness": 0-10,
      "practicalKnowledge": 0-10,
      "feedback": "string",
      "score": 0-100
    }
  ]
}`;
}

export function getVerbalNarrativeReportPrompt(input: {
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
}): string {
  const qa = input.questions
    .map(
      (q, i) =>
        `Q${i + 1}: ${q.questionText}\nAnswer: ${q.answerText}\nScore: ${q.evaluation.score}/100 — ${q.evaluation.feedback}`
    )
    .join("\n\n");

  return `You are a senior hiring panel writing an interview performance report.
Module: ${input.module === "audio" ? "Audio Mock Interview" : "AI / Video Technical Interview"}
Role: ${input.blueprint.role}
${input.settingsSummary ? `Settings: ${input.settingsSummary}` : ""}

LOCKED SCORES (do NOT invent or change these numbers):
- overallScore: ${input.rollup.overallScore}
- technicalScore: ${input.rollup.technicalScore}
- communicationScore: ${input.rollup.communicationScore}
- problemSolvingScore: ${input.rollup.problemSolvingScore}
- confidenceScore: ${input.rollup.confidenceScore}
- passed: ${input.rollup.passed}
- hiringRecommendation: ${input.hiringRecommendation}
- refusedOrEmptyAnswers: ${input.rollup.refusedCount}/${input.rollup.answeredCount}

Proctoring: ${input.violationsSummary}

Transcript scores:
${qa}

Write an honest narrative. If scores are low / many refusals, strengths may be empty or minimal and weaknesses must call that out.
Do not claim the candidate demonstrated knowledge they did not show.

Respond ONLY with JSON:
{
  "strengths": ["string"],
  "weaknesses": ["string"],
  "recommendations": ["string"],
  "finalVerdict": "one sentence recommendation aligned to hiringRecommendation",
  "executiveSummary": "2-3 sentence summary of performance"
}`;
}

export function getOANarrativeReportPrompt(input: {
  name: string;
  role: string;
  experience: string;
  difficulty: string;
  duration: string;
  overallScore: number;
  mcqScore: number;
  codingScore: number;
  aptitudeScore: number;
  passed: boolean;
  mcqStats: { correct: number; wrong: number; skipped: number };
  codingStats: { problemsAttempted: number; passed: number; failed: number };
  aptitudeStats: { correct: number; wrong: number; skipped: number };
  skills: string[];
}): string {
  return `You are a technical assessment director writing an OA report.
LOCKED SCORES (do not change):
overall=${input.overallScore}, mcq=${input.mcqScore}, coding=${input.codingScore}, aptitude=${input.aptitudeScore}, passed=${input.passed}

Candidate: ${input.name} | Role: ${input.role} | Experience: ${input.experience} | Difficulty: ${input.difficulty}
MCQ: ${input.mcqStats.correct} correct, ${input.mcqStats.wrong} wrong, ${input.mcqStats.skipped} skipped
Coding: attempted ${input.codingStats.problemsAttempted}, cases passed ${input.codingStats.passed}, failed ${input.codingStats.failed}
Aptitude: ${input.aptitudeStats.correct} correct, ${input.aptitudeStats.wrong} wrong, ${input.aptitudeStats.skipped} skipped
Skills focus: ${input.skills.join(", ")}

Write an honest OA narrative aligned to these numbers. Low scores → clear weak areas, no false praise.

Respond ONLY with JSON:
{
  "strongAreas": ["string"],
  "weakAreas": ["string"],
  "personalizedLearningPath": ["string"],
  "interviewReadiness": "Ready for Junior Roles" | "Ready for Mid-Level Roles" | "Needs More Practice",
  "finalRecommendation": "Proceed to AI Interview" | "Retry OA Assessment",
  "codingPerformance": {
    "codeQuality": "string",
    "optimization": "string",
    "suggestions": "string"
  },
  "aptitudePerformance": {
    "logical": number,
    "numerical": number,
    "verbal": number,
    "analytical": number
  },
  "technicalPerformance": { "Core Technical MCQs": number, "Problem Solving": number, "Logical Aptitude": number },
  "executiveSummary": "string"
}`;
}

export function getFullInterviewNarrativePrompt(input: {
  role: string;
  overallScore: number;
  passed: boolean;
  oaScore: number | null;
  aiScore: number | null;
  roundNotes: string;
}): string {
  return `You are compiling a full end-to-end interview report.
LOCKED: overall=${input.overallScore}, passed=${input.passed}, oaScore=${input.oaScore}, aiScore=${input.aiScore}
Role: ${input.role}

Round notes:
${input.roundNotes}

Respond ONLY with JSON:
{
  "strengths": ["string"],
  "weaknesses": ["string"],
  "recommendations": ["string"],
  "finalVerdict": "string",
  "executiveSummary": "string"
}`;
}
