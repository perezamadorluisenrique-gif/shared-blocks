/**
 * Pure block parsing and cache-key helpers.
 *
 * Nothing here imports `obsidian`, so it runs under plain Node and can be
 * unit tested. The plugin in `main.ts` is the only place that talks to the
 * vault, the metadata cache or the DOM.
 */

/**
 * A block definition in a note:
 *
 *   ==share:name==
 *   ...content...
 *   ==/share==
 *
 * The `u` flag makes `\p{L}` a real Unicode letter class, so accented and
 * non-Latin block names are accepted. `parseBlocks` rebuilds this with
 * `gmu`; the flag is on the literal as well so the pattern reads the same
 * way on its own, which TypeScript 5 also insists on.
 */
const BLOCK_DEF_SOURCE = /^==share:([\w\-\p{L}]+)==[ \t]*\n([\s\S]*?)\n^==\/share==[ \t]*$/u;

/**
 * A reference to a block in another note: `ref:Note name^block`, optionally
 * followed by whitespace and `key=value` pairs that fill the block's
 * placeholders.
 */
const REF_SOURCE = /^ref:(.+?)\^([\w\-\p{L}]+)(?:[ \t]+([\s\S]*))?$/u;

/** Separates the note path from the block name inside a cache key. */
const KEY_SEPARATOR = '::';

export interface ParsedRef {
  noteName: string;
  blockName: string;
  /** Values passed after the block name; empty for a plain reference. */
  values: Map<string, string>;
}

/**
 * Extracts every block definition from a note's raw markdown.
 *
 * Blocks with an empty body are skipped: an empty definition is almost
 * always a half-written block, and rendering nothing where the reader
 * expects content is worse than reporting the block as missing.
 *
 * Windows line endings are read as plain ones. A note written by another
 * editor, or checked out by git on Windows, keeps its `\r\n`, and a marker
 * followed by `\r` would otherwise never match. So is trailing whitespace
 * after a marker, which is invisible in the editor.
 */
export function parseBlocks(content: string): Map<string, string> {
  const blocks = new Map<string, string>();
  const regex = new RegExp(BLOCK_DEF_SOURCE, 'gmu');
  content = content.replace(/\r\n?/g, '\n');

  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const name = match[1];
    const body = match[2].trim();
    if (body.length > 0) {
      blocks.set(name, body);
    }
  }

  return blocks;
}

/** Parses the text of a `<mark>` into a reference, or null if it isn't one. */
export function parseRef(text: string): ParsedRef | null {
  const match = text.trim().match(REF_SOURCE);
  if (!match) return null;

  return { noteName: match[1].trim(), blockName: match[2], values: parseRefValues(match[3] ?? '') };
}

const NAME_CHAR = /[\w\-\p{L}]/u;
const SPACE = /\s/;

/**
 * Reads the `key=value` pairs after a block name:
 *
 *   name=Ana role="team lead" note="she said \"hi\""
 *
 * A value is a word or a double-quoted string; inside quotes `\"` is a
 * quote and `\\` a backslash. A bare quote ends the string only when
 * whitespace or the end follows it, so a value still reads right when the
 * markdown renderer has eaten the backslash of `\"` (Reading view re-reads
 * the note's own text when it can, so this is a fallback). Anything that is not `key=value` is ignored, the last
 * of a repeated key wins, and an empty value counts as not given, so the
 * block's default applies.
 */
export function parseRefValues(text: string): Map<string, string> {
  const values = new Map<string, string>();
  const n = text.length;
  let i = 0;

  while (i < n) {
    while (i < n && SPACE.test(text[i])) i++;
    const keyStart = i;
    while (i < n && NAME_CHAR.test(text[i])) i++;
    const key = text.slice(keyStart, i);

    if (key === '' || text[i] !== '=') {
      while (i < n && !SPACE.test(text[i])) i++;
      continue;
    }
    i++;

    let value = '';
    if (text[i] === '"') {
      i++;
      for (; i < n; i++) {
        const c = text[i];
        if (c === '\\' && (text[i + 1] === '"' || text[i + 1] === '\\')) {
          value += text[i + 1];
          i++;
        } else if (c === '"' && (i + 1 >= n || SPACE.test(text[i + 1]))) {
          break;
        } else {
          value += c;
        }
      }
      i++;
    } else {
      const start = i;
      while (i < n && !SPACE.test(text[i])) i++;
      value = text.slice(start, i);
    }

    if (value === '') values.delete(key);
    else values.set(key, value);
  }

  return values;
}

/** A value written so `parseRefValues` reads it back unchanged. */
export function formatRefValue(value: string): string {
  return /^[^\s"=\\]+$/.test(value) ? value : `"${value.replace(/[\\"]/g, '\\$&')}"`;
}

/** `{{name}}` or `{{name|default}}` in a block's text. */
const PLACEHOLDER = /\{\{\s*([\w\-\p{L}]+)\s*(?:\|([^{}\n]*))?\}\}/gu;

/**
 * Calls `visit` on every stretch of `text` outside fenced code and inline
 * code spans, and keeps the code as it is. Placeholders in code are
 * examples, not blanks to fill.
 */
function mapOutsideCode(text: string, visit: (chunk: string) => string): string {
  let fence: string | null = null;
  return text
    .split('\n')
    .map((line) => {
      const open = FENCE.exec(line);
      if (fence !== null) {
        if (open && open[1][0] === fence[0] && open[1].length >= fence.length && line.slice(open[0].length).trim() === '') {
          fence = null;
        }
        return line;
      }
      if (open) {
        fence = open[1];
        return line;
      }
      if (!line.includes('{{')) return line;

      let out = '';
      let at = 0;
      for (const [from, to] of inlineCodeRanges(line)) {
        out += visit(line.slice(at, from)) + line.slice(from, to);
        at = to;
      }
      return out + visit(line.slice(at));
    })
    .join('\n');
}

/** The placeholder names a block uses, in order of first appearance. */
export function blockPlaceholders(body: string): string[] {
  const names: string[] = [];
  mapOutsideCode(body, (chunk) => {
    chunk.replace(PLACEHOLDER, (whole: string, name: string) => {
      if (!names.includes(name)) names.push(name);
      return whole;
    });
    return chunk;
  });
  return names;
}

/**
 * The block's text with its placeholders filled: the value given, else the
 * default after `|`, else a marked span (`sb-missing`) that shows the
 * placeholder as written, so a forgotten value is visible. Text without
 * placeholders comes back untouched, and code is never changed.
 */
export function fillPlaceholders(body: string, values: ReadonlyMap<string, string>): string {
  if (!body.includes('{{')) return body;
  return mapOutsideCode(body, (chunk) =>
    chunk.replace(PLACEHOLDER, (_whole: string, name: string, fallback: string | undefined) => {
      const given = values.get(name);
      if (given !== undefined) return given;
      if (fallback !== undefined) return fallback.trim();
      return `<span class="sb-missing" title="No value for ${name}">{{${name}}}</span>`;
    }),
  );
}

/** The `name=""` stubs a reference to this block starts with, or ''. */
export function valueStubs(body: string): string {
  return blockPlaceholders(body).map((name) => ` ${name}=""`).join('');
}

/**
 * The `ref:…` text of every reference marker in a note's raw markdown that
 * is outside code, in order. Reading view uses it to recover values the
 * markdown renderer has altered.
 */
export function rawRefTexts(content: string): string[] {
  const found: string[] = [];
  retargetRefs(content, () => null, (text) => found.push(text));
  return found;
}

/** The cache key for one block of one note. */
export function blockCacheKey(filePath: string, blockName: string): string {
  return `${filePath}${KEY_SEPARATOR}${blockName}`;
}

/** True when the key belongs to the given note. */
export function keyBelongsToFile(key: string, filePath: string): boolean {
  return key.startsWith(filePath + KEY_SEPARATOR);
}

/**
 * The block name inside a key. Splits on the *last* separator, so a note
 * path that itself contains `::` still yields the right name.
 */
export function blockNameFromKey(key: string): string {
  return key.slice(key.lastIndexOf(KEY_SEPARATOR) + KEY_SEPARATOR.length);
}

/** Rewrites a key so it points at the note's new path after a rename. */
export function rekey(key: string, newFilePath: string): string {
  return blockCacheKey(newFilePath, blockNameFromKey(key));
}

/**
 * Names whose content differs between two scans of the same note: added,
 * removed, or edited. This is what decides which references need to be
 * re-rendered, so an unrelated edit to a note costs nothing.
 */
export function changedBlockNames(
  before: Map<string, string>,
  after: Map<string, string>,
): string[] {
  const names = new Set<string>([...before.keys(), ...after.keys()]);
  const changed: string[] = [];

  for (const name of names) {
    if (before.get(name) !== after.get(name)) {
      changed.push(name);
    }
  }

  return changed;
}

/**
 * A reference as written in a note's source, `==ref:Note^block==`. Group 1
 * is the note name exactly as typed, spaces included.
 */
const REF_IN_SOURCE = /==ref:([^=\n]+?)\^([\w\-\p{L}]+)((?:[ \t](?:(?!==)[^\n])*)?)==/gu;

/** A fence that opens or closes a code block. */
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * Whether a note name in a reference could have meant the note at `path`:
 * its name, or the end of its path, with or without `.md`. Obsidian resolves
 * link text without regard to case, and so does this.
 */
export function namesPath(noteName: string, path: string): boolean {
  const name = noteName.trim().replace(/\.md$/i, '').replace(/^\/+/, '').toLowerCase();
  const target = path.replace(/\.md$/i, '').toLowerCase();
  return name !== '' && (target === name || target.endsWith('/' + name));
}

/**
 * Rewrites the note name of every reference in `content` that `retarget`
 * maps to a new one, leaving references inside code blocks and inline code
 * alone: those are examples, not references. Returns the new text and how
 * many references changed.
 */
export function retargetRefs(
  content: string,
  retarget: (noteName: string) => string | null,
  seen?: (refText: string) => void,
): { text: string; count: number } {
  let count = 0;
  let fence: string | null = null;

  const lines = content.split('\n').map((line) => {
    const open = FENCE.exec(line);
    if (fence !== null) {
      if (open && open[1][0] === fence[0] && open[1].length >= fence.length && line.slice(open[0].length).trim() === '') {
        fence = null;
      }
      return line;
    }
    if (open) {
      fence = open[1];
      return line;
    }

    const code = inlineCodeRanges(line);
    return line.replace(REF_IN_SOURCE, (whole: string, name: string, block: string, rest: string, at: number) => {
      if (code.some(([from, to]) => at >= from && at < to)) return whole;
      seen?.(`ref:${name}^${block}${rest}`);
      const next = retarget(name.trim());
      if (next === null || next === name.trim()) return whole;
      count++;
      // The values after the block name are copied as they were typed.
      return `==ref:${next}^${block}${rest}==`;
    });
  });

  return { text: lines.join('\n'), count };
}

/** The `[from, to)` column ranges of inline code spans on one line. */
function inlineCodeRanges(line: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const runs: Array<{ at: number; length: number }> = [];
  const pattern = /`+/g;
  for (let m = pattern.exec(line); m; m = pattern.exec(line)) runs.push({ at: m.index, length: m[0].length });
  for (let i = 0; i < runs.length; i++) {
    const closer = runs.findIndex((run, j) => j > i && run.length === runs[i].length);
    if (closer === -1) continue;
    ranges.push([runs[i].at, runs[closer].at + runs[closer].length]);
    i = closer;
  }
  return ranges;
}

/** A block name: letters (any script), digits, `_` and `-`. */
const BLOCK_NAME = /^[\w\-\p{L}]+$/u;

/** True when `name` can be used as a block name. */
export function isValidBlockName(name: string): boolean {
  return BLOCK_NAME.test(name);
}

/**
 * What the reference being typed at the cursor still needs, read from the
 * line up to the cursor:
 *
 * - `==ref:Comp` → the note, with `Comp` typed so far;
 * - `==ref:Company handbook^con` → a block of that note, with `con` so far.
 *
 * `start` is the column where the typed part begins, which is what a chosen
 * suggestion replaces. Returns null when the cursor is not inside an
 * unfinished reference.
 */
export type RefQuery =
  | { stage: 'note'; query: string; start: number }
  | { stage: 'block'; noteName: string; query: string; start: number };

export function refQueryAt(beforeCursor: string): RefQuery | null {
  const open = beforeCursor.lastIndexOf('==ref:');
  if (open === -1) return null;

  const typed = beforeCursor.slice(open + '==ref:'.length);
  // A closing `==` means the reference is already finished.
  if (typed.includes('==')) return null;

  const caret = typed.lastIndexOf('^');
  if (caret === -1) {
    return { stage: 'note', query: typed, start: open + '==ref:'.length };
  }

  const query = typed.slice(caret + 1);
  if (query !== '' && !isValidBlockName(query)) return null;
  const noteName = typed.slice(0, caret).trim();
  if (noteName === '') return null;
  return { stage: 'block', noteName, query, start: open + '==ref:'.length + caret + 1 };
}

/**
 * A block name made from the first words of `text`: lowercase, joined by
 * `-`, markdown punctuation dropped. Falls back to `block` when nothing
 * usable is left.
 */
export function suggestBlockName(text: string): string {
  const words = text
    .replace(/[^\w\-\p{L}\s]+/gu, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== '' && word !== '-')
    .slice(0, 4);
  const name = words.join('-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
  return name === '' ? 'block' : name.slice(0, 40).replace(/-$/, '');
}

/**
 * The selection wrapped as a block definition. The markers go on lines of
 * their own, so a selection that starts or ends mid-line is split there.
 */
export function wrapAsBlock(
  before: string,
  selection: string,
  after: string,
  name: string,
): string {
  const lead = before === '' || before.endsWith('\n') ? '' : '\n';
  const tail = after === '' || after.startsWith('\n') ? '' : '\n';
  const body = selection.replace(/^\n+|\n+$/g, '');
  return `${lead}==share:${name}==\n${body}\n==/share==${tail}`;
}

/** A reference standing on a line of its own, as found by `refLines`. */
export interface RefLine extends ParsedRef {
  /** Zero-based line number. */
  line: number;
}

/** A line that holds nothing but `==ref:Note^block==`. */
const REF_LINE = /^[ \t]*==(ref:(?:(?!==).)+)==[ \t]*$/;

/** An opening or closing code fence. */
const FENCE_LINE = /^[ \t]{0,3}(`{3,}|~{3,})/;

/**
 * Every reference that stands on a line of its own, outside front matter
 * and fenced code. These are the ones the editor can show rendered in
 * place of the marker, the way an embed is; a reference in the middle of
 * a sentence stays as text there.
 */
export function refLines(lines: readonly string[]): RefLine[] {
  const found: RefLine[] = [];
  let fence: string | null = null;
  let i = 0;

  if (lines.length > 0 && lines[0].trimEnd() === '---') {
    for (i = 1; i < lines.length && lines[i].trimEnd() !== '---'; i++);
    i++;
  }

  for (; i < lines.length; i++) {
    const text = lines[i];
    const fenceMatch = text.match(FENCE_LINE);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (fence === null) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      continue;
    }
    if (fence !== null) continue;

    const match = text.match(REF_LINE);
    const ref = match ? parseRef(match[1]) : null;
    if (ref) found.push({ line: i, ...ref });
  }
  return found;
}

/**
 * The zero-based line where block `name` is defined in `content`, or -1.
 */
export function definitionLine(content: string, name: string): number {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const marker = `==share:${name}==`;
  return lines.findIndex((line) => line.trimEnd() === marker);
}
