import type { InterviewBlueprint } from "@/src/types";
import { aiService } from "@/src/services/ai.service";
import { classifyAnswerQuality } from "./answer-quality";
import {
  normalizeAnswerEvaluation,
  type AnswerEvaluationResult,
} from "./aggregate";
import { getBatchAnswerEvaluationPrompt } from "@/src/prompts/report-engine.prompt";

export interface QAPair {
  id: string;
  questionText: string;
  answerText: string;
}

/**
 * Evaluate all Q&A pairs: hard-fail non-answers locally, GPT-score the rest.
 */
export async function evaluateVerbalAnswers(
  pairs: QAPair[],
  blueprint: InterviewBlueprint
): Promise<Map<string, AnswerEvaluationResult>> {
  const results = new Map<string, AnswerEvaluationResult>();
  const needsModel: QAPair[] = [];

  for (const pair of pairs) {
    const quality = classifyAnswerQuality(pair.answerText);
    if (quality.forcedScore !== null) {
      const score = quality.forcedScore;
      const rating = Math.max(0, Math.round(score / 10));
      results.set(
        pair.id,
        normalizeAnswerEvaluation({
          technicalAccuracy: rating,
          communication: rating,
          problemSolving: rating,
          confidence: rating,
          completeness: rating,
          practicalKnowledge: rating,
          feedback: quality.reason,
          score,
          qualityFlag: quality.kind,
        })
      );
    } else {
      needsModel.push(pair);
    }
  }

  if (needsModel.length === 0) return results;

  const prompt = getBatchAnswerEvaluationPrompt(blueprint, needsModel);
  const fallback = () => ({
    evaluations: needsModel.map((p) => {
      // Conservative local fallback for substantive answers if GPT fails
      const len = p.answerText.trim().length;
      const score = len > 220 ? 58 : len > 120 ? 48 : 35;
      return {
        id: p.id,
        technicalAccuracy: Math.round(score / 10),
        communication: Math.round(score / 10),
        problemSolving: Math.round(score / 10),
        confidence: Math.max(1, Math.round(score / 10) - 1),
        completeness: Math.round(score / 10),
        practicalKnowledge: Math.round(score / 10),
        feedback:
          "Model evaluation unavailable — provisional conservative score based on answer length and structure.",
        score,
      };
    }),
  });

  const batch = await aiService.generateJSON<{
    evaluations: Array<Partial<AnswerEvaluationResult> & { id: string }>;
  }>(prompt, fallback);

  const byId = new Map((batch.evaluations || []).map((e) => [e.id, e]));
  for (const pair of needsModel) {
    const raw = byId.get(pair.id);
    results.set(
      pair.id,
      normalizeAnswerEvaluation(
        {
          ...raw,
          qualityFlag: "substantive",
        },
        40
      )
    );
  }

  return results;
}
