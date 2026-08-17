import "server-only";
import { prisma } from "../db";
import { getDecryptedKey } from "../secrets";

export const EMBEDDING_DIMENSIONS = 1536;
export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

export async function embedText(text: string): Promise<number[]> {
  const config = await prisma.aIConfiguration.findUnique({ where: { id: "singleton" }, select: { embeddingProvider: true, embeddingModel: true } });
  const provider = config?.embeddingProvider ?? "OPENAI";
  const model = config?.embeddingModel ?? DEFAULT_EMBEDDING_MODEL;
  if (provider !== "OPENAI") throw new Error("The current pgvector schema supports OpenAI 1536-dimensional embeddings only. Select OPENAI for embeddings.");
  const apiKey = await getDecryptedKey("OPENAI");
  if (!apiKey) throw new Error("No OpenAI embedding API key configured. Add an OpenAI key in Admin Panel → AI Configuration.");
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: text }),
  });
  if (!res.ok) throw new Error(`OpenAI embeddings API error (${res.status}).`);
  const data = await res.json();
  const embedding = data?.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding model "${model}" returned ${Array.isArray(embedding) ? embedding.length : 0} dimensions; NEVORA requires ${EMBEDDING_DIMENSIONS}.`);
  }
  return embedding;
}
