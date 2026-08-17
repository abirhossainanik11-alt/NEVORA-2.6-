import "server-only";
import { prisma } from "../db";
import type { RetrievedChunk } from "./retrieve";

function toVectorLiteral(embedding: number[]) {
  if (!embedding.length || embedding.some((n) => !Number.isFinite(n))) throw new Error("Invalid embedding vector.");
  return `[${embedding.join(",")}]`;
}

export async function vectorUpsert(opts: { chunkId: string; resourceId: string; embedding: number[] }) {
  await prisma.$executeRawUnsafe(
    `UPDATE "Chunk" SET embedding = $1::vector, "embeddingRef" = $2 WHERE id = $3`,
    toVectorLiteral(opts.embedding), opts.chunkId, opts.chunkId,
  );
  return opts.chunkId;
}

interface VectorSearchRow {
  chunkId: string;
  content: string;
  chapter: string | null;
  section: string | null;
  pdfPage: number | null;
  printedPage: number | null;
  resourceTitle: string;
  resourceType: string;
  distance: number;
}

export async function vectorSearch(opts: { queryEmbedding: number[]; resourceIds: string[]; limit: number }): Promise<RetrievedChunk[]> {
  if (!opts.resourceIds.length || opts.limit <= 0) return [];
  const rows = await prisma.$queryRawUnsafe<VectorSearchRow[]>(
    `SELECT c.id AS "chunkId", c.content, c.chapter, c.section,
      c."pdfPage" AS "pdfPage", c."printedPage" AS "printedPage",
      r.title AS "resourceTitle", r.type::text AS "resourceType",
      c.embedding <=> $1::vector AS distance
     FROM "Chunk" c JOIN "Document" d ON d.id = c."documentId" JOIN "Resource" r ON r.id = d."resourceId"
     WHERE r.id = ANY($2::text[]) AND r.status = 'READY' AND c.embedding IS NOT NULL
     ORDER BY distance ASC LIMIT $3`,
    toVectorLiteral(opts.queryEmbedding), opts.resourceIds, opts.limit,
  );
  return rows.map((row) => ({
    chunkId: row.chunkId,
    content: row.content,
    resourceTitle: row.resourceTitle,
    resourceType: row.resourceType,
    chapter: row.chapter,
    section: row.section,
    pdfPage: row.pdfPage,
    printedPage: row.printedPage,
    page: row.printedPage ?? row.pdfPage,
    score: 1 - row.distance,
  }));
}
