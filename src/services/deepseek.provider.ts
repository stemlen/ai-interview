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

/** Timeout per model attempt before trying next model or falling back to local bank. */
const MODEL_TIMEOUT_MS = 60_000;

interface EndpointConfig {
  baseUrl: string;
  apiKey: string;
  models: string[];
}

function extractJSON<T>(text: string): T {
  // Strip DeepSeek <think>...</think> reasoning blocks if present
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // continue
  }

  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim()) as T;
    } catch {
      // continue
    }
  }

  const objStart = cleaned.indexOf("{");
  const arrStart = cleaned.indexOf("[");
  const startCandidates = [objStart, arrStart].filter((i) => i >= 0);
  if (startCandidates.length === 0) {
    throw new Error("No JSON object/array found in model response");
  }

  const start = Math.min(...startCandidates);
  const endChar = cleaned[start] === "{" ? "}" : "]";
  const end = cleaned.lastIndexOf(endChar);
  if (end <= start) {
    throw new Error("Incomplete JSON in model response");
  }

  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

export class DeepSeekProvider implements AIProvider {
  /** Resolve available API endpoints based on configured environment variables. */
  private getEndpointConfigs(): EndpointConfig[] {
    const configs: EndpointConfig[] = [];

    const deepseekKey =
      process.env.DEEPSEEK_API_KEY ||
      process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
    if (deepseekKey) {
      configs.push({
        baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
        apiKey: deepseekKey,
        models: ["deepseek-v4-flash", "deepseek-chat", "deepseek-reasoner"],
      });
    }

    const nvidiaKey =
      process.env.NVIDIA_API_KEY ||
      process.env.NEXT_PUBLIC_NVIDIA_API_KEY;
    if (nvidiaKey) {
      configs.push({
        baseUrl: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
        apiKey: nvidiaKey,
        models: [
          "deepseek-ai/deepseek-v4-flash",
          "nvidia/deepseek-v4-flash-nvfp4",
          "deepseek-ai/deepseek-v3",
          "deepseek-ai/deepseek-r1",
          "openai/gpt-oss-20b",
          "meta/llama-3.1-8b-instruct",
        ],
      });
    }

    const openrouterKey =
      process.env.OPENROUTER_API_KEY ||
      process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
    if (openrouterKey) {
      configs.push({
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: openrouterKey,
        models: ["deepseek/deepseek-v4-flash", "deepseek/deepseek-chat"],
      });
    }

    return configs;
  }

  private async callModel<T>(prompt: string, fallbackGenerator: () => T): Promise<T> {
    const endpointConfigs = this.getEndpointConfigs();

    if (endpointConfigs.length === 0) {
      console.warn("No AI API keys configured (DEEPSEEK_API_KEY / NVIDIA_API_KEY). Using local fallback.");
      return fallbackGenerator();
    }

    for (const endpoint of endpointConfigs) {
      for (const model of endpoint.models) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

        try {
          console.log(`[DeepSeekProvider] Querying ${endpoint.baseUrl} with model: ${model}...`);

          const response = await fetch(`${endpoint.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${endpoint.apiKey}`,
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
            console.warn(`[DeepSeekProvider] API error with model ${model} (${response.status}):`, errText);
            continue;
          }

          const data = await response.json();
          const content: string | undefined = data?.choices?.[0]?.message?.content;
          if (!content || !String(content).trim()) {
            console.warn(`[DeepSeekProvider] Empty response from ${model}`);
            continue;
          }

          return extractJSON<T>(String(content));
        } catch (error: unknown) {
          const err = error as { name?: string; message?: string };
          if (err?.name === "AbortError") {
            console.warn(`[DeepSeekProvider] Model ${model} exceeded ${MODEL_TIMEOUT_MS}ms timeout.`);
          } else {
            console.warn(`[DeepSeekProvider] Model ${model} call failed:`, err?.message || error);
          }
        } finally {
          clearTimeout(timeoutId);
        }
      }
    }

    console.warn("[DeepSeekProvider] All API attempts failed or timed out. Falling back to local offline generation.");
    return fallbackGenerator();
  }

  async generateBlueprint(context: InterviewContext): Promise<InterviewBlueprint> {
    const prompt = getBlueprintPrompt(context);
    return this.callModel<InterviewBlueprint>(prompt, () => fallbackBlueprint(context));
  }

  async generateMCQs(blueprint: InterviewBlueprint): Promise<MCQQuestion[]> {
    const prompt = getMCQPrompt(blueprint);
    return this.callModel<MCQQuestion[]>(prompt, () => fallbackMCQs(blueprint));
  }

  async generateCodingQuestions(blueprint: InterviewBlueprint): Promise<CodingQuestion[]> {
    const prompt = getCodingPrompt(blueprint);
    return this.callModel<CodingQuestion[]>(prompt, () => fallbackCodingQuestions());
  }

  async generateAptitudeQuestions(blueprint: InterviewBlueprint): Promise<AptitudeQuestion[]> {
    const prompt = getAptitudePrompt(blueprint);
    return this.callModel<AptitudeQuestion[]>(prompt, () => fallbackAptitudeQuestions());
  }

  async evaluateCodeSubmission(
    question: CodingQuestion,
    code: string,
    language: string,
    testRunResults: { passed: number; total: number; compilerOutput?: string }
  ): Promise<{ complexity: string; codeQuality: string; optimization: string; suggestions: string }> {
    const prompt = getCodeEvaluationPrompt(question, code, language, testRunResults);
    return this.callModel(prompt, () => fallbackCodeEvaluation(testRunResults));
  }

  async generateReport(session: InterviewSession): Promise<OAReport> {
    const prompt = getReportPrompt(session);
    return this.callModel<OAReport>(prompt, () => fallbackOAReport(session));
  }

  async generateJSON<T>(prompt: string, fallbackGenerator: () => T): Promise<T> {
    return this.callModel<T>(prompt, fallbackGenerator);
  }
}
