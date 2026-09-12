import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { ProcessNotificationMessage } = await jiti.import("./ProcessNotificationMessage.tsx");
const { ProcessWidgetContent } = await jiti.import("./ProcessWidgetContent.tsx");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");
const { getLocalePlugin } = await jiti.import("@/lib/i18n/registry.ts");
const { parseProcessNotification, parseProcessStatusWidget } = await jiti.import("@/lib/process-notification.ts");

function render(element) {
  return renderToStaticMarkup(React.createElement(I18nProvider, null, element));
}

function renderNotice(details) {
  const view = parseProcessNotification(details);
  assert.ok(view, "payload parses");
  return render(React.createElement(ProcessNotificationMessage, { view }));
}

test("renders one compact line instead of the raw payload", () => {
  const html = renderNotice({
    kind: "log_match",
    processName: "diag_verbose_r1_seed01",
    command: "python3 scripts/run_growth_stage_experiments.py --stages r1_open",
    summary: "Process \"diag\" matched log pattern \"DONE runs=\" on stdout.",
    logMatch: { pattern: "DONE runs=", mode: "literal", stream: "stdout", line: "DONE runs=1 success=0 failed=1" },
    attention: "turn",
  });

  assert.match(html, /Log pattern matched/);
  assert.match(html, /diag_verbose_r1_seed01/);
  assert.match(html, /pattern DONE runs=/);
  assert.match(html, /title="Process &quot;diag&quot; matched log pattern/); // 完整信息在悬停提示里
  assert.doesNotMatch(html, /process_event|ad-process:notification/);
  assert.doesNotMatch(html, /<pre/); // 不再是大卡片
});

test("shows exit code, duration and signal on the line", () => {
  const html = renderNotice({
    kind: "killed",
    processName: "cooja_pinned_probe",
    summary: "Process \"cooja_pinned_probe\" ended after receiving SIGTERM (15, termination request).",
    signal: { name: "SIGTERM", number: 15, description: "termination request" },
    endReason: "signal",
  });

  assert.match(html, /Process was terminated/);
  assert.match(html, /signal SIGTERM 15/);
  assert.match(html, /end reason signal/);
});

test("renders the processes widget as a readable list", () => {
  const line = "ps: \x1b[36m●\x1b[0m api  \x1b[36m●\x1b[0m worker  \x1b[2m■\x1b[0m old-job  \x1b[32m✓\x1b[0m 4 done";
  const summary = parseProcessStatusWidget([line]);
  assert.ok(summary);

  const html = render(React.createElement(ProcessWidgetContent, { summary }));
  assert.match(html, /api/);
  assert.match(html, /worker/);
  assert.match(html, /old-job/);
  assert.match(html, /4 done/);
  assert.match(html, /running/);
  assert.match(html, /terminated/);
  assert.doesNotMatch(html, /\[36m|\[0m|ps:/); // ANSI 与 ps: 前缀不残留
});

test("every locale carries the process strings", () => {
  const keys = [
    "process.notice.success", "process.notice.failure", "process.notice.crash",
    "process.notice.killed", "process.notice.log_match", "process.notice.log_match_suppressed",
    "process.exitCode", "process.endReason", "process.signal", "process.elapsedSeconds",
    "process.elapsedMinutes", "process.pattern", "process.stream",
    "process.widgetTitle", "process.widgetRunning", "process.stateRunning",
    "process.stateDone", "process.stateTerminated", "process.stateFailed", "process.doneCount",
  ];

  for (const locale of ["en", "zh-CN", "zh-TW"]) {
    const messages = getLocalePlugin(locale).messages;
    for (const key of keys) {
      assert.ok(messages[key], `${locale} missing ${key}`);
    }
  }
  assert.equal(getLocalePlugin("zh-CN").messages["process.notice.log_match"], "匹配到日志关键字");
  assert.equal(getLocalePlugin("zh-CN").messages["process.stateRunning"], "运行中");
  assert.equal(getLocalePlugin("zh-CN").messages["process.doneCount"], "{count} 个已完成");
  assert.equal(getLocalePlugin("zh-TW").messages["process.widgetTitle"], "行程");
});
