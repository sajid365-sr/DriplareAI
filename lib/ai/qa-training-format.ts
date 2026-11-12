/** How a FAQ is embedded and surfaced back as `[Context N]`. */
export function formatFaqContent(question: string, answer: string): string {
  return `Question: ${question}\nAnswer: ${answer}`;
}

/** How a sample reply is embedded and surfaced back as `[Context N]`. */
export function formatSampleReplyContent(customerMessage: string, reply: string): string {
  if (!customerMessage.trim()) {
    return `General response example:\nRecommended reply: "${reply}"\nUse this as a response-style example. Do not treat it as a business fact unless it directly states one.`;
  }
  return `When a customer says: "${customerMessage}"\nThe ideal reply is: "${reply}"`;
}

/** A unified answer is both a grounded response and an example of desired phrasing. */
export function formatBusinessAnswerContent(context: string, answer: string): string {
  if (!context.trim()) {
    return `General response example:\nRecommended answer: "${answer}"\nUse this as a response-style example. Do not treat it as a business fact unless it directly states one.`;
  }
  return [
    `Customer question or situation: ${context}`,
    `Recommended answer: ${answer}`,
    "Use this as a grounded answer when relevant and as an example of the desired response style.",
  ].join("\n");
}
