import type { AIProvider } from "./ai-provider.interface";
import type {
  InterviewContext,
  InterviewBlueprint,
  MCQQuestion,
  CodingQuestion,
  AptitudeQuestion,
  InterviewSession,
  OAReport,
} from "@/src/types";

import { getBlueprintPrompt } from "@/src/prompts/blueprint.prompt";
import { getMCQPrompt } from "@/src/prompts/mcq.prompt";
import { getCodingPrompt } from "@/src/prompts/coding.prompt";
import { getAptitudePrompt } from "@/src/prompts/aptitude.prompt";
import { getCodeEvaluationPrompt } from "@/src/prompts/evaluation.prompt";
import { getReportPrompt } from "@/src/prompts/report.prompt";
import {
  fallbackAptitudeQuestions,
  fallbackBlueprint,
  fallbackCodeEvaluation,
  fallbackCodingQuestions,
  fallbackMCQs,
  fallbackOAReport,
} from "./offline-fallbacks";

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const GPT_OSS_MODELS = [
  "openai/gpt-oss-20b",
  "meta/llama-3.1-8b-instruct",
];
/** Fall back to next model / local questions if generation exceeds this per attempt. */
const MODEL_TIMEOUT_MS = 60_000;

function extractJSON<T>(text: string): T {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // continue
  }

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim()) as T;
    } catch {
      // continue
    }
  }

  const objStart = trimmed.indexOf("{");
  const arrStart = trimmed.indexOf("[");
  const startCandidates = [objStart, arrStart].filter((i) => i >= 0);
  if (startCandidates.length === 0) {
    throw new Error("No JSON object/array found in model response");
  }

  const start = Math.min(...startCandidates);
  const endChar = trimmed[start] === "{" ? "}" : "]";
  const end = trimmed.lastIndexOf(endChar);
  if (end <= start) {
    throw new Error("Incomplete JSON in model response");
  }

  return JSON.parse(trimmed.slice(start, end + 1)) as T;
}

export class GPTOSSProvider implements AIProvider {
  private getApiKey(): string | null {
    return (
      process.env.NVIDIA_API_KEY ||
      process.env.NEXT_PUBLIC_NVIDIA_API_KEY ||
      null
    );
  }

  private async callGPTOSS<T>(prompt: string, fallbackGenerator: () => T): Promise<T> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      console.warn("NVIDIA API key is not configured. Falling back to local questions.");
      return fallbackGenerator();
    }

    for (const model of GPT_OSS_MODELS) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

      try {
        console.log(`Querying NVIDIA API with model: ${model}...`);

        const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content:
                  "You are a precise interview question generator. Respond with valid JSON only. Do not include markdown fences, commentary, or reasoning outside the JSON.",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.2,
            top_p: 0.9,
            max_tokens: 4096,
            stream: false,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`NVIDIA API error with model ${model}:`, response.status, errText);
          continue;
        }

        const data = await response.json();
        const content: string | undefined = data?.choices?.[0]?.message?.content;
        if (!content || !String(content).trim()) {
          console.warn(`Empty response from ${model}`);
          continue;
        }

        return extractJSON<T>(String(content));
      } catch (error: unknown) {
        const err = error as { name?: string; message?: string };
        if (err?.name === "AbortError") {
          console.warn(`NVIDIA model ${model} exceeded ${MODEL_TIMEOUT_MS}ms timeout.`);
        } else {
          console.warn(`NVIDIA model ${model} failed:`, err?.message || error);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    console.warn("All NVIDIA models failed or timed out. Falling back to local questions.");
    return fallbackGenerator();
  }

  async generateBlueprint(context: InterviewContext): Promise<InterviewBlueprint> {
    const prompt = getBlueprintPrompt(context);
    return this.callGPTOSS<InterviewBlueprint>(prompt, () => fallbackBlueprint(context));
  }

  async generateMCQs(blueprint: InterviewBlueprint): Promise<MCQQuestion[]> {
    const prompt = getMCQPrompt(blueprint);
    return this.callGPTOSS<MCQQuestion[]>(prompt, () => fallbackMCQs(blueprint));
  }

  async generateCodingQuestions(blueprint: InterviewBlueprint): Promise<CodingQuestion[]> {
    const prompt = getCodingPrompt(blueprint);
    return this.callGPTOSS<CodingQuestion[]>(prompt, () => fallbackCodingQuestions());
  }

  async generateAptitudeQuestions(blueprint: InterviewBlueprint): Promise<AptitudeQuestion[]> {
    const prompt = getAptitudePrompt(blueprint);
    return this.callGPTOSS<AptitudeQuestion[]>(prompt, () => fallbackAptitudeQuestions());
  }

  async evaluateCodeSubmission(
    question: CodingQuestion,
    code: string,
    language: string,
    testRunResults: { passed: number; total: number; compilerOutput?: string }
  ): Promise<{ complexity: string; codeQuality: string; optimization: string; suggestions: string }> {
    const prompt = getCodeEvaluationPrompt(question, code, language, testRunResults);
    return this.callGPTOSS(prompt, () => fallbackCodeEvaluation(testRunResults));
  }

  async generateReport(session: InterviewSession): Promise<OAReport> {
    const prompt = getReportPrompt(session);
    return this.callGPTOSS<OAReport>(prompt, () => fallbackOAReport(session));
  }

  async generateJSON<T>(prompt: string, fallbackGenerator: () => T): Promise<T> {
    return this.callGPTOSS<T>(prompt, fallbackGenerator);
  }
}

