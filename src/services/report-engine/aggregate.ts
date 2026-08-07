import type { AIQuestion } from "@/src/types";

export const VERBAL_PASS_THRESHOLD = 60;
export const OA_PASS_THRESHOLD = 50;

export interface AnswerEvaluationResult {
  technicalAccuracy: number; // 0-10
  communication: number;
  problemSolving: number;
  confidence: number;
  completeness: number;
  practicalKnowledge: number;
  feedback: string;
  score: number; // 0-100
  qualityFlag?: "empty" | "refusal" | "too_short" | "gibberish" | "substantive";
}

export interface VerbalRollup {
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  problemSolvingScore: number;
  confidenceScore: number;
  completenessScore: number;
  practicalKnowledgeScore: number;
  passed: boolean;
  answeredCount: number;
  refusedCount: number;
  averageScore: number;
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function normalizeAnswerEvaluation(
  raw: Partial<AnswerEvaluationResult> | null | undefined,
  fallbackScore = 0
): AnswerEvaluationResult {
  const score = clamp(raw?.score ?? fallbackScore, 0, 100);
  const to10 = (v: number | undefined, def: number) => clamp(v ?? def, 0, 10);
  const approx = Math.round(score / 10);

  return {
    technicalAccuracy: to10(raw?.technicalAccuracy, approx),
    communication: to10(raw?.communication, approx),
    problemSolving: to10(raw?.problemSolving, approx),
    confidence: to10(raw?.confidence, Math.max(0, approx - 1)),
    completeness: to10(raw?.completeness, approx),
    practicalKnowledge: to10(raw?.practicalKnowledge, approx),
    feedback: (raw?.feedback || "No feedback available.").trim(),
    score,
    qualityFlag: raw?.qualityFlag,
  };
}

export function aggregateVerbalEvaluations(
  questions: Array<{ evaluation?: AnswerEvaluationResult | AIQuestion["evaluation"] | null }>
): VerbalRollup {
  const evaluated = questions.filter((q) => q.evaluation);
  const count = evaluated.length || 1;

  let sumOverall = 0;
  let sumTech = 0;
  let sumComm = 0;
  let sumSolve = 0;
  let sumConf = 0;
  let sumComp = 0;
  let sumPrac = 0;
  let refusedCount = 0;

  evaluated.forEach((q) => {
    const e = q.evaluation!;
    sumOverall += e.score;
    sumTech += e.technicalAccuracy;
    sumComm += e.communication;
    sumSolve += e.problemSolving;
    sumConf += e.confidence;
    sumComp += e.completeness ?? e.technicalAccuracy;
    sumPrac += e.practicalKnowledge ?? e.technicalAccuracy;
    if ((e as AnswerEvaluationResult).qualityFlag === "refusal" || e.score <= 10) {
      refusedCount += 1;
    }
  });

  const overallScore = clamp(sumOverall / count, 0, 100);
  return {
    overallScore,
    technicalScore: clamp((sumTech / count) * 10, 0, 100),
    communicationScore: clamp((sumComm / count) * 10, 0, 100),
    problemSolvingScore: clamp((sumSolve / count) * 10, 0, 100),
    confidenceScore: clamp((sumConf / count) * 10, 0, 100),
    completenessScore: clamp((sumComp / count) * 10, 0, 100),
    practicalKnowledgeScore: clamp((sumPrac / count) * 10, 0, 100),
    passed: overallScore >= VERBAL_PASS_THRESHOLD,
    answeredCount: evaluated.length,
    refusedCount,
    averageScore: overallScore,
  };
}

export function hiringRecommendationFromScore(
  overallScore: number,
  refusedCount: number,
  totalQuestions: number
): "Strong Hire" | "Hire" | "Lean Hire" | "No Hire" | "Needs Practice" {
  if (totalQuestions > 0 && refusedCount / totalQuestions >= 0.5) return "No Hire";
  if (overallScore >= 85) return "Strong Hire";
  if (overallScore >= 72) return "Hire";
  if (overallScore >= VERBAL_PASS_THRESHOLD) return "Lean Hire";
  if (overallScore >= 40) return "Needs Practice";
  return "No Hire";
}

export function readinessFromScore(
  overallScore: number
): "Ready for Mid-Level Roles" | "Ready for Junior Roles" | "Needs More Practice" {
  if (overallScore >= 75) return "Ready for Mid-Level Roles";
  if (overallScore >= VERBAL_PASS_THRESHOLD) return "Ready for Junior Roles";
  return "Needs More Practice";
}
