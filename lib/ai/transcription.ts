import "server-only";

import { AIError } from "@/lib/ai/ai-error";

export type AudioFormat = "wav" | "mp3" | "ogg" | "webm" | "m4a";

export interface TranscribeAudioOptions {
  audioUrl?: string;
  audioBase64?: string;
  mimeType?: string;
  format?: AudioFormat;
  languageHint?: string;
}

export interface TranscribeAudioResult {
  text: string;
  model: string;
}

/**
 * Infer the audio format from a URL or MIME type.
 */
export function inferAudioFormat(urlOrMime?: string): AudioFormat {
  if (!urlOrMime) return "mp3";
  const lower = urlOrMime.toLowerCase();

  if (lower.includes("ogg") || lower.endsWith(".ogg") || lower.includes("opus")) return "ogg";
  if (lower.includes("wav") || lower.endsWith(".wav")) return "wav";
  if (lower.includes("webm") || lower.endsWith(".webm")) return "webm";
  if (lower.includes("m4a") || lower.endsWith(".m4a") || lower.includes("mp4")) return "m4a";
  return "mp3";
}

/**
 * Transcribes an audio recording (e.g. WhatsApp voice note, Facebook voice message, or web mic audio)
 * into text using OpenRouter's multimodal Gemini audio models with Bengali and English support.
 */
export async function transcribeAudio(options: TranscribeAudioOptions): Promise<TranscribeAudioResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new AIError("not_configured", "OPENROUTER_API_KEY is not configured");
  }

  let base64Audio = options.audioBase64;
  let detectedFormat = options.format;

  // 1. Fetch from URL if base64 not provided directly
  if (!base64Audio && options.audioUrl) {
    const res = await fetch(options.audioUrl, {
      headers: { Accept: "audio/*,application/octet-stream" },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch audio from URL: ${res.statusText}`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (!detectedFormat) {
      detectedFormat = inferAudioFormat(contentType || options.audioUrl);
    }

    const buffer = await res.arrayBuffer();
    base64Audio = Buffer.from(buffer).toString("base64");
  }

  if (!base64Audio) {
    throw new Error("Neither audioUrl nor audioBase64 was provided");
  }

  const audioFormat = detectedFormat || inferAudioFormat(options.mimeType);

  // 2. Call OpenRouter with multimodal audio payload
  const promptInstruction = options.languageHint
    ? `Transcribe the spoken audio message verbatim. Expected language hint: ${options.languageHint}. The message may be in Bengali, English, or mixed Bengali-English. Return ONLY the transcribed text, with no explanations, greetings, or timestamps.`
    : `Transcribe the spoken audio message verbatim. The message may be in Bengali, English, or mixed Bengali-English (Banglish). Return ONLY the transcribed text, with no explanations, greetings, or timestamps. If the audio contains only silence or unintelligible noise, return "[Inaudible]".`;

  const modelsToTry = [
    "google/gemini-2.5-flash",
    "google/gemini-2.0-flash-001",
    "google/gemini-flash-1.5",
  ];

  let lastError: unknown = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://driplare.com",
          "X-Title": "Driplare AI Omnichannel",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: promptInstruction,
                },
                {
                  type: "input_audio",
                  inputAudio: {
                    data: base64Audio,
                    format: audioFormat,
                  },
                },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.warn(`[TRANSCRIBE_AUDIO] Model ${model} returned ${response.status}: ${errBody}`);
        continue;
      }

      const json = await response.json();
      const content = json.choices?.[0]?.message?.content;
      const transcriptionText = typeof content === "string" ? content.trim() : "";

      return {
        text: transcriptionText,
        model,
      };
    } catch (err) {
      console.warn(`[TRANSCRIBE_AUDIO] Attempt with ${model} failed:`, err);
      lastError = err;
    }
  }

  throw new AIError(
    "all_models_failed",
    "Failed to transcribe audio with all available models",
    { task: "transcribe" }
  );
}
