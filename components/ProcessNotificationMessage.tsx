"use client";

import {
  processNotificationTone,
  type ProcessNotificationKind,
  type ProcessNotificationView,
} from "@/lib/process-notification";

/**
 * The visual language of a tool-call header row (see ToolCallBlock): a 7px
 * rounded box, green for success, red for failures, one compact line.
 * Process notifications reuse it so a finished process looks like any other
 * command result instead of a separate card style.
 */
const TONES = {
  success: {
    border: "1px solid var(--state-success-border)",
    background: "var(--state-success-soft)",
    accent: "var(--state-success)",
    glyph: "✓",
  },
  error: {
    border: "1px solid var(--state-danger-border)",
    background: "var(--state-danger-soft)",
    accent: "var(--state-danger)",
    glyph: "!",
  },
  muted: {
    border: "1px solid var(--border)",
    background: "transparent",
    accent: "var(--text-dim)",
    glyph: "■",
  },
  accent: {
    border: "1px solid color-mix(in srgb, var(--accent) 35%, var(--border))",
    background: "color-mix(in srgb, var(--accent) 5%, transparent)",
    accent: "var(--accent)",
    glyph: "●",
  },
} as const;

/** English state words, deliberately not translated. */
const HEADLINES: Record<ProcessNotificationKind, string> = {
  success: "finished",
  failure: "failed",
  crash: "crashed",
  killed: "terminated",
  log_match: "log matched",
  log_match_suppressed: "log matched (muted)",
};

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

export function ProcessNotificationMessage({ view }: { view: ProcessNotificationView }) {
  const tone = TONES[processNotificationTone(view.kind)];

  const details: string[] = [HEADLINES[view.kind]];
  if (view.exitCode !== null) details.push(`exit code ${view.exitCode}`);
  if (view.elapsedSeconds !== null) details.push(formatElapsed(view.elapsedSeconds));
  if (view.signalName) {
    details.push(`signal ${view.signalName}${view.signalNumber === null ? "" : ` ${view.signalNumber}`}`);
  }
  if (view.logMatch) details.push(`pattern ${view.logMatch.pattern}`);

  const tooltip = [view.summary, view.command].filter(Boolean).join("\n");

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        title={tooltip || undefined}
        style={{ borderRadius: 7, overflow: "hidden", fontSize: "var(--font-sm)", border: tone.border, background: tone.background }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, padding: "6px 10px" }}>
          <span style={{ flexShrink: 0, color: tone.accent, fontFamily: "var(--font-mono)", fontSize: "var(--font-xs)", fontWeight: 600 }}>
            process
          </span>
          <span
            style={{
              flexShrink: 0,
              maxWidth: "45%",
              overflow: "hidden",
              color: "var(--text)",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--font-xs)",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {view.processName}
          </span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              color: "var(--text-dim)",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--font-xs)",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {details.join(" · ")}
          </span>
          <span style={{ flexShrink: 0, color: tone.accent, fontFamily: "var(--font-mono)", fontSize: 11 }} aria-hidden="true">
            {tone.glyph}
          </span>
        </div>
      </div>
    </div>
  );
}
