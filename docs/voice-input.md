# Voice Input

The chat composer has a microphone button: click once to record, click again to
stop. The recording is transcribed locally and the text is inserted at the caret.
A recording timer sits next to the button while you talk.

## Flow

```
Browser                Next.js server              Helper process
  MediaRecorder  ──POST /api/transcribe──▶  lib/transcribe.ts
  (getUserMedia)      bounded raw body,      scripts/transcribe-audio.mjs
                      temp file, serialized     ffmpeg → 16 kHz mono float PCM
                                                transcribe-cpp (FFI) → text
       insert at caret ◀──── { text } ◀───────────────────┘
```

## Why a helper process

`transcribe-cpp` is a koffi FFI binding over `libtranscribe.so`, not a CLI, and a
loaded model costs hundreds of megabytes. Running it in
`scripts/transcribe-audio.mjs` keeps the native library out of the Next.js bundle
and keeps the server process free of a resident model. Runs are serialized
(`globalThis.__piTranscribeQueue`) because each helper loads its own copy.

## The model comes from the pi-transcribe extension

The helper reads `~/.pi/agent/pi-transcribe.json` directly — the file the
`pi-transcribe` Pi extension writes through `/transcribe` — so the model,
transcription language and Chinese script preference are configured once and
shared by both interfaces. Change the model in the TUI and the composer follows.

It deliberately does not import that extension's TypeScript: `settings.ts` pulls
in `@earendil-works/pi-coding-agent`, `runtime.ts` pulls in `pi-tui`, and Node's
type stripping cannot run that source anyway (parameter properties).

| Setting | Source |
| --- | --- |
| Model path | `model.path` in `pi-transcribe.json`, or `PI_WEB_TRANSCRIBE_MODEL` |
| Language | `transcriptionLanguage` (`auto` → model detection) |
| Chinese script | `chineseOutput` (`simplified` converts with `opencc-js` when available) |
| `transcribe-cpp` | pi-web's own `node_modules`, then the pi-transcribe checkout, then `~/.pi/agent/npm/node_modules`; override with `PI_TRANSCRIBE_MODULE_DIR` |
| ffmpeg | `PI_TRANSCRIBE_FFMPEG_PATH`, else `ffmpeg` on `PATH` |
| Helper path | `PI_WEB_TRANSCRIBE_HELPER` (defaults to `scripts/transcribe-audio.mjs`) |

To use a different engine, replace the helper: it only has to read the audio file
it is given, print the transcript on stdout, keep diagnostics on stderr and exit
non-zero on failure. `lib/transcribe.ts` maps exit code 3 to "not set up",
4 to "could not decode" and 6 to "longer than the model accepts".

## Limits

- The configured model reports `supportsStreaming: false`, so this is a
  stop-then-transcribe flow. Measured on this machine's Vulkan backend it runs at
  roughly 100× realtime: an 8 s clip returns in ~1.0 s including model load.
- It also reports `maxAudioMs` (Qwen3-ASR-0.6B: ~87 minutes); the helper refuses
  a longer recording with the limit in the message instead of failing inside the
  backend.
- Request bodies are capped at 25 MiB and a run at 300 seconds.
- Failures map to statuses the composer localizes: `413` recording longer than
  the model accepts (or a body over 25 MiB), `422` undecodable or silent audio,
  `503` missing helper, model or `transcribe-cpp`, `504` timeout, `500` anything
  else. `error.message` carries the reason and is shown on hover.
- The browser needs a secure context (`localhost` counts) and microphone
  permission; both failures are reported in the composer.
