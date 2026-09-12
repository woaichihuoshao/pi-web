import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RequestBodyTooLargeError } from "./bounded-form-data";
import {
  TranscribeError,
  extensionForContentType,
  parseTranscriptOutput,
  summarizeHelperError,
} from "./transcribe-command";

/**
 * Voice input for the chat composer.
 *
 * The recording is handed to `scripts/transcribe-audio.mjs`, which decodes it
 * and transcribes it with the local transcribe.cpp model that the
 * `pi-transcribe` Pi extension already configured — so the TUI and the web UI
 * share one model setup.
 *
 * The helper runs out of process on purpose: `transcribe-cpp` loads a native
 * library through koffi FFI and a loaded model costs hundreds of megabytes,
 * which must not live inside the Next.js server. See docs/voice-input.md.
 */

export { TranscribeError, extensionForContentType };

/** ~25 MiB of Opus is far more than any plausible dictation recording. */
export const MAX_TRANSCRIBE_BYTES = 25 * 1024 * 1024;

/** Long recordings still need to make progress; the model runs faster than realtime. */
export const TRANSCRIBE_TIMEOUT_MS = 300_000;

declare global {
  var __piTranscribeQueue: Promise<unknown> | undefined;
}

export function helperPath(): string {
  return process.env.PI_WEB_TRANSCRIBE_HELPER
    || join(process.cwd(), "scripts", "transcribe-audio.mjs");
}

/** Bounded raw-body read; mirrors parseFormDataWithinLimit() for binary uploads. */
export async function readBodyWithinLimit(request: Request, maxBytes: number): Promise<Buffer> {
  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
    throw new RequestBodyTooLargeError();
  }

  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);

  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (size + value.byteLength > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new RequestBodyTooLargeError();
      }
      size += value.byteLength;
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

/**
 * One transcription at a time. Each helper process loads its own copy of the
 * model, so parallel requests multiply memory instead of sharing it. The promise
 * chain lives on globalThis because Next.js hot reload recreates module state.
 */
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const previous = globalThis.__piTranscribeQueue ?? Promise.resolve();
  const next = previous.then(task, task);
  globalThis.__piTranscribeQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/**
 * The helper's exit codes carry the reason: 3 = missing model or engine,
 * 4 = the audio could not be decoded, 6 = the recording is longer than the model
 * accepts.
 */
function statusForExitCode(code: number | null): number {
  if (code === 6) return 413;
  if (code === 4) return 422;
  if (code === 3) return 503;
  return 500;
}

function runHelper(audioPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!existsSync(helperPath())) {
      reject(new TranscribeError(`Transcription helper not found at ${helperPath()}`, 503));
      return;
    }

    const child = spawn(process.execPath, [helperPath(), audioPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, TRANSCRIBE_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", (error: Error) => {
      clearTimeout(timer);
      const code = (error as NodeJS.ErrnoException).code;
      reject(
        new TranscribeError(
          code === "ENOENT"
            ? `Transcription helper not found at ${helperPath()}`
            : `Failed to start the transcription helper: ${error.message}`,
          code === "ENOENT" ? 503 : 500,
        ),
      );
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new TranscribeError("Transcription timed out", 504));
        return;
      }
      if (code !== 0) {
        reject(
          new TranscribeError(summarizeHelperError(stderr, code), statusForExitCode(code)),
        );
        return;
      }
      try {
        resolve(parseTranscriptOutput(stdout));
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function transcribeAudio(
  body: Buffer,
  extension: string,
): Promise<{ text: string }> {
  if (body.length === 0) {
    throw new TranscribeError("The recording is empty", 400);
  }

  const directory = await mkdtemp(join(tmpdir(), "pi-web-voice-"));
  const audioPath = join(directory, `recording.${extension}`);
  try {
    await writeFile(audioPath, body);
    return await serialize(async () => ({ text: await runHelper(audioPath) }));
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}
