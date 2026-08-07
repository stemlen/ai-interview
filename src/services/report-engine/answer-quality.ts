/**
 * Deterministic answer-quality gate.
 * Non-answers like "idk" must never receive mid-band scores.
 */

const REFUSAL_PATTERNS = [
  /^i\s*don'?t\s*know\b/i,
  /^idk\b/i,
  /^dunno\b/i,
  /^no\s*idea\b/i,
  /^not\s*sure\b/i,
  /^no\s*clue\b/i,
  /^skip(ped)?\b/i,
  /^pass\b/i,
  /^n\/?a\b/i,
  /^none\b/i,
  /^nothing\b/i,
  /^no\s*answer\b/i,
  /^\(skipped\)/i,
  /^\(no verbal/i,
  /^\(answered verbally/i,
  /^\(interview ended/i,
  /^hmm+\b/i,
  /^uh+\b/i,
  /^um+\b/i,
  /^okay?\b$/i,
  /^ok\b$/i,
  /^yes\b$/i,
  /^no\b$/i,
  /^maybe\b$/i,
];

export type AnswerQualityKind = "empty" | "refusal" | "too_short" | "gibberish" | "substantive";

export interface AnswerQuality {
  kind: AnswerQualityKind;
  /** When set, do not ask GPT — use this score directly. */
  forcedScore: number | null;
  reason: string;
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function looksGibberish(text: string): boolean {
  const letters = (text.match(/[a-zA-Z]/g) || []).length;
  if (letters < 6) return true;
  const unique = new Set(text.toLowerCase().replace(/[^a-z]/g, "")).size;
  if (letters > 8 && unique <= 3) return true;
  // repeated single token
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words.every((w) => w === words[0])) return true;
  return false;
}

export function classifyAnswerQuality(rawAnswer: string | undefined | null): AnswerQuality {
  const trimmed = (rawAnswer || "").trim();
  if (!trimmed) {
    return { kind: "empty", forcedScore: 0, reason: "No answer provided." };
  }

  const normalized = trimmed.replace(/\s+/g, " ");
  for (const pattern of REFUSAL_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        kind: "refusal",
        forcedScore: 5,
        reason: "Candidate declined or indicated they did not know the answer.",
      };
    }
  }

  if (looksGibberish(normalized) || wordCount(normalized) < 4) {
    return {
      kind: wordCount(normalized) < 4 ? "too_short" : "gibberish",
      forcedScore: 8,
      reason: "Answer is too short or lacks meaningful technical content.",
    };
  }

  return { kind: "substantive", forcedScore: null, reason: "Answer has enough content for model evaluation." };
}

/** Instant local score used mid-interview (honest floors). */
export function scoreAnswerLocally(rawAnswer: string | undefined | null): {
  technicalAccuracy: number;
  communication: number;
  problemSolving: number;
  confidence: number;
  completeness: number;
  practicalKnowledge: number;
  feedback: string;
  score: number;
} {
  const quality = classifyAnswerQuality(rawAnswer);
  if (quality.forcedScore !== null) {
    const rating = Math.max(0, Math.round(quality.forcedScore / 10));
    return {
      technicalAccuracy: rating,
      communication: rating,
      problemSolving: rating,
      confidence: rating,
      completeness: rating,
      practicalKnowledge: rating,
      feedback: quality.reason,
      score: quality.forcedScore,
    };
  }

  // Substantive but GPT not called yet — conservative provisional score
  const length = (rawAnswer || "").trim().length;
  let score = 45;
  let rating = 4;
  if (length > 220) {
    score = 62;
    rating = 6;
  } else if (length > 120) {
    score = 55;
    rating = 5;
  }

  return {
    technicalAccuracy: rating,
    communication: rating,
    problemSolving: rating,
    confidence: rating,
    completeness: rating,
    practicalKnowledge: rating,
    feedback: "Provisional score — final evaluation runs at report generation.",
    score,
  };
}
