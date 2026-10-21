import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import { inferAudioFormat, transcribeAudio } from "./transcription";

describe("transcription service", () => {
  describe("inferAudioFormat", () => {
    it("infers mp3 by default when empty or unknown", () => {
      expect(inferAudioFormat()).toBe("mp3");
      expect(inferAudioFormat("")).toBe("mp3");
      expect(inferAudioFormat("audio/unknown")).toBe("mp3");
    });

    it("detects ogg from mimetype or url extension", () => {
      expect(inferAudioFormat("audio/ogg; codecs=opus")).toBe("ogg");
      expect(inferAudioFormat("https://cdn.example.com/voice.ogg")).toBe("ogg");
      expect(inferAudioFormat("audio/opus")).toBe("ogg");
    });

    it("detects wav from mimetype or url extension", () => {
      expect(inferAudioFormat("audio/wav")).toBe("wav");
      expect(inferAudioFormat("https://cdn.example.com/recording.wav")).toBe("wav");
    });

    it("detects webm and m4a", () => {
      expect(inferAudioFormat("audio/webm")).toBe("webm");
      expect(inferAudioFormat("audio/m4a")).toBe("m4a");
      expect(inferAudioFormat("https://cdn.example.com/audio.mp4")).toBe("m4a");
    });
  });

  describe("transcribeAudio validation & error handling", () => {
    const originalEnv = process.env.OPENROUTER_API_KEY;

    beforeEach(() => {
      process.env.OPENROUTER_API_KEY = "test-key";
    });

    afterEach(() => {
      process.env.OPENROUTER_API_KEY = originalEnv;
      vi.restoreAllMocks();
    });

    it("throws not_configured if OPENROUTER_API_KEY is not set", async () => {
      delete process.env.OPENROUTER_API_KEY;
      await expect(
        transcribeAudio({ audioBase64: "dGVzdC1hdWRpby1ieXRlcw==" })
      ).rejects.toThrow("OPENROUTER_API_KEY is not configured");
    });

    it("throws invalid_request if neither audioUrl nor audioBase64 is passed", async () => {
      await expect(transcribeAudio({})).rejects.toThrow(
        "Neither audioUrl nor audioBase64 was provided"
      );
    });

    it("successfully returns transcription on valid OpenRouter mock response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "ভাইয়া এই প্রোডাক্টের দাম কত?",
              },
            },
          ],
        }),
      });
      global.fetch = mockFetch;

      const result = await transcribeAudio({
        audioBase64: "dGVzdC1hdWRpby1ieXRlcw==",
        format: "ogg",
      });

      expect(result.text).toBe("ভাইয়া এই প্রোডাক্টের দাম কত?");
      expect(result.model).toBe("google/gemini-2.5-flash");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
