/**
 * Font stack for the workspace terminal.
 *
 * Shell output that uses private-use glyphs (`eza --icons`, starship prompts,
 * Nerd Font status lines) only renders as icons when a Nerd Font is reachable
 * from the fallback chain — the app's own mono fonts have no icon glyphs.
 */

/**
 * Nerd Font families tried after the app's own mono stack. `Maple Mono NF CN` is
 * first because this host ships it; the rest cover the common installs.
 */
export const TERMINAL_NERD_FONT_FALLBACKS: readonly string[] = [
  "Maple Mono NF CN",
  "JetBrainsMono Nerd Font",
  "JetBrainsMonoNL Nerd Font",
  "FiraCode Nerd Font",
  "Hack Nerd Font",
  "Symbols Nerd Font Mono",
  "Symbols Nerd Font",
];

/**
 * Append Nerd Font fallbacks to the app's mono stack.
 *
 * The trailing generic `monospace` keyword is dropped and re-added at the end:
 * it resolves to a concrete font that has no icon glyphs, and leaving it in the
 * middle of the list would stop the fallback chain before the Nerd Fonts.
 */
export function terminalFontFamily(monoStack: string): string {
  const families = monoStack
    .split(",")
    .map((family) => family.trim())
    .filter(Boolean)
    .filter((family) => family.toLowerCase().replace(/["']/g, "") !== "monospace");

  const fallbacks = TERMINAL_NERD_FONT_FALLBACKS.map((family) => `'${family}'`);
  return [...families, ...fallbacks, "monospace"].join(", ");
}
