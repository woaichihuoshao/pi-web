import assert from "node:assert/strict";
import test from "node:test";

async function loadSubject() {
  return import("./terminal-font.ts");
}

test("appends Nerd Font fallbacks before the generic monospace keyword", async () => {
  const { terminalFontFamily } = await loadSubject();

  const stack = terminalFontFamily("'Noto Sans Mono', 'JetBrains Mono', monospace");
  assert.match(stack, /^'Noto Sans Mono', 'JetBrains Mono', 'Maple Mono NF CN'/);
  assert.match(stack, /'Symbols Nerd Font', monospace$/);
  assert.equal(stack.split("monospace").length, 2, "only one generic keyword");
});

test("keeps an empty or quoted font stack usable", async () => {
  const { terminalFontFamily } = await loadSubject();

  assert.match(terminalFontFamily(""), /^'Maple Mono NF CN'/);
  assert.match(terminalFontFamily("  \"Fira Code\"  "), /^"Fira Code", 'Maple Mono NF CN'/);
});
