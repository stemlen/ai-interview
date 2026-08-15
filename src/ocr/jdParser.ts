import { extractTextFromPDF } from "./pdfExtractor";
import {
  extractJDWithGeminiMultimodal,
  extractJDWithGeminiText,
} from "./geminiExtractor";
import { extractJDFromRawText } from "./sectionExtractor";
import type { JDExtractionResult, ParsedJobDescription } from "./types";

/**
 * Main OCR & Job Description Parser Pipeline orchestrator.
 */
export async function extractJobDescription(
  pdfBuffer: Buffer | ArrayBuffer | Uint8Array,
  fileName?: string
): Promise<JDExtractionResult> {
  let nodeBuffer: Buffer;
  if (Buffer.isBuffer(pdfBuffer)) {
    nodeBuffer = pdfBuffer;
  } else if (pdfBuffer instanceof Uint8Array) {
    nodeBuffer = Buffer.from(pdfBuffer);
  } else {
    nodeBuffer = Buffer.from(new Uint8Array(pdfBuffer));
  }
  const base64 = nodeBuffer.toString("base64");

  // 1. Tier 1: Try Gemini Multimodal PDF OCR
  try {
    const aiResult = await extractJDWithGeminiMultimodal(base64);
    if (aiResult && aiResult.role && aiResult.requiredSkills?.length > 0) {
      return {
        data: sanitizeParsedJD(aiResult),
        metadata: {
          method: "gemini-multimodal-ocr",
          pageCount: 1,
          extractedAt: new Date().toISOString(),
          confidence: 95,
        },
      };
    }
  } catch (err) {
    console.warn("Tier 1 Gemini Multimodal JD extraction bypassed:", err);
  }

  // 2. Tier 2: Extract text via unpdf + Gemini Text Completion
  let rawText = "";
  let pageCount = 1;
  try {
    const pdfData = await extractTextFromPDF(nodeBuffer);
    rawText = pdfData.text;
    pageCount = pdfData.pageCount;

    if (rawText && rawText.length > 30) {
      const textAiResult = await extractJDWithGeminiText(rawText);
      if (textAiResult && textAiResult.role && textAiResult.requiredSkills?.length > 0) {
        return {
          data: sanitizeParsedJD(textAiResult),
          metadata: {
            method: "pdf-text-llm",
            pageCount,
            extractedAt: new Date().toISOString(),
            confidence: 88,
          },
          rawText,
        };
      }
    }
  } catch (err) {
    console.warn("Tier 2 text extraction error for JD:", err);
  }

  // 3. Tier 3: Heuristic Rule-Based Parsing
  const heuristicResult = extractJDFromRawText(rawText);
  return {
    data: sanitizeParsedJD(heuristicResult),
    metadata: {
      method: "heuristic-ocr",
      pageCount,
      extractedAt: new Date().toISOString(),
      confidence: 75,
    },
    rawText,
  };
}

function sanitizeParsedJD(jd: ParsedJobDescription): ParsedJobDescription {
  return {
    role: jd.role?.trim() || "Software Engineer",
    company: jd.company?.trim() || "Technology Enterprise",
    experience: jd.experience?.trim() || "2+ Years Experience",
    requiredSkills: Array.isArray(jd.requiredSkills) && jd.requiredSkills.length > 0
      ? Array.from(new Set(jd.requiredSkills.map(s => s.trim()).filter(Boolean)))
      : ["JavaScript", "TypeScript", "React", "Node.js"],
    preferredSkills: Array.isArray(jd.preferredSkills)
      ? Array.from(new Set(jd.preferredSkills.map(s => s.trim()).filter(Boolean)))
      : ["Docker", "AWS", "CI/CD"],
    responsibilities: Array.isArray(jd.responsibilities)
      ? jd.responsibilities.map(r => r.trim()).filter(Boolean)
      : undefined,
    summary: jd.summary?.trim(),
  };
}
