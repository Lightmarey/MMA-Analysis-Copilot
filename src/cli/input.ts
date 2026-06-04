import fs from "node:fs/promises";
import path from "node:path";

export type ExpandedInput = {
  text: string;
  inlinedPaths: string[];
};

const MAX_INLINE_BYTES = 256 * 1024;
const TRAILING_PUNCTUATION = new Set([",", ".", ";", ":", "!", "?", ")", "]", "}"]);

export async function expandAtPaths(text: string, baseDir = process.cwd()): Promise<ExpandedInput> {
  const inlinedPaths: string[] = [];
  const replacements: Array<{ start: number; end: number; value: string }> = [];

  for (const match of findAtPathTokens(text)) {
    const { token, trailing } = match.quoted ? { token: match.rawToken, trailing: "" } : trimTrailingPunctuation(match.rawToken);
    if (!token) continue;

    const resolved = await resolveInlinePath(token, baseDir);
    if (!resolved) continue;

    inlinedPaths.push(resolved.path);
    replacements.push({
      start: match.start,
      end: match.end,
      value: [
        "",
        `--- file: ${resolved.path} ---`,
        resolved.content,
        "--- end file ---",
        trailing
      ].join("\n")
    });
  }

  if (!replacements.length) {
    return { text, inlinedPaths };
  }

  let expanded = "";
  let cursor = 0;
  for (const replacement of replacements) {
    expanded += text.slice(cursor, replacement.start);
    expanded += replacement.value;
    cursor = replacement.end;
  }
  expanded += text.slice(cursor);
  return { text: expanded, inlinedPaths };
}

function findAtPathTokens(text: string): Array<{ start: number; end: number; rawToken: string; quoted: boolean }> {
  const tokens: Array<{ start: number; end: number; rawToken: string; quoted: boolean }> = [];
  let index = 0;
  while (index < text.length) {
    const at = text.indexOf("@", index);
    if (at === -1 || at === text.length - 1) break;
    const quote = text[at + 1];
    if (quote === "\"" || quote === "'") {
      const close = text.indexOf(quote, at + 2);
      if (close !== -1) {
        tokens.push({ start: at, end: close + 1, rawToken: text.slice(at + 2, close), quoted: true });
        index = close + 1;
        continue;
      }
    }

    let end = at + 1;
    while (end < text.length && !/\s/.test(text[end]) && text[end] !== "@") end += 1;
    if (end > at + 1) {
      tokens.push({ start: at, end, rawToken: text.slice(at + 1, end), quoted: false });
    }
    index = Math.max(end, at + 1);
  }
  return tokens;
}

function trimTrailingPunctuation(raw: string): { token: string; trailing: string } {
  let token = raw;
  let trailing = "";
  while (token && TRAILING_PUNCTUATION.has(token.at(-1) ?? "")) {
    trailing = `${token.at(-1) ?? ""}${trailing}`;
    token = token.slice(0, -1);
  }
  return { token, trailing };
}

async function resolveInlinePath(token: string, baseDir: string): Promise<{ path: string; content: string } | null> {
  const expanded = token.startsWith("~/")
    ? path.join(process.env.USERPROFILE || process.env.HOME || "", token.slice(2))
    : token;
  const candidate = path.isAbsolute(expanded) ? expanded : path.resolve(baseDir, expanded);

  try {
    const stat = await fs.stat(candidate);
    if (!stat.isFile() || stat.size > MAX_INLINE_BYTES) return null;
    const bytes = await fs.readFile(candidate);
    if (bytes.includes(0)) return null;
    return {
      path: path.resolve(candidate),
      content: bytes.toString("utf8")
    };
  } catch {
    return null;
  }
}
