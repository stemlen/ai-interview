import { GPTOSSProvider } from "./gpt-oss.provider";
import { GeminiProvider } from "./gemini.provider";
import type { AIProvider } from "./ai-provider.interface";

/**
 * Active AI provider for question generation / evaluation.
 * Default: NVIDIA GPT OSS 20b (openai/gpt-oss-20b).
 * Set NEXT_PUBLIC_AI_PROVIDER=gemini to use the legacy Gemini path.
 */
const selectedProviderType = process.env.NEXT_PUBLIC_AI_PROVIDER || "gpt-oss";

let activeProvider: AIProvider;

if (selectedProviderType === "gemini") {
  activeProvider = new GeminiProvider();
} else {
  activeProvider = new GPTOSSProvider();
}

export const aiService = activeProvider;
export type { AIProvider };
