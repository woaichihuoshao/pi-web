import assert from "node:assert/strict";
import test from "node:test";

async function loadSubject() {
  return import("./brand-theme.ts");
}

test("only the DeepSeek themes switch the brand icons", async () => {
  const { usesDeepSeekBrand } = await loadSubject();

  assert.equal(usesDeepSeekBrand("deepseek"), true);
  assert.equal(usesDeepSeekBrand("deepseek-light"), true);
  for (const other of ["light", "dark", "mist", "rose", "pine", "auto"]) {
    assert.equal(usesDeepSeekBrand(other), false, other);
  }
});
