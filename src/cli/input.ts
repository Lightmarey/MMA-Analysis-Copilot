import fs from "node:fs/promises";
import path from "node:path";

export type ExpandedInput = {
  text: string;
  inlinedPaths: string[];
};

const AT_TOKEN_RE = /@([^\s@]+)/g;
const MAX_INLINE_BYTES = 256 * 1024;
const TRAILING_PUNCTUATION = new Set([",", ".", ";", ":", "!", "?", ")", "]", "}"]);

export async function expandAtPaths(text: string, baseDir = process.cwd()): Promise<ExpandedInput> {
  const inlinedPaths: string[] = [];
  const replacements: Array<{ start: number; end: number; value: string }> = [];

  for (const match of text.matchAll(AT_TOKEN_RE)) {
    const rawToken = match[1];
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const { token, trailing } = trimTrailingPunctuation(rawToken);
    if (!token) continue;

    const resolved = await resolveInlinePath(token, baseDir);
    if (!resolved) continue;

    inlinedPaths.push(resolved.path);
    replacements.push({
      start,
      end,
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
