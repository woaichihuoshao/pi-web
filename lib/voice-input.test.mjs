import assert from "node:assert/strict";
import test from "node:test";

async function loadSubject() {
  return import("./voice-input.ts");
}

test("prefers Opus WebM but falls back to what the browser supports", async () => {
  const { pickRecorderMimeType, RECORDER_MIME_TYPES } = await loadSubject();

  assert.equal(
    pickRecorderMimeType((type) => type === "audio/webm;codecs=opus"),
    "audio/webm;codecs=opus",
  );
  assert.equal(pickRecorderMimeType((type) => type === "audio/mp4"), "audio/mp4");
  assert.equal(pickRecorderMimeType(() => false), null);
  assert.deepEqual(
    RECORDER_MIME_TYPES.slice(0, 2),
    ["audio/webm;codecs=opus", "audio/webm"],
  );
});

test("inserts a transcript at the caret with surrounding whitespace", async () => {
  const { insertTranscriptAt } = await loadSubject();

  const empty = insertTranscriptAt("", 0, "  你好  ");
  assert.deepEqual(empty, { value: "你好 ", cursor: 3 });

  const middle = insertTranscriptAt("写一个脚本", 0, "帮我");
  assert.deepEqual(middle, { value: "帮我 写一个脚本", cursor: 3 });

  const separated = insertTranscriptAt("先做这个 ", 5, "再做那个");
  assert.deepEqual(separated, { value: "先做这个 再做那个 ", cursor: 10 });

  const trailing = insertTranscriptAt("done", 4, "next");
  assert.deepEqual(trailing, { value: "done next ", cursor: 10 });
});

test("leaves the composer untouched for an empty transcript", async () => {
  const { insertTranscriptAt } = await loadSubject();

  assert.deepEqual(insertTranscriptAt("保留原文", 2, "   "), { value: "保留原文", cursor: 2 });
});

test("clamps an out-of-range caret", async () => {
  const { insertTranscriptAt } = await loadSubject();

  assert.deepEqual(insertTranscriptAt("abc", 99, "d"), { value: "abc d ", cursor: 6 });
  assert.deepEqual(insertTranscriptAt("abc", -5, "d"), { value: "d abc", cursor: 2 });
});

test("formats a recording duration as minutes and seconds", async () => {
  const { formatRecordingDuration } = await loadSubject();

  assert.equal(formatRecordingDuration(0), "0:00");
  assert.equal(formatRecordingDuration(7_400), "0:07");
  assert.equal(formatRecordingDuration(65_000), "1:05");
  assert.equal(formatRecordingDuration(-1), "0:00");
});

test("maps recorder and API failures to localizable codes", async () => {
  const { classifyRecorderError, classifyTranscribeResponse } = await loadSubject();

  assert.equal(classifyRecorderError("NotAllowedError"), "permission");
  assert.equal(classifyRecorderError("NotFoundError"), "unsupported");
  assert.equal(classifyRecorderError("AbortError"), "failed");
  assert.equal(classifyRecorderError(undefined), "failed");

  assert.equal(classifyTranscribeResponse(413), "tooLong");
  assert.equal(classifyTranscribeResponse(503), "notConfigured");
  assert.equal(classifyTranscribeResponse(422), "empty");
  assert.equal(classifyTranscribeResponse(500), "failed");
});
