/**
 * Pure helpers behind /api/transcribe.
 *
 * Kept import-free so the test suite can load it with node's type stripping
 * (the lib/*.test.mjs convention in this repository).
 */

export class TranscribeError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "TranscribeError";
    this.status = status;
  }
}

/**
 * MediaRecorder output differs per browser: Opus-in-WebM in Chromium/Firefox,
 * Opus-in-Ogg on some builds, AAC-in-MP4 in Safari. Decoders sniff the container
 * from the bytes, so the extension is only a hint for the temporary file.
 */
export function extensionForContentType(contentType: string | null): string {
  const type = (contentType || "").split(";")[0].trim().toLowerCase();
  switch (type) {
    case "audio/webm":
    case "video/webm":
      return "webm";
    case "audio/ogg":
    case "audio/opus":
      return "ogg";
    case "audio/mp4":
    case "audio/aac":
    case "audio/x-m4a":
      return "m4a";
    case "audio/wav":
    case "audio/wave":
    case "audio/x-wav":
      return "wav";
    case "audio/mpeg":
      return "mp3";
    case "audio/flac":
      return "flac";
    default:
      return "webm";
  }
}

/** Whatever the helper prints on stdout is the transcript. */
export function parseTranscriptOutput(stdout: string): string {
  const text = stdout.trim();
  if (!text) {
    throw new TranscribeError("The transcription helper returned no text", 422);
  }
  return text;
}

/**
 * Pick the most useful line out of a failing helper's stderr. Node's own crash
 * output ends with a bare version banner and a stack trace, which would
 * otherwise become the message the user sees.
 */
export function summarizeHelperError(stderr: string, exitCode: number | null): string {
  const lines = stderr
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^Node\.js v\d/.test(line))
    .filter((line) => !line.startsWith("at "))
    .filter((line) => !line.startsWith("node:internal"))
    .filter((line) => !/^If you are using/.test(line));

  if (lines.length > 0) return lines[lines.length - 1];
  return exitCode === null ? "the helper could not be started" : `exit code ${exitCode}`;
}
