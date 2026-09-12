/**
 * Parser for the `ad-process:notification` messages that the `pi-processes`
 * extension writes into a session.
 *
 * The message body is an English XML-ish block (that is what Pi's TUI renders
 * through the extension's own renderer), and `details` carries the same
 * information structured. Pi Web renders its own localized card from the
 * structured payload and only falls back to the generic custom-message card
 * when the payload is missing or unknown.
 *
 * Kept import-free so the test suite can load it with node's type stripping.
 */

export const PROCESS_NOTIFICATION_TYPE = "ad-process:notification";

export type ProcessNotificationKind =
  | "success"
  | "failure"
  | "crash"
  | "killed"
  | "log_match"
  | "log_match_suppressed";

export interface ProcessNotificationLogMatch {
  pattern: string;
  mode: string;
  stream: string;
  line: string;
}

export interface ProcessNotificationView {
  kind: ProcessNotificationKind;
  processId: string;
  processName: string;
  command: string;
  timestamp: number | null;
  exitCode: number | null;
  endReason: string | null;
  signalName: string | null;
  signalNumber: number | null;
  logMatch: ProcessNotificationLogMatch | null;
  /** The extension's own English sentence; kept for the expanded view. */
  summary: string;
  elapsedSeconds: number | null;
  attention: string | null;
}

const KINDS: readonly ProcessNotificationKind[] = [
  "success",
  "failure",
  "crash",
  "killed",
  "log_match",
  "log_match_suppressed",
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * The extension only puts the duration in its English sentence
 * (`Process "x" succeeded after 625s.`), so recover it from there.
 */
export function elapsedSecondsFromSummary(summary: string): number | null {
  const match = /after (\d+(?:\.\d+)?)s\b/.exec(summary);
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? seconds : null;
}

export function parseProcessNotification(details: unknown): ProcessNotificationView | null {
  const record = asRecord(details);
  if (!record) return null;

  const kind = asString(record.kind) as ProcessNotificationKind;
  if (!KINDS.includes(kind)) return null;

  const processName = asString(record.processName).trim();
  if (!processName) return null;

  const logMatchRecord = asRecord(record.logMatch);
  const signalRecord = asRecord(record.signal);
  const summary = asString(record.summary);

  return {
    kind,
    processId: asString(record.processId),
    processName,
    command: asString(record.command),
    timestamp: asNumber(record.timestamp),
    exitCode: asNumber(record.exitCode),
    endReason: asString(record.endReason) || null,
    signalName: signalRecord ? asString(signalRecord.name) || null : null,
    signalNumber: signalRecord ? asNumber(signalRecord.number) : null,
    logMatch: logMatchRecord && asString(logMatchRecord.pattern).trim()
      ? {
          pattern: asString(logMatchRecord.pattern).trim(),
          mode: asString(logMatchRecord.mode),
          stream: asString(logMatchRecord.stream),
          line: asString(logMatchRecord.line),
        }
      : null,
    summary,
    elapsedSeconds: elapsedSecondsFromSummary(summary),
    attention: asString(record.attention) || null,
  };
}

/** Which headline and dot a kind gets; the component maps these to i18n keys. */
export function processNotificationTone(kind: ProcessNotificationKind): "success" | "error" | "muted" | "accent" {
  switch (kind) {
    case "success":
      return "success";
    case "failure":
    case "crash":
      return "error";
    case "killed":
      return "muted";
    default:
      return "accent";
  }
}

/* ------------------------------------------------------------------ *
 * Processes status widget (`processes-status`)
 *
 * The extension renders one pre-formatted line, colored for a terminal:
 *
 *   ps: ● panel-probe  ● worker  ■ old-job  ✓ 4 done
 *
 * Pi Web parses it back into entries so the panel can use the app's own
 * colors and say the state in words instead of leaving a gray run-on line.
 * ------------------------------------------------------------------ */

export const PROCESS_WIDGET_KEYS: readonly string[] = ["processes-status", "processes-dock"];

export type ProcessState = "running" | "terminated" | "done" | "failed";

export interface ProcessStatusEntry {
  state: ProcessState;
  /** Process name, or the localized count target for aggregated entries. */
  name: string;
  /** Set for aggregated entries such as `✓ 4 done`. */
  count: number | null;
}

export interface ProcessStatusSummary {
  entries: ProcessStatusEntry[];
  runningCount: number;
}

const ANSI_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

function processStateForGlyph(glyph: string): ProcessState | null {
  switch (glyph) {
    case "●":
    case "○":
      return "running";
    case "■":
      return "terminated";
    case "✓":
      return "done";
    case "!":
      return "failed";
    default:
      return null;
  }
}

export function isProcessWidgetKey(key: string): boolean {
  return PROCESS_WIDGET_KEYS.includes(key);
}

export function parseProcessStatusWidget(lines: string[]): ProcessStatusSummary | null {
  const text = lines.join("\n").replace(ANSI_RE, "").trim();
  if (!text) return null;

  const items = text
    .replace(/^ps:\s*/i, "")
    .split(/\s{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  const entries: ProcessStatusEntry[] = [];
  for (const item of items) {
    const state = processStateForGlyph(item.charAt(0));
    if (!state) continue;
    const rest = item.slice(1).trim();
    if (!rest) continue;

    const aggregate = /^(\d+)\s+done$/i.exec(rest);
    entries.push({
      state,
      name: aggregate ? "done" : rest,
      count: aggregate ? Number(aggregate[1]) : null,
    });
  }

  if (entries.length === 0) return null;
  return {
    entries,
    runningCount: entries.filter((entry) => entry.state === "running").length,
  };
}
