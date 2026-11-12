export type AutoTrainEvidence = {
  platform: string;
  label: string;
  quote: string;
  agentName?: string;
};

export type EvidenceSource = {
  platform: string;
  label: string;
  text: string;
  agentName?: string;
};

export function redactConversationPersonalData(text: string): string {
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]")
    .replace(/(?<!\w)\+?\d[\d\s().-]{7,}\d(?!\w)/g, "[phone]");
}

export function matchEvidence(value: unknown, transcripts: EvidenceSource[]): AutoTrainEvidence | null {
  if (!value || typeof value !== "object") return null;
  const evidence = value as Partial<AutoTrainEvidence>;
  if (typeof evidence.quote !== "string" || evidence.quote.trim().length < 12) return null;
  const normalize = (text: string) => text.toLocaleLowerCase().replace(/\s+/g, " ").trim();
  const quote = normalize(evidence.quote);
  const source = transcripts.find((transcript) => normalize(transcript.text).includes(quote));
  if (!source) return null;
  return {
    platform: source.platform,
    label: source.label,
    quote: evidence.quote.trim().slice(0, 500),
    ...(source.agentName ? { agentName: source.agentName } : {}),
  };
}
