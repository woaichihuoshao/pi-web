import assert from "node:assert/strict";
import test from "node:test";

async function loadSubject() {
  return import("./transcribe-command.ts");
}

test("maps recorded containers to temporary-file extensions", async () => {
  const { extensionForContentType } = await loadSubject();

  assert.equal(extensionForContentType("audio/webm;codecs=opus"), "webm");
  assert.equal(extensionForContentType("audio/ogg"), "ogg");
  assert.equal(extensionForContentType("audio/mp4"), "m4a");
  assert.equal(extensionForContentType("audio/wav"), "wav");
  assert.equal(extensionForContentType(null), "webm");
  assert.equal(extensionForContentType("application/octet-stream"), "webm");
});

test("takes the helper's stdout as the transcript", async () => {
  const { TranscribeError, parseTranscriptOutput } = await loadSubject();

  assert.equal(parseTranscriptOutput("  你好，世界\n"), "你好，世界");
  assert.equal(parseTranscriptOutput("line one\nline two\n"), "line one\nline two");
  assert.throws(
    () => parseTranscriptOutput("   \n"),
    (error) => error instanceof TranscribeError && error.status === 422,
  );
});

test("summarizes a failing helper with its reason, not node's banner", async () => {
  const { summarizeHelperError } = await loadSubject();

  assert.equal(
    summarizeHelperError(
      [
        "Error [TranscribeError]: ffmpeg exited with 1: Invalid data found when processing input",
        "    at decodeAudio (file:///srv/pi-web/scripts/transcribe-audio.mjs:120:11)",
        "Node.js v26.7.0",
      ].join("\n"),
      4,
    ),
    "Error [TranscribeError]: ffmpeg exited with 1: Invalid data found when processing input",
  );

  assert.equal(
    summarizeHelperError("node:internal/modules/run_main:107\nNode.js v26.7.0\n", 1),
    "exit code 1",
  );
  assert.equal(summarizeHelperError("", null), "the helper could not be started");
});
