#!/usr/bin/env node
/**
 * Local speech-to-text helper for Pi Web voice input.
 *
 * Pi Web runs this as an out-of-process transcription engine: it writes the
 * browser recording to a file and prints the transcript on stdout, keeping
 * diagnostics on stderr and exiting non-zero on failure.
 *
 *   node scripts/transcribe-audio.mjs /tmp/recording.webm
 *
 * It decodes with ffmpeg to 16 kHz mono float PCM and transcribes with the
 * local transcribe.cpp model that the `pi-transcribe` Pi extension configured —
 * it reads that extension's `pi-transcribe.json` for the model path, language
 * and Chinese script preference, so both interfaces share one setup. It also
 * refuses recordings longer than the model's own `maxAudioMs`.
 *
 * Running out of process matters: `transcribe-cpp` loads `libtranscribe.so`
 * through koffi FFI and a loaded model costs hundreds of megabytes, which must
 * not live inside the Next.js server. See docs/voice-input.md.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

/** Exit codes are informational: the caller reports the last stderr line. */
const EXIT_USAGE = 2;
const EXIT_CONFIG = 3;
const EXIT_DECODE = 4;
const EXIT_TRANSCRIBE = 5;
const EXIT_TOO_LONG = 6;

const AGENT_DIR = process.env.PI_AGENT_DIR || join(homedir(), ".pi", "agent");
const SETTINGS_PATH =
  process.env.PI_TRANSCRIBE_CONFIG || join(AGENT_DIR, "pi-transcribe.json");

function fail(code, message) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

/**
 * Roots that may contain `transcribe-cpp` and `opencc-js`. The extension
 * checkout is the fallback because `pi install` puts the only copy of
 * `transcribe-cpp` there.
 */
function moduleRoots() {
  const roots = [];
  const explicit = process.env.PI_TRANSCRIBE_MODULE_DIR;
  if (explicit) roots.push(explicit);
  roots.push(join(import.meta.dirname, "..", "node_modules"));
  roots.push(join(process.cwd(), "node_modules"));
  roots.push(
    join(AGENT_DIR, "git", "github.com", "earendil-works", "pi-transcribe", "node_modules"),
  );
  roots.push(join(AGENT_DIR, "npm", "node_modules"));
  return roots;
}

function resolveModuleFile(relativePath) {
  for (const root of moduleRoots()) {
    if (!root) continue;
    const candidate = join(root, relativePath);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function readSettings() {
  let raw;
  try {
    raw = JSON.parse(readFileSync(SETTINGS_PATH, "utf8"));
  } catch (error) {
    fail(
      EXIT_CONFIG,
      `Cannot read ${SETTINGS_PATH}: ${error instanceof Error ? error.message : String(error)}. ` +
        "Configure the model once with /transcribe inside Pi.",
    );
  }

  const modelPath = process.env.PI_WEB_TRANSCRIBE_MODEL || raw?.model?.path;
  if (!modelPath || !existsSync(modelPath)) {
    fail(
      EXIT_CONFIG,
      `Transcription model not found: ${modelPath ?? "(unset)"}. ` +
        "Configure it with /transcribe inside Pi.",
    );
  }

  const chineseOutput = raw?.chineseOutput;
  return {
    modelPath,
    language:
      raw?.transcriptionLanguage && raw.transcriptionLanguage !== "auto"
        ? String(raw.transcriptionLanguage)
        : undefined,
    chineseOutput:
      chineseOutput === "traditional-taiwan" || chineseOutput === "traditional-hong-kong"
        ? chineseOutput
        : "simplified",
  };
}

/** Mirrors pi-transcribe's decodeFileAudio(): 16 kHz mono float32 PCM on stdout. */
function decodeAudio(audioPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = process.env.PI_TRANSCRIBE_FFMPEG_PATH || "ffmpeg";
    const child = spawn(
      ffmpeg,
      [
        "-hide_banner",
        "-loglevel", "error",
        "-nostdin",
        "-protocol_whitelist", "file,pipe",
        "-i", audioPath,
        "-map", "0:a:0",
        "-vn", "-sn", "-dn",
        "-ac", "1",
        "-ar", "16000",
        "-acodec", "pcm_f32le",
        "-f", "f32le",
        "pipe:1",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    const chunks = [];
    let size = 0;
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      chunks.push(chunk);
      size += chunk.length;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", (error) => {
      reject(
        new Error(
          error.code === "ENOENT"
            ? `ffmpeg not found (${ffmpeg}). Install it or set PI_TRANSCRIBE_FFMPEG_PATH.`
            : error.message,
        ),
      );
    });
    child.once("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with ${code}: ${stderr.trim() || "no output"}`));
        return;
      }
      const buffer = Buffer.concat(chunks, size);
      if (buffer.length === 0) {
        reject(new Error("Decoded audio is empty; the recording had no audio track."));
        return;
      }
      resolve(new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4));
    });
  });
}

function isChineseLanguage(language) {
  const base = String(language || "").toLowerCase().split("-")[0];
  return base === "zh" || base === "yue";
}

async function convertChineseOutput(text, output) {
  const openccPackage = resolveModuleFile("opencc-js/package.json");
  if (!openccPackage) return text;
  try {
    const entry = pathToFileURL(join(dirname(openccPackage), "dist", "esm", "full.js")).href;
    const { default: OpenCC } = await import(entry);
    const mapping =
      output === "traditional-taiwan"
        ? { from: "cn", to: "tw" }
        : output === "traditional-hong-kong"
          ? { from: "cn", to: "hk" }
          : { from: "t", to: "cn" };
    return OpenCC.Converter(mapping)(text);
  } catch (error) {
    process.stderr.write(
      `Chinese script conversion unavailable, keeping model output: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return text;
  }
}

async function main() {
  const audioPath = process.argv[2];
  if (!audioPath) fail(EXIT_USAGE, "Usage: node scripts/transcribe-audio.mjs <audio-file>");
  if (!existsSync(audioPath)) fail(EXIT_USAGE, `No such audio file: ${audioPath}`);

  const settings = readSettings();

  const distPath =
    process.env.PI_TRANSCRIBE_DIST ||
    resolveModuleFile("transcribe-cpp/dist/index.js");
  if (!distPath) {
    fail(
      EXIT_CONFIG,
      "Cannot find the transcribe-cpp package. Install the pi-transcribe extension " +
        "(pi install ssh://git@github.com/earendil-works/pi-transcribe) or set " +
        "PI_TRANSCRIBE_MODULE_DIR to a node_modules directory that contains it.",
    );
  }

  const { TranscribeModel } = await import(distPath);

  let pcm;
  try {
    pcm = await decodeAudio(audioPath);
  } catch (error) {
    fail(EXIT_DECODE, error instanceof Error ? error.message : String(error));
  }

  let model;
  try {
    model = await TranscribeModel.load(settings.modelPath);
  } catch (error) {
    fail(
      EXIT_TRANSCRIBE,
      `Failed to load the model: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  let language = settings.language;
  const supported = model.capabilities?.languages ?? [];
  if (language && supported.length > 0 && !supported.includes(language)) {
    process.stderr.write(
      `Language ${language} is not supported by this model; falling back to auto detection.\n`,
    );
    language = undefined;
  }

  // The model rejects audio beyond its own limit; fail with the number instead
  // of letting a long take die inside the backend.
  const audioMs = (pcm.length / 16000) * 1000;
  const maxAudioMs = model.capabilities?.maxAudioMs ?? 0;
  if (maxAudioMs > 0 && audioMs > maxAudioMs) {
    const modelName = model.arch || model.variant || "this model";
    model.dispose?.();
    fail(
      EXIT_TOO_LONG,
      `Recording is ${(audioMs / 60000).toFixed(1)} minutes long, but ${modelName} ` +
        `accepts at most ${(maxAudioMs / 60000).toFixed(0)} minutes per request. Record it in shorter takes.`,
    );
  }

  let result;
  try {
    result = await model.transcribe(pcm, { timestamps: "none", language });
  } catch (error) {
    model.dispose?.();
    fail(EXIT_TRANSCRIBE, `Transcription failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const detected = result.language || "";
  let text = String(result.text || "").trim();
  if (isChineseLanguage(detected || language || "")) {
    text = (await convertChineseOutput(text, settings.chineseOutput)).trim();
  }
  model.dispose?.();

  if (detected || language) {
    process.stderr.write(`[transcribe] language=${detected || language}\n`);
  }
  // The transcript is the command's stdout; diagnostics stay on stderr.
  process.stdout.write(`${text}\n`);
}

await main();
