import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./ChatWindow.tsx", import.meta.url), "utf8");

test("merges a turn's process events into one Process Group", () => {
  // 一轮用户消息只渲染一个组；不再每个工具调用各起一组
  assert.match(source, /const renderProcessGroup = \(/);
  assert.match(source, /<TurnProcessGroup/);
  assert.match(source, /key=\{`process-group-\$\{entryIds\[userIdx\] \?\? userIdx\}/);
  assert.doesNotMatch(source, /ProcessDetailsGroup/);
});

test("keeps a completed turn without a final answer expanded by default", () => {
  assert.match(
    source,
    /const turn = collectProcessItems\(userIdx \+ 1, endIdx\);[\s\S]*?renderProcessGroup\(turn, \{ suffix: isLiveTail \? "-live" : "-done", defaultExpanded: true \}\)/,
  );
  assert.match(
    source,
    /renderProcessGroup\(turnProcess, \{ defaultExpanded: !finalAnswerMessage \}\)/,
  );
});

test("shows the model name once per turn", () => {
  assert.match(source, /const groupShowsModelLabel = renderProcessGroup\(turnProcess/);
  assert.match(source, /showModelLabel: !groupShowsModelLabel/);
});
