"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Mic, Sparkles, Square, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export type BusinessProfileFields = {
  description: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  openingHours: string;
  paymentMethods: string;
  deliveryDetails: string;
};

type SpeechRecognitionEventLike = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type BusinessProfileAssistantProps = {
  workspaceId: string;
  canEdit: boolean;
  onApply: (suggestions: BusinessProfileFields) => void;
};

const PROFILE_KEYS: Array<keyof BusinessProfileFields> = [
  "description", "phone", "email", "website", "address", "openingHours", "paymentMethods", "deliveryDetails",
];

export function BusinessProfileAssistant({ workspaceId, canEdit, onApply }: BusinessProfileAssistantProps) {
  const { t } = useTranslation("knowledge-base");
  const [businessNotes, setBusinessNotes] = useState("");
  const [suggestions, setSuggestions] = useState<BusinessProfileFields | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const browserWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Browser support is detected only after mount.
    setVoiceSupported(Boolean(browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition));
    return () => recognitionRef.current?.stop();
  }, []);

  const toggleVoiceInput = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setListening(false);
      return;
    }
    const browserWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const SpeechRecognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = (document.documentElement.lang || navigator.language).toLowerCase().startsWith("bn") ? "bn-BD" : "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ").trim();
      if (transcript) setBusinessNotes((current) => [current.trim(), transcript].filter(Boolean).join(" "));
    };
    recognition.onerror = () => toast.error(t("businessData.assistant.voiceError", "Voice input could not be captured. You can type your description instead."));
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const prepareSuggestions = async () => {
    if (!workspaceId || !canEdit || businessNotes.trim().length < 20) return;
    setSuggesting(true);
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/business-data/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: businessNotes }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t("businessData.assistant.error", "Could not prepare suggestions"));
      setSuggestions(result.suggestions as BusinessProfileFields);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("businessData.assistant.error", "Could not prepare suggestions"));
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <section className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Sparkles className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-foreground">{t("businessData.assistant.title", "Describe your business")}</h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("businessData.assistant.description", "Type or dictate a short description. AI will suggest profile fields for you to review; nothing is saved until you approve and save it.")}</p>
        </div>
      </div>
      <div className="mt-3 space-y-3">
        <div className="relative">
          <textarea
            value={businessNotes}
            onChange={(event) => setBusinessNotes(event.target.value)}
            disabled={!canEdit || suggesting}
            rows={3}
            maxLength={6000}
            placeholder={t("businessData.assistant.placeholder", "For example: We are a clothing store in Dhaka. We open Saturday to Thursday, accept cash and bKash, and deliver inside Dhaka in 1–2 days.")}
            className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 pr-12 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          />
          {voiceSupported && <button type="button" onClick={toggleVoiceInput} disabled={!canEdit || suggesting} aria-label={listening ? t("businessData.assistant.stopVoice", "Stop voice input") : t("businessData.assistant.startVoice", "Start voice input")} className={`absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${listening ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
            {listening ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}
          </button>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={prepareSuggestions} disabled={!canEdit || suggesting || businessNotes.trim().length < 20} className="gap-2">
            {suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {suggesting ? t("businessData.assistant.preparing", "Preparing suggestions…") : t("businessData.assistant.prepare", "Suggest profile fields")}
          </Button>
          {businessNotes.length > 0 && <span className="text-xs text-muted-foreground">{businessNotes.length}/6000</span>}
        </div>

        {suggestions && <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h5 className="text-sm font-semibold text-foreground">{t("businessData.assistant.reviewTitle", "Review suggested details")}</h5>
              <p className="mt-1 text-xs text-muted-foreground">{t("businessData.assistant.reviewDescription", "Check every value. Applying fills empty fields; it does not overwrite existing saved details or save the form.")}</p>
            </div>
            <button type="button" onClick={() => setSuggestions(null)} aria-label={t("businessData.assistant.dismiss", "Dismiss suggestions")} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {PROFILE_KEYS.map((key) => <div key={key} className="min-w-0 rounded-lg bg-muted/40 p-2.5">
              <dt className="text-[11px] font-medium text-muted-foreground">{t(`businessData.profile.fields.${key}.label`)}</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-xs text-foreground">{suggestions[key] || t("businessData.assistant.notProvided", "Not mentioned")}</dd>
            </div>)}
          </dl>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setSuggestions(null)}>{t("businessData.assistant.discard", "Discard")}</Button>
            <Button type="button" size="sm" onClick={() => { onApply(suggestions); setSuggestions(null); }} className="gap-2"><Check className="h-4 w-4" />{t("businessData.assistant.apply", "Apply to profile")}</Button>
          </div>
        </div>}
      </div>
    </section>
  );
}
