import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { ProcessNotificationMessage } = await jiti.import("./ProcessNotificationMessage.tsx");
const { ProcessWidgetContent } = await jiti.import("./ProcessWidgetContent.tsx");
const { parseProcessNotification, parseProcessStatusWidget } = await jiti.import("@/lib/process-notification.ts");

function render(element) {
  return renderToStaticMarkup(element);
}

function renderNotice(details) {
  const view = parseProcessNotification(details);
  assert.ok(view, "payload parses");
  return render(React.createElement(ProcessNotificationMessage, { view }));
}

test("renders one compact tool-style bar instead of the raw payload", () => {
  const html = renderNotice({
    kind: "log_match",
    processName: "diag_verbose_r1_seed01",
    command: "python3 scripts/run_growth_stage_experiments.py --stages r1_open",
    summary: "Process \"diag\" matched log pattern \"DONE runs=\" on stdout.",
    logMatch: { pattern: "DONE runs=", mode: "literal", stream: "stdout", line: "DONE runs=1 success=0 failed=1" },
    attention: "turn",
  });

  assert.match(html, /process/);              // 与 bash 工具卡同款前缀
  assert.match(html, /border-radius:7px/);     // 同款圆角
  assert.match(html, /log matched/);
  assert.match(html, /pattern DONE runs=/);
  assert.match(html, /diag_verbose_r1_seed01/);
  assert.doesNotMatch(html, /<pre/);           // 不是大卡片
  assert.doesNotMatch(html, /process_event|ad-process:notification/);
});

test("uses the success and failure tints of the tool card", () => {
  const done = renderNotice({ kind: "success", processName: "api", summary: "Process \"api\" succeeded after 6s.", exitCode: 0 });
  assert.match(done, /var\(--state-success-soft\)/);
  assert.match(done, /finished/);
  assert.match(done, /exit code 0/);
  assert.match(done, /6s/);

  const killed = renderNotice({
    kind: "killed",
    processName: "cooja_pinned_probe",
    summary: "Process \"cooja_pinned_probe\" ended after receiving SIGTERM (15, termination request).",
    signal: { name: "SIGTERM", number: 15 },
  });
  assert.match(killed, /terminated/);
  assert.match(killed, /signal SIGTERM 15/);
  assert.match(killed, /border:1px solid var\(--border\)/);
});

test("renders the processes widget as a readable list in English", () => {
  const line = "ps: \x1b[36m●\x1b[0m api  \x1b[36m●\x1b[0m worker  \x1b[2m■\x1b[0m old-job  \x1b[32m✓\x1b[0m 4 done";
  const summary = parseProcessStatusWidget([line]);
  assert.ok(summary);

  const html = render(React.createElement(ProcessWidgetContent, { summary }));
  assert.match(html, /api/);
  assert.match(html, /running/);
  assert.match(html, /old-job/);
  assert.match(html, /terminated/);
  assert.match(html, /4 done/);
  assert.match(html, /flex-wrap:wrap/);       // 横向排列，手机上也只占一行左右的距离
  assert.doesNotMatch(html, /\[36m|\[0m|ps:/); // ANSI 与 ps: 前缀不残留
});
