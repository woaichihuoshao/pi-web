import assert from "node:assert/strict";
import test from "node:test";

async function loadSubject() {
  return import("./process-notification.ts");
}

const LOG_MATCH_DETAILS = {
  kind: "log_match",
  processId: "proc_5666",
  processName: "diag_verbose_r1_seed01",
  command: "python3 scripts/run_growth_stage_experiments.py --stages r1_open",
  timestamp: 1789050563416,
  summary: "Process \"diag_verbose_r1_seed01\" matched log pattern \"DONE runs=\" on stdout.",
  logMatch: {
    pattern: "DONE runs=",
    mode: "literal",
    stream: "stdout",
    line: "DONE runs=1 success=0 failed=1",
    matcherIndex: 1,
  },
  attention: "turn",
};

const SUCCESS_DETAILS = {
  kind: "success",
  processId: "proc_0e71",
  processName: "qim-camp20",
  command: "bash scripts/experiments/_qim_camp20.sh 2>&1",
  timestamp: 1789050000000,
  summary: "Process \"qim-camp20\" succeeded after 625s.",
  status: "exited",
  exitCode: 0,
  endReason: "exit",
  signal: null,
  attention: "context",
};

test("parses a log-match notification", async () => {
  const { parseProcessNotification } = await loadSubject();

  const view = parseProcessNotification(LOG_MATCH_DETAILS);
  assert.equal(view.kind, "log_match");
  assert.equal(view.processName, "diag_verbose_r1_seed01");
  assert.deepEqual(view.logMatch, {
    pattern: "DONE runs=",
    mode: "literal",
    stream: "stdout",
    line: "DONE runs=1 success=0 failed=1",
  });
  assert.equal(view.elapsedSeconds, null);
  assert.equal(view.exitCode, null);
  assert.equal(view.attention, "turn");
});

test("recovers the duration from the extension's English summary", async () => {
  const { parseProcessNotification, elapsedSecondsFromSummary } = await loadSubject();

  assert.equal(parseProcessNotification(SUCCESS_DETAILS).elapsedSeconds, 625);
  assert.equal(elapsedSecondsFromSummary("Process \"x\" failed.\""), null);
  assert.equal(elapsedSecondsFromSummary("Process \"x\" failed with exit code 1 after 12s."), 12);
});

test("keeps signal details for a killed process", async () => {
  const { parseProcessNotification, processNotificationTone } = await loadSubject();

  const view = parseProcessNotification({
    kind: "killed",
    processName: "cooja_pinned_probe",
    summary: "Process \"cooja_pinned_probe\" ended after receiving SIGTERM (15, termination request).",
    signal: { name: "SIGTERM", number: 15, description: "termination request" },
    endReason: "signal",
  });

  assert.equal(view.signalName, "SIGTERM");
  assert.equal(view.signalNumber, 15);
  assert.equal(view.endReason, "signal");
  assert.equal(processNotificationTone("killed"), "muted");
  assert.equal(processNotificationTone("success"), "success");
  assert.equal(processNotificationTone("crash"), "error");
  assert.equal(processNotificationTone("log_match"), "accent");
});

test("ignores anything that is not a process notification", async () => {
  const { parseProcessNotification } = await loadSubject();

  assert.equal(parseProcessNotification(undefined), null);
  assert.equal(parseProcessNotification(null), null);
  assert.equal(parseProcessNotification("ad-process:notification"), null);
  assert.equal(parseProcessNotification({ kind: "unknown", processName: "x" }), null);
  assert.equal(parseProcessNotification({ kind: "success" }), null);
  assert.equal(parseProcessNotification({ kind: "success", processName: "  " }), null);
});

test("parses the processes status widget line into entries", async () => {
  const { parseProcessStatusWidget } = await loadSubject();

  // 真实数据：来自运行中的实例（含 ANSI 颜色）
  const real = "\x1b[2mps:\x1b[0m \x1b[36m●\x1b[0m panel-probe  \x1b[36m●\x1b[0m piweb-dev-30142  \x1b[2m■\x1b[0m piweb-dev-30142  \x1b[32m✓\x1b[0m 4 done";
  const summary = parseProcessStatusWidget([real]);
  assert.equal(summary.runningCount, 2);
  assert.deepEqual(
    summary.entries.map((entry) => [entry.state, entry.name, entry.count]),
    [
      ["running", "panel-probe", null],
      ["running", "piweb-dev-30142", null],
      ["terminated", "piweb-dev-30142", null],
      ["done", "done", 4],
    ],
  );
});

test("ignores widget lines that are not a process list", async () => {
  const { parseProcessStatusWidget, isProcessWidgetKey } = await loadSubject();

  assert.equal(parseProcessStatusWidget([]), null);
  assert.equal(parseProcessStatusWidget([""]), null);
  assert.equal(parseProcessStatusWidget(["nothing to see"]), null);
  assert.equal(isProcessWidgetKey("processes-status"), true);
  assert.equal(isProcessWidgetKey("processes-dock"), true);
  assert.equal(isProcessWidgetKey("pi-x-ide"), false);
});
