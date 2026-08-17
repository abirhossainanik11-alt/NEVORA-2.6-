export interface RawPage {
  pageNumber: number; // physical PDF page
  printedPageNumber?: number; // number printed on the page itself, if detected
  text: string;
  chapter?: string;
  section?: string;
  ocrApplied?: boolean;
}

export interface DocChunk {
  content: string;
  pdfPage: number;
  printedPage?: number;
  chapter?: string;
  section?: string;
  ocrApplied?: boolean;
}

const TARGET_CHUNK_CHARS = 1200;
const OVERLAP_CHARS = 150;

/**
 * Semantic/page-aware chunking (§66).
 * - Never splits across a detected chapter/section boundary.
 * - Prefers paragraph breaks over mid-sentence cuts.
 * - Carries page + chapter + section metadata on every chunk so citations
 *   are always traceable back to a real page (§42, §89).
 */
export function chunkPages(pages: RawPage[]): DocChunk[] {
  const chunks: DocChunk[] = [];

  for (const page of pages) {
    const paragraphs = page.text.split(/\n{2,}|(?<=[.!?।])\s{2,}/).filter((p) => p.trim().length > 0);
    let buffer = "";

    const flush = () => {
      if (buffer.trim().length === 0) return;
      chunks.push({
        content: buffer.trim(),
        pdfPage: page.pageNumber,
        printedPage: page.printedPageNumber,
        chapter: page.chapter,
        section: page.section,
      });
      buffer = "";
    };

    for (const para of paragraphs) {
      if (buffer.length + para.length > TARGET_CHUNK_CHARS && buffer.length > 0) {
        flush();
        // small overlap so a concept split across the boundary still has context
        buffer = buffer.slice(-OVERLAP_CHARS);
      }
      buffer += (buffer ? "\n\n" : "") + para;
    }
    flush();
  }

  return chunks;
}
