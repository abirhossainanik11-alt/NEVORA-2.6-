import type { AIProvider, GenerateOptions, GenerateResult } from "./types";
import { UnsupportedImageModelError } from "./types";
import { getDecryptedKey } from "../../secrets";

const MODELS = [
  { id: "claude-sonnet-4-6", supportsImages: true },
  { id: "claude-haiku-4-5", supportsImages: true },
];

export const anthropicProvider: AIProvider = {
  name: "ANTHROPIC",

  supportedModels() {
    return MODELS;
  },

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    const modelInfo = MODELS.find((m) => m.id === opts.model);
    if (opts.requiresImageUnderstanding && !modelInfo?.supportsImages) {
      throw new UnsupportedImageModelError(opts.model);
    }

    const apiKey = await getDecryptedKey("ANTHROPIC");
    if (!apiKey) throw new Error("No Anthropic API key configured. Set one in Admin Panel → AI Provider.");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        system: opts.systemPrompt,
        messages: opts.turns
          .filter((t) => t.role !== "system")
          .map((t) => ({
            role: t.role,
            content: t.content.map((p) =>
              p.type === "text"
                ? { type: "text", text: p.text }
                : { type: "image", source: { type: "base64", media_type: p.imageMediaType, data: p.imageBase64 } }
            ),
          })),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    const text = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");

    return { text, raw: data };
  },

  async testConnection(apiKey: string) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: 8, messages: [{ role: "user", content: "ping" }] }),
      });
      return res.ok
        ? { ok: true, message: "Connected." }
        : { ok: false, message: `Provider rejected the key (HTTP ${res.status}).` };
    } catch (e) {
      return { ok: false, message: `Network error reaching Anthropic: ${(e as Error).message}` };
    }
  },
};
