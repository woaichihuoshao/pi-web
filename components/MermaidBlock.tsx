"use client";

import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vs } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { useTheme } from "@/hooks/useTheme";
import { usesDeepSeekBrand } from "@/lib/brand-theme";

/** DeepSeek 主题下的低饱和代码配色（用户给的 token 值，浅色版） */
const dsCodeLight: Record<string, React.CSSProperties> = {
  'code[class*="language-"]': { color: "#303030", background: "none" },
  'pre[class*="language-"]': { color: "#303030", background: "none", margin: 0 },
  comment: { color: "#8a8a8a", fontStyle: "normal" },
  prolog: { color: "#8a8a8a" },
  doctype: { color: "#8a8a8a" },
  cdata: { color: "#8a8a8a" },
  punctuation: { color: "#3f3f3f" },
  selector: { color: "#a54828" },
  property: { color: "#6850b8" },
  "attr-name": { color: "#6850b8" },
  keyword: { color: "#a54828" },
  tag: { color: "#a54828" },
  boolean: { color: "#c05235" },
  number: { color: "#c05235" },
  constant: { color: "#c05235" },
  symbol: { color: "#c05235" },
  string: { color: "#39764f" },
  char: { color: "#39764f" },
  "attr-value": { color: "#39764f" },
  builtin: { color: "#6850b8" },
  function: { color: "#3f5aa8" },
  "class-name": { color: "#3f5aa8" },
  variable: { color: "#303030" },
  operator: { color: "#3f3f3f" },
  "deleted": { color: "#c05235" },
  "inserted": { color: "#39764f" },
};

const dsCodeDark: Record<string, React.CSSProperties> = {
  ...dsCodeLight,
  'code[class*="language-"]': { color: "#e6e6e6", background: "none" },
  'pre[class*="language-"]': { color: "#e6e6e6", background: "none", margin: 0 },
  comment: { color: "#8a8a8a", fontStyle: "normal" },
  prolog: { color: "#8a8a8a" },
  cdata: { color: "#8a8a8a" },
  punctuation: { color: "#c9c9c9" },
  selector: { color: "#e0997a" },
  property: { color: "#b8a6ea" },
  "attr-name": { color: "#b8a6ea" },
  keyword: { color: "#e0997a" },
  tag: { color: "#e0997a" },
  boolean: { color: "#e2a184" },
  number: { color: "#e2a184" },
  constant: { color: "#e2a184" },
  symbol: { color: "#e2a184" },
  string: { color: "#8fbf9f" },
  char: { color: "#8fbf9f" },
  "attr-value": { color: "#8fbf9f" },
  builtin: { color: "#b8a6ea" },
  function: { color: "#9db4e8" },
  "class-name": { color: "#9db4e8" },
  variable: { color: "#e6e6e6" },
  operator: { color: "#c9c9c9" },
  "deleted": { color: "#e2a184" },
  "inserted": { color: "#8fbf9f" },
};
import { useI18n } from "@/hooks/useI18n";
import { copyText } from "@/lib/clipboard";

interface MermaidBlockProps {
  code: string;
  isStreaming?: boolean;
  defaultPreview?: boolean;
}

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;

export function downloadMermaidSvg(svg: SVGSVGElement): void {
  // Mermaid's HTML serialization can leave void tags such as <br> unclosed.
  const xml = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "mermaid-diagram.svg";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

type RenderState =
  | { key: string; status: "loading" }
  | { key: string; status: "error" }
  | { key: string; status: "ready"; svg: string };

export function MermaidBlock({ code, isStreaming, defaultPreview = false }: MermaidBlockProps) {
  const { isDark } = useTheme();
  const { t } = useI18n();
  const [showPreview, setShowPreview] = useState(defaultPreview);
  const [renderState, setRenderState] = useState<RenderState | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const previewRef = useRef<HTMLButtonElement>(null);
  const currentKey = `${isDark ? "dark" : "light"}\n${code}`;
  const previewVisible = showPreview && !isStreaming;

  useEffect(() => {
    if (!previewVisible) return;

    let cancelled = false;
    setRenderState({ key: currentKey, status: "loading" });

    const render = async () => {
      const { default: mermaid } = await import("mermaid");
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        suppressErrorRendering: true,
        theme: isDark ? "dark" : "default",
      });

      const parsed = await mermaid.parse(code, { suppressErrors: true });
      if (!parsed) throw new Error("Invalid Mermaid diagram");

      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? `mermaid-${crypto.randomUUID()}`
          : `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result = await mermaid.render(id, code);
      if (!cancelled) {
        setRenderState({ key: currentKey, status: "ready", svg: result.svg });
      }
    };

    render().catch(() => {
      if (!cancelled) setRenderState({ key: currentKey, status: "error" });
    });

    return () => {
      cancelled = true;
    };
  }, [code, currentKey, isDark, previewVisible]);

  const previewButton = useMemo(() => (
    <button
      type="button"
      onClick={() => setShowPreview((v) => !v)}
      disabled={isStreaming}
      title={isStreaming ? t("i18n.previewAfterStreaming") : (previewVisible ? t("i18n.showMermaidSource") : t("i18n.previewMermaid"))}
      className={["markdown-code-action", previewVisible ? "is-active" : ""].filter(Boolean).join(" ")}
    >
      {previewVisible ? t("i18n.source") : t("i18n.preview")}
    </button>
  ), [isStreaming, previewVisible, t]);

  if (!previewVisible) {
    return <CodeBlock code={code} lang="mermaid" headerAction={previewButton} isStreaming={isStreaming} />;
  }

  const body = renderState?.key === currentKey && renderState.status === "error" ? (
      <div className="mermaid-block mermaid-block-error">{t("i18n.invalidMermaid")}</div>
    ) : renderState?.key !== currentKey || renderState.status !== "ready" ? (
      <div className="mermaid-block mermaid-block-loading" aria-label={t("i18n.renderingMermaid")} />
    ) : (
      <>
        {!zoomOpen && (
          <button
            ref={previewRef}
            type="button"
            className="mermaid-block mermaid-preview-button"
            title={t("i18n.openMermaidViewer")}
            aria-label={t("i18n.openMermaidViewer")}
            onClick={() => setZoomOpen(true)}
            dangerouslySetInnerHTML={{ __html: renderState.svg }}
          />
        )}
        {zoomOpen && <MermaidZoomDialog svg={renderState.svg} onClose={() => setZoomOpen(false)} />}
      </>
    );

  return (
    <div className="markdown-code-block">
      <div className="markdown-code-header">
        <span className="markdown-code-lang">mermaid</span>
        <div className="markdown-code-actions">
          {renderState?.key === currentKey && renderState.status === "ready" && (
            <button
              type="button"
              className="markdown-code-action"
              title={`${t("i18n.downloadFile")} (SVG)`}
              aria-label={`${t("i18n.downloadFile")} (SVG)`}
              onClick={() => {
                const svg = previewRef.current?.querySelector("svg");
                if (svg) downloadMermaidSvg(svg);
              }}
            >
              SVG
            </button>
          )}
          {previewButton}
        </div>
      </div>
      {body}
    </div>
  );
}

function MermaidZoomDialog({ svg, onClose }: { svg: string; onClose: () => void }) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="mermaid-zoom-dialog"
      aria-label={t("i18n.mermaidViewer")}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        onClose();
      }}
    >
      <div className="mermaid-zoom-layout">
        <div className="mermaid-zoom-toolbar">
          <span className="mermaid-zoom-title">{t("i18n.mermaidDiagram")}</span>
          <div className="mermaid-zoom-actions">
            <div className="mermaid-zoom-stepper">
              <button
                type="button"
                onClick={() => setZoom((value) => Math.max(ZOOM_MIN, value - ZOOM_STEP))}
                disabled={zoom <= ZOOM_MIN}
                title={t("i18n.zoomOut")}
                aria-label={t("i18n.zoomOut")}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M5 12h14" />
                </svg>
              </button>
              <span className="mermaid-zoom-value">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoom((value) => Math.min(ZOOM_MAX, value + ZOOM_STEP))}
                disabled={zoom >= ZOOM_MAX}
                title={t("i18n.zoomIn")}
                aria-label={t("i18n.zoomIn")}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              className="mermaid-zoom-icon-button"
              onClick={() => setZoom(1)}
              title={t("i18n.fitToWidth")}
              aria-label={t("i18n.fitToWidth")}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
              </svg>
            </button>
            <button
              type="button"
              className="mermaid-zoom-icon-button"
              onClick={onClose}
              title={t("i18n.close")}
              aria-label={t("i18n.close")}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>
        <div
          className="mermaid-zoom-viewport"
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <div
            className="mermaid-zoom-canvas"
            style={{ width: `${zoom * 100}%` }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      </div>
    </dialog>
  );
}

interface CodeBlockProps {
  code: string;
  lang: string;
  headerAction?: ReactNode;
  isStreaming?: boolean;
}

/**
 * Syntax-highlighted code block with copy button.
 * Used as the "source" view for mermaid blocks and for all non-mermaid code fences.
 *
 * Memoized: parent markdown re-renders (e.g. streaming updates elsewhere in
 * the message list) must not re-run Prism tokenization on unchanged code.
 * While the owning message is still streaming, the block renders as plain
 * monospace text — highlighting a growing block re-tokenizes all of it on
 * every chunk, which is the single most expensive part of streamed rendering.
 */
export const CodeBlock = memo(function CodeBlock({ code, lang, headerAction, isStreaming }: CodeBlockProps) {
  const { isDark, theme } = useTheme();
  const deepseekBrand = usesDeepSeekBrand(theme);
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    copyText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const hasLang = Boolean(lang) && lang !== "text";

  return (
    <div className="markdown-code-block">
      {/* 没有语言名（或纯文本）时不显示头部，避免多出一条"卡片头"；
          复制按钮改为右上角悬停浮现（官网 banner-lite 的思路） */}
      <div className={hasLang ? "markdown-code-header" : "markdown-code-header markdown-code-header--lite"}>
        {hasLang && (
          <span className="markdown-code-lang">
            <span className="markdown-code-lang-icon" aria-hidden="true">&lt;/&gt;</span>
            {lang}
          </span>
        )}
        <div className="markdown-code-actions">
          {headerAction}
          <button
            onClick={copy}
            className="markdown-code-action"
            title={copied ? t("i18n.copied") : t("i18n.copy")}
            aria-label={copied ? t("i18n.copied") : t("i18n.copy")}
          >
            {copied ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            )}
          </button>
        </div>
      </div>
      {isStreaming ? (
        <pre
          style={{
            margin: 0,
            padding: "var(--code-block-pre-padding)",
            fontSize: "calc(13.5px + var(--chat-font-size-offset, 0px))",
            lineHeight: 1.6,
            tabSize: 2,
            overflowX: "auto",
            color: "var(--code-block-text)",
            background: "var(--code-block-bg)",
          }}
        >
          <code style={{ fontFamily: "var(--font-mono)" }}>{code}</code>
        </pre>
      ) : (
        <SyntaxHighlighter
          language={lang || "text"}
          style={deepseekBrand ? (isDark ? dsCodeDark : dsCodeLight) : (isDark ? vscDarkPlus : vs)}
          showLineNumbers={false}
          lineNumberStyle={{ color: "var(--text-dim)", fontStyle: "normal" }}
          customStyle={{
            margin: 0,
            padding: "var(--code-block-pre-padding)",
            fontSize: "calc(13.5px + var(--chat-font-size-offset, 0px))",
            lineHeight: 1.6,
            tabSize: 2,
            borderRadius: 0,
            color: "var(--code-block-text)",
            background: "var(--code-block-bg)",
          }}
          codeTagProps={{ style: { fontFamily: "var(--font-mono)" } }}
        >
          {code}
        </SyntaxHighlighter>
      )}
    </div>
  );
});
