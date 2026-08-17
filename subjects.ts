// Seed data for the initial subject list. This is DATA, not architecture —
// Admin can add/edit/deactivate subjects via the DB (Subject model) without
// any code change. This file only seeds the first run.

export interface SubjectSeed {
  key: string;
  name: string;
  shortDesc: string;
  icon: string; // maps to an icon component in components/icons/
  order: number;
}

export const SUBJECT_SEED: SubjectSeed[] = [
  { key: "bangla", name: "Bangla", shortDesc: "Language & literature", icon: "bangla-letter", order: 1 },
  { key: "english", name: "English", shortDesc: "Grammar & composition", icon: "letter-a", order: 2 },
  { key: "mathematics", name: "Mathematics", shortDesc: "Numbers & logic", icon: "geometry", order: 3 },
  { key: "physics", name: "Physics", shortDesc: "Matter, motion & energy", icon: "atom", order: 4 },
  { key: "chemistry", name: "Chemistry", shortDesc: "Matter & reactions", icon: "flask", order: 5 },
  { key: "biology", name: "Biology", shortDesc: "Life & living systems", icon: "dna", order: 6 },
  { key: "bgs", name: "Bangladesh & Global Studies", shortDesc: "History, civics & the world", icon: "globe-map", order: 7 },
  { key: "ict", name: "ICT", shortDesc: "Computing & digital technology", icon: "circuit", order: 8 },
  { key: "islam", name: "Islam & Moral Education", shortDesc: "Faith & ethics", icon: "academic-book", order: 9 },
  { key: "agriculture", name: "Agriculture", shortDesc: "Plants, crops & cultivation", icon: "leaf", order: 10 },
];

/**
 * Academic authority hierarchy for retrieval, in priority order (§44).
 * Used by lib/rag/retrieve.ts to decide what to search first and when to
 * fall back further down the list.
 */
export const AUTHORITY_HIERARCHY = [
  "NCTB_TEXTBOOK",
  "GUIDE",
  "REFERENCE_AND_NOTES",
  "WEB_SEARCH",
  "GENERAL_MODEL_KNOWLEDGE",
] as const;
