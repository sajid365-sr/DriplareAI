import type { RetrievedChunk } from "@/lib/ai/rag";

export type RagRegressionCase = {
  name: string;
  query: string;
  expectedTerms: string[];
  candidates: RetrievedChunk[];
  expectedEvidence: string;
  rejectedEvidence?: string;
};

export const ragRegressionCases: RagRegressionCase[] = [
  {
    name: "exact SKU and price",
    query: "What is the price of SKU-DR_204?",
    expectedTerms: ["price", "sku-dr_204"],
    candidates: [
      {
        content: "SKU DR-204 costs 1,250 BDT.",
        sourceName: "Catalog.xlsx",
        distance: 0.88,
        keywordRank: 1,
      },
      {
        content: "Archived campaign notes.",
        sourceName: "Archive.txt",
        distance: 0.91,
      },
    ],
    expectedEvidence: "SKU DR-204 costs 1,250 BDT.",
    rejectedEvidence: "Archived campaign notes.",
  },
  {
    name: "Bengali delivery fee",
    query: "ঢাকার বাইরে কুরিয়ার ডেলিভারি চার্জ কত?",
    expectedTerms: ["ঢাকার", "বাইরে", "কুরিয়ার", "ডেলিভারি", "চার্জ"],
    candidates: [
      {
        content: "ঢাকার বাইরে কুরিয়ার ডেলিভারি চার্জ ১২০ টাকা।",
        sourceName: "Delivery policy",
        distance: 0.9,
        keywordRank: 1,
      },
    ],
    expectedEvidence: "ডেলিভারি চার্জ ১২০ টাকা",
  },
  {
    name: "semantic business hours",
    query: "When is your showroom open?",
    expectedTerms: ["your", "showroom", "open"],
    candidates: [
      {
        content: "Our showroom welcomes visitors from 10 AM to 8 PM.",
        sourceName: "Business hours",
        distance: 0.42,
      },
    ],
    expectedEvidence: "10 AM to 8 PM",
  },
  {
    name: "weak unrelated evidence is withheld",
    query: "Do you offer international shipping?",
    expectedTerms: ["you", "offer", "international", "shipping"],
    candidates: [
      {
        content: "The store opens at 10 AM.",
        sourceName: "Business hours",
        distance: 0.91,
      },
    ],
    expectedEvidence: "",
  },
];
