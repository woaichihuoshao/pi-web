"use client";

import { useI18n } from "@/hooks/useI18n";
import type { TranslationParams } from "@/lib/i18n/types";
import {
  processNotificationTone,
  type ProcessNotificationView,
} from "@/lib/process-notification";

const TONE_COLORS: Record<ReturnType<typeof processNotificationTone>, string> = {
  success: "#16a34a",
  error: "#dc2626",
  muted: "var(--text-dim)",
  accent: "var(--accent)",
};

const TONE_GLYPHS: Record<ReturnType<typeof processNotificationTone>, string> = {
  success: "✓",
  error: "!",
  muted: "■",
  accent: "●",
};

function formatElapsed(
  t: (key: string, params?: TranslationParams) => string,
  seconds: number,
): string {
  if (seconds < 60) return t("process.elapsedSeconds", { seconds: Math.round(seconds) });
  const minutes = Math.floor(seconds / 60);
  return t("process.elapsedMinutes", { minutes, seconds: Math.round(seconds % 60) });
}

/**
 * One-line notice for a `pi-processes` notification.
 *
 * The extension's message body is an English XML block and its `details` payload
 * is JSON; neither reads well in a transcript, and a process finishing does not
 * deserve more than a line. The full command and the extension's own sentence
 * stay in the tooltip.
 */
export function ProcessNotificationMessage({ view }: { view: ProcessNotificationView }) {
  const { t } = useI18n();

  const tone = processNotificationTone(view.kind);
  const color = TONE_COLORS[tone];
  const meta: string[] = [];
  if (view.exitCode !== null) meta.push(t("process.exitCode", { code: view.exitCode }));
  if (view.elapsedSeconds !== null) meta.push(formatElapsed(t, view.elapsedSeconds));
  if (view.signalName) {
    meta.push(t("process.signal", {
      name: view.signalName,
      number: view.signalNumber === null ? "" : view.signalNumber,
    }));
  }
  if (view.endReason) meta.push(t("process.endReason", { reason: view.endReason }));

  const tooltip = [view.summary, view.command].filter(Boolean).join("\n");

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        title={tooltip || undefined}
        style={{
          display: "flex",
          maxWidth: "100%",
          alignItems: "center",
          gap: 8,
          padding: "4px 10px",
          border: `1px solid color-mix(in srgb, ${color} 35%, var(--border))`,
          borderRadius: 999,
          background: `color-mix(in srgb, ${color} 8%, var(--bg-panel))`,
          color: "var(--text-muted)",
          fontSize: 12,
        }}
      >
        <span style={{ color, fontFamily: "var(--font-mono)", fontWeight: 700 }} aria-hidden="true">
          {TONE_GLYPHS[tone]}
        </span>
        <span style={{ color: "var(--text)", fontWeight: 600, whiteSpace: "nowrap" }}>
          {t(`process.notice.${view.kind}`)}
        </span>
        <span style={{ overflow: "hidden", color: "var(--text)", fontFamily: "var(--font-mono)", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {view.processName}
        </span>
        {meta.length > 0 && (
          <span style={{ whiteSpace: "nowrap" }}>{meta.join(" · ")}</span>
        )}
        {view.logMatch && (
          <span
            style={{
              minWidth: 0,
              overflow: "hidden",
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {t("process.pattern", { pattern: view.logMatch.pattern })}
          </span>
        )}
      </div>
    </div>
  );
}
