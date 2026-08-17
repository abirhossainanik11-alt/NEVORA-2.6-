import type { AIProvider, GenerateOptions, GenerateResult } from "./types";
import { UnsupportedImageModelError } from "./types";
import { getDecryptedKey } from "../../secrets";

const MODELS = [
  { id: "gemini-2.5-pro", supportsImages: true },
  { id: "gemini-2.5-flash", supportsImages: true },
];

export const geminiProvider: AIProvider = {
  name: "GEMINI",

  supportedModels() {
    return MODELS;
  },

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    const modelInfo = MODELS.find((m) => m.id === opts.model);
    if (opts.requiresImageUnderstanding && !modelInfo?.supportsImages) {
      throw new UnsupportedImageModelError(opts.model);
    }

    const apiKey = await getDecryptedKey("GEMINI");
    if (!apiKey) throw new Error("No Gemini API key configured. Set one in Admin Panel → AI Provider.");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent?key=${apiKey}`;
    const contents = opts.turns
      .filter((t) => t.role !== "system")
      .map((t) => ({
        role: t.role === "assistant" ? "model" : "user",
        parts: t.content.map((p) =>
          p.type === "text" ? { text: p.text } : { inline_data: { mime_type: p.imageMediaType, data: p.imageBase64 } }
        ),
      }));

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.systemPrompt }] },
        contents,
        generationConfig: { temperature: opts.temperature, maxOutputTokens: opts.maxTokens },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("\n") ?? "";
    return { text, raw: data };
  },

  async testConnection(apiKey: string) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      return res.ok
        ? { ok: true, message: "Connected." }
        : { ok: false, message: `Provider rejected the key (HTTP ${res.status}).` };
    } catch (e) {
      return { ok: false, message: `Network error reaching Gemini: ${(e as Error).message}` };
    }
  },
};
