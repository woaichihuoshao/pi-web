"use client";

import type { ProcessState, ProcessStatusSummary } from "@/lib/process-notification";

const STATE_COLORS: Record<ProcessState, string> = {
  running: "var(--accent)",
  done: "#16a34a",
  terminated: "var(--text-dim)",
  failed: "#f87171",
};

const STATE_GLYPHS: Record<ProcessState, string> = {
  running: "●",
  done: "✓",
  terminated: "■",
  failed: "!",
};

/** English state words, deliberately not translated. */
const STATE_WORDS: Record<ProcessState, string> = {
  running: "running",
  done: "done",
  terminated: "terminated",
  failed: "failed",
};

/**
 * The `pi-processes` status widget rendered with the app's own colors.
 *
 * The extension hands over one pre-formatted, terminal-colored line; parsing it
 * back into entries is what lets the panel use the app's palette and spell the
 * state out instead of leaving a gray run-on line.
 */
export function ProcessWidgetContent({ summary }: { summary: ProcessStatusSummary }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, padding: "2px 0" }}>
      {summary.entries.map((entry, index) => (
        <div
          key={`${entry.state}-${entry.name}-${index}`}
          style={{ display: "flex", alignItems: "baseline", gap: 7, fontSize: 12.5, lineHeight: 1.6 }}
        >
          <span style={{ color: STATE_COLORS[entry.state], fontFamily: "var(--font-mono)" }} aria-hidden="true">
            {STATE_GLYPHS[entry.state]}
          </span>
          <span
            style={{
              overflow: "hidden",
              color: entry.state === "running" ? "var(--text)" : "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {entry.count === null ? entry.name : `${entry.count} done`}
          </span>
          {entry.count === null && (
            <span style={{ color: "var(--text-dim)", fontSize: 11 }}>
              {STATE_WORDS[entry.state]}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
