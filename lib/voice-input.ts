/**
 * Pure helpers behind the chat composer's voice input button. The recording
 * side lives in hooks/useVoiceInput.ts; keeping the decisions here makes them
 * testable without a browser.
 */

export type VoiceInputErrorCode = "unsupported" | "permission" | "empty" | "tooLong" | "notConfigured" | "failed";

export interface VoiceInputError {
  code: VoiceInputErrorCode;
  /** Server-provided detail (transcription failures), when it exists. */
  message?: string;
}

/**
 * MediaRecorder container/codec preference. ffmpeg detects the container from
 * the bytes, so any of these can be sent straight to /api/transcribe.
 */
export const RECORDER_MIME_TYPES: readonly string[] = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

export function pickRecorderMimeType(isTypeSupported: (type: string) => boolean): string | null {
  for (const type of RECORDER_MIME_TYPES) {
    if (isTypeSupported(type)) return type;
  }
  return null;
}

/**
 * Insert a transcript at the caret. A separating space is added when the text
 * before the caret does not already end in whitespace, and — unless the tail
 * already starts with whitespace — a trailing space is left behind so the next
 * dictation or @-mention starts cleanly.
 */
export function insertTranscriptAt(
  value: string,
  cursor: number,
  transcript: string,
): { value: string; cursor: number } {
  const text = transcript.trim();
  if (!text) return { value, cursor };

  const position = Math.max(0, Math.min(cursor, value.length));
  const before = value.slice(0, position);
  const after = value.slice(position);
  const prefix = before.length > 0 && !/\s$/.test(before) ? " " : "";
  const suffix = /^\s/.test(after) ? "" : " ";
  const insertion = `${prefix}${text}${suffix}`;
  return { value: before + insertion + after, cursor: position + insertion.length };
}

export function formatRecordingDuration(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

/** getUserMedia / MediaRecorder failures the user can act on. */
export function classifyRecorderError(name: string | undefined): VoiceInputErrorCode {
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "permission";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "NotSupportedError":
    case "OverconstrainedError":
      return "unsupported";
    default:
      return "failed";
  }
}

/** HTTP status from /api/transcribe mapped to a code the composer can localize. */
export function classifyTranscribeResponse(status: number): VoiceInputErrorCode {
  if (status === 413) return "tooLong";
  if (status === 503) return "notConfigured";
  if (status === 422) return "empty";
  return "failed";
}
