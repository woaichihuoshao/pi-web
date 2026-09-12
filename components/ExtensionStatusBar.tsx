"use client";

import { stripAnsi } from "@/lib/ansi";
import type { ExtensionStatusItem, ExtensionWidgetItem } from "@/lib/types";
import { AnsiText } from "./AnsiText";
import { ExtensionWidgets } from "./ExtensionWidgets";

export function sanitizeExtensionStatusText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\t/g, " ").replace(/ +/g, " ").trim())
    .join("\n")
    .trim();
}

export function formatExtensionStatusLine(statuses: ExtensionStatusItem[]): string {
  return [...statuses]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(({ text }) => sanitizeExtensionStatusText(text))
    .join(" ");
}

/**
 * A widget that has no lines has nothing to show. Extensions commonly keep one
 * registered for a whole session (pi-x-ide, for example), which would otherwise
 * leave an empty trigger sitting in the footer.
 */
export function widgetsWithContent(widgets: ExtensionWidgetItem[]): ExtensionWidgetItem[] {
  return widgets.filter((widget) => widget.lines.some((line) => line.trim().length > 0));
}

export function ExtensionStatusBar({
  statuses,
  widgets = [],
}: {
  statuses: ExtensionStatusItem[];
  widgets?: ExtensionWidgetItem[];
}) {
  const visibleWidgets = widgetsWithContent(widgets);
  const orderedStatuses = [...statuses].sort((a, b) => a.key.localeCompare(b.key));

  if (orderedStatuses.length === 0 && visibleWidgets.length === 0) return null;

  const statusLine = formatExtensionStatusLine(statuses);
  const plainStatusLine = stripAnsi(statusLine);

  return (
    <div
      className={`extension-status-shelf${visibleWidgets.length > 0 ? " has-widgets" : ""}${orderedStatuses.length > 0 ? " has-status" : ""}`}
    >
      {visibleWidgets.length > 0 && <ExtensionWidgets widgets={visibleWidgets} />}
      {orderedStatuses.length > 0 && (
        <div
          role="status"
          className="extension-status-line"
          aria-label={plainStatusLine}
          title={plainStatusLine}
        >
          <span className="extension-status-text">
            {orderedStatuses.map(({ key, text }) => {
              const label = stripAnsi(sanitizeExtensionStatusText(text));
              return (
                <span key={key} className="extension-status-pill" title={label}>
                  <AnsiText text={sanitizeExtensionStatusText(text)} />
                </span>
              );
            })}
          </span>
        </div>
      )}
    </div>
  );
}
