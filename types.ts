// Common interface every AI provider must implement.
// The rest of the app talks only to this interface — never to a specific
// vendor SDK directly — so Admin can swap providers (§58) without touching
// chat/RAG code.

export interface ChatContentPart {
  type: "text" | "image";
  text?: string;
  imageBase64?: string;
  imageMediaType?: string;
}

export interface ChatTurn {
  role: "user" | "assistant" | "system";
  content: ChatContentPart[];
}

export interface GenerateOptions {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  turns: ChatTurn[];
  /** Whether this request includes image input — provider must reject cleanly if unsupported (§62). */
  requiresImageUnderstanding?: boolean;
}

export interface GenerateResult {
  text: string;
  raw?: unknown;
}

export interface AIProvider {
  readonly name: "GEMINI" | "OPENAI" | "ANTHROPIC";
  /** Models this provider exposes, and which of them support image input. */
  supportedModels(): { id: string; supportsImages: boolean }[];
  generate(opts: GenerateOptions): Promise<GenerateResult>;
  testConnection(apiKey: string): Promise<{ ok: boolean; message: string }>;
}

export class UnsupportedImageModelError extends Error {
  constructor(model: string) {
    super(`Model "${model}" does not support image input. Choose a multimodal model or switch provider.`);
    this.name = "UnsupportedImageModelError";
  }
}
