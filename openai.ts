import type { AIProvider, GenerateOptions, GenerateResult } from "./types";
import { UnsupportedImageModelError } from "./types";
import { getDecryptedKey } from "../../secrets";

const MODELS = [
  { id: "gpt-4.1", supportsImages: true },
  { id: "gpt-4.1-mini", supportsImages: true },
];

export const openaiProvider: AIProvider = {
  name: "OPENAI",

  supportedModels() {
    return MODELS;
  },

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    const modelInfo = MODELS.find((m) => m.id === opts.model);
    if (opts.requiresImageUnderstanding && !modelInfo?.supportsImages) {
      throw new UnsupportedImageModelError(opts.model);
    }

    const apiKey = await getDecryptedKey("OPENAI");
    if (!apiKey) throw new Error("No OpenAI API key configured. Set one in Admin Panel → AI Provider.");

    const messages = [
      { role: "system", content: opts.systemPrompt },
      ...opts.turns
        .filter((t) => t.role !== "system")
        .map((t) => ({
          role: t.role,
          content: t.content.map((p) =>
            p.type === "text"
              ? { type: "text", text: p.text }
              : { type: "image_url", image_url: { url: `data:${p.imageMediaType};base64,${p.imageBase64}` } }
          ),
        })),
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: opts.model,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        messages,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    return { text, raw: data };
  },

  async testConnection(apiKey: string) {
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { authorization: `Bearer ${apiKey}` },
      });
      return res.ok
        ? { ok: true, message: "Connected." }
        : { ok: false, message: `Provider rejected the key (HTTP ${res.status}).` };
    } catch (e) {
      return { ok: false, message: `Network error reaching OpenAI: ${(e as Error).message}` };
    }
  },
};
