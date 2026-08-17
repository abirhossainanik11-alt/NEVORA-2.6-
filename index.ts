import type { AIProvider, AIProviderName } from "./types";
import { anthropicProvider } from "./anthropic";
import { geminiProvider } from "./gemini";
import { openaiProvider } from "./openai";

const registry: Record<string, AIProvider> = {
  ANTHROPIC: anthropicProvider,
  GEMINI: geminiProvider,
  OPENAI: openaiProvider,
};

export function getProvider(name: AIProviderName | string): AIProvider {
  const provider = registry[name];
  if (!provider) throw new Error(`Unknown AI provider "${name}". Add it to providers/index.ts to register it.`);
  return provider;
}

export type { AIProvider, AIProviderName } from "./types";
