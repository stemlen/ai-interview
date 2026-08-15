import { DeepSeekProvider } from "./deepseek.provider";
import { GeminiProvider } from "./gemini.provider";
import type { AIProvider } from "./ai-provider.interface";

/**
 * Active AI provider for question generation, evaluation, and conversational responses.
 * Default: DeepSeek V4 Flash (`deepseek-v4-flash` / `deepseek-ai/deepseek-v4-flash`).
 * Set NEXT_PUBLIC_AI_PROVIDER=gemini to use Google Gemini.
 */
const selectedProviderType = (process.env.NEXT_PUBLIC_AI_PROVIDER || "deepseek").toLowerCase();

let activeProvider: AIProvider;

if (selectedProviderType === "gemini") {
  activeProvider = new GeminiProvider();
} else {
  activeProvider = new DeepSeekProvider();
}

export const aiService = activeProvider;
export { DeepSeekProvider, GeminiProvider };
export type { AIProvider };
