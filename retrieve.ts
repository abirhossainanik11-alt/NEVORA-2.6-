import { prisma } from "../db";
import { embedText } from "./embeddings";
import { vectorSearch } from "./vectorStore";

export interface RetrievedChunk {
  chunkId: string;
  content: string;
  resourceTitle: string;
  resourceType: string;
  chapter?: string | null;
  section?: string | null;
  page?: number | null;
  pdfPage?: number | null;
  printedPage?: number | null;
  score: number;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  usedWebFallback: boolean;
}

export async function retrieveForQuestion(opts: {
  subjectId: string;
  question: string;
  topK?: number;
}): Promise<RetrievalResult> {
  const topK = Math.min(Math.max(opts.topK ?? 6, 1), 12);
  const readyResources = await prisma.resource.findMany({
    where: { subjectId: opts.subjectId, status: "READY" },
    select: { id: true, type: true },
  });
  if (!readyResources.length || !opts.question.trim()) return { chunks: [], usedWebFallback: false };

  const queryEmbedding = await embedText(opts.question);
  const priority: Array<"NCTB_TEXTBOOK" | "GUIDE" | "REFERENCE" | "NOTES" | "OTHER"> = [
    "NCTB_TEXTBOOK", "GUIDE", "REFERENCE", "NOTES", "OTHER",
  ];
  const byId = new Map<string, RetrievedChunk>();

  for (const type of priority) {
    const ids = readyResources.filter((r) => r.type === type).map((r) => r.id);
    if (!ids.length) continue;
    const hits = await vectorSearch({ queryEmbedding, resourceIds: ids, limit: topK });
    for (const hit of hits) if (!byId.has(hit.chunkId)) byId.set(hit.chunkId, hit);
  }

  const chunks = [...byId.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  return { chunks, usedWebFallback: false };
}
