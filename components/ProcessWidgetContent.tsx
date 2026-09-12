"use client";

import { useI18n } from "@/hooks/useI18n";
import type { ProcessState, ProcessStatusSummary } from "@/lib/process-notification";

const STATE_COLORS: Record<ProcessState, string> = {
  running: "var(--accent)",
  done: "#16a34a",
  terminated: "var(--text-dim)",
  failed: "#dc2626",
};

const STATE_GLYPHS: Record<ProcessState, string> = {
  running: "●",
  done: "✓",
  terminated: "■",
  failed: "!",
};

const STATE_KEYS: Record<ProcessState, string> = {
  running: "process.stateRunning",
  done: "process.stateDone",
  terminated: "process.stateTerminated",
  failed: "process.stateFailed",
};

/**
 * The `pi-processes` status widget rendered with the app's own colors.
 *
 * The extension hands over one pre-formatted, terminal-colored line; parsing it
 * back into entries is what lets the panel say "运行中 / 已完成 / 已终止" in the
 * reader's language instead of leaving a gray run-on line.
 */
export function ProcessWidgetContent({ summary }: { summary: ProcessStatusSummary }) {
  const { t } = useI18n();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, padding: "2px 0" }}>
      {summary.entries.map((entry, index) => (
        <div
          key={`${entry.state}-${entry.name}-${index}`}
          style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12.5, lineHeight: 1.65 }}
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
            {entry.count === null
              ? entry.name
              : t("process.doneCount", { count: entry.count })}
          </span>
          {entry.count === null && (
            <span style={{ color: "var(--text-dim)", fontSize: 11.5 }}>
              {t(STATE_KEYS[entry.state])}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
