"use client";

import { useCallback, useEffect, type RefObject } from "react";
import { useI18n } from "@/hooks/useI18n";
import { useVoiceInput, type VoiceTranscript } from "@/hooks/useVoiceInput";
import {
  formatRecordingDuration,
  insertTranscriptAt,
  type VoiceInputError,
} from "@/lib/voice-input";
import type { TranslationParams } from "@/lib/i18n/types";

interface Props {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  setValue: (value: string) => void;
}

/** Maps a voice-input failure to a localized message. */
function errorText(
  error: VoiceInputError | null,
  t: (key: string, params?: TranslationParams) => string,
): string | null {
  if (!error) return null;
  switch (error.code) {
    case "unsupported":
      return t("chat.voiceUnsupported");
    case "permission":
      return t("chat.voicePermission");
    case "empty":
      return t("chat.voiceEmpty");
    case "tooLong":
      return t("chat.voiceTooLong");
    case "notConfigured":
      return t("chat.voiceNotConfigured");
    default:
      return error.message || t("chat.voiceFailed");
  }
}

/**
 * Self-contained dictation control for the composer: records through
 * /api/transcribe and inserts the transcript at the caret.
 *
 * Everything the feature needs except one JSX element lives in files this
 * component owns, so re-applying it after an upstream merge stays a single
 * insertion into ChatInput.tsx.
 */
export function VoiceInputButton({ textareaRef, value, setValue }: Props) {
  const { t } = useI18n();

  const applyTranscript = useCallback((transcript: VoiceTranscript) => {
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? value.length;
    const next = insertTranscriptAt(value, cursor, transcript.text);
    setValue(next.value);
    requestAnimationFrame(() => {
      const element = textareaRef.current;
      if (!element) return;
      element.focus();
      element.setSelectionRange(next.cursor, next.cursor);
      element.style.height = "auto";
      element.style.height = `${Math.min(element.scrollHeight, 200)}px`;
    });
  }, [setValue, textareaRef, value]);

  const { state, error, elapsedMs, start, stop, clearError } = useVoiceInput({ onTranscript: applyTranscript });

  // Failures are transient: show the reason briefly, then get out of the way.
  // Typing, restoring a draft, or starting another take clears it sooner.
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(clearError, 5000);
    return () => clearTimeout(timer);
  }, [clearError, error]);

  useEffect(() => {
    clearError();
  }, [clearError, value]);

  const toggle = useCallback(() => {
    if (state === "recording") stop();
    else if (state === "idle") void start();
  }, [start, state, stop]);

  const duration = formatRecordingDuration(elapsedMs);
  const label = state === "recording"
    ? t("chat.voiceStop")
    : state === "transcribing"
      ? t("chat.voiceTranscribing")
      : t("chat.voiceStart");
  const failure = state === "idle" ? errorText(error, t) : null;
  const failureDetail = error?.message || failure;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      {/* Recording time stays visible during a long take; failures stay truncated
          so a long message can never push the control row around. */}
      {state === "recording" && (
        <span
          aria-label={`${t("chat.voiceRecording")} ${duration}`}
          style={{
            color: "var(--state-danger)",
            fontSize: 12,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.01em",
          }}
        >
          {duration}
        </span>
      )}
      {failure && (
        <span
          role="alert"
          title={failureDetail || undefined}
          style={{
            maxWidth: 220,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: "var(--state-danger)",
            fontSize: 12,
          }}
        >
          {failure}
        </span>
      )}
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-pressed={state === "recording"}
        disabled={state === "transcribing"}
        onClick={toggle}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 32,
          height: 32,
          padding: 0,
          background: state === "recording" ? "var(--state-danger-soft)" : "none",
          border: "none",
          borderRadius: 9,
          color: state === "recording" ? "var(--state-danger)" : "var(--text-muted)",
          cursor: state === "transcribing" ? "progress" : "pointer",
          opacity: state === "transcribing" ? 0.6 : 1,
          transition: "background 0.12s, color 0.12s, opacity 0.12s",
        }}
        onMouseEnter={(event) => {
          if (state === "transcribing") return;
          event.currentTarget.style.background = state === "recording" ? "var(--state-danger-soft)" : "var(--bg-hover)";
          if (state !== "recording") event.currentTarget.style.color = "var(--text)";
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.background = state === "recording" ? "var(--state-danger-soft)" : "none";
          event.currentTarget.style.color = state === "recording" ? "var(--state-danger)" : "var(--text-muted)";
        }}
      >
        {state === "transcribing" ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ animation: "spin 0.8s linear infinite" }} aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-6.2-8.6" />
          </svg>
        ) : state === "recording" ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ animation: "pulse 1s ease-in-out infinite" }}>
            <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="8" y1="22" x2="16" y2="22" />
          </svg>
        )}
      </button>
    </div>
  );
}
