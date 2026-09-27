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

/** A reference to a block in another note: `ref:Note name^block`. */
const REF_SOURCE = /^ref:(.+?)\^([\w\-\p{L}]+)$/u;

/** Separates the note path from the block name inside a cache key. */
const KEY_SEPARATOR = '::';

export interface ParsedRef {
  noteName: string;
  blockName: string;
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

  return { noteName: match[1].trim(), blockName: match[2] };
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
const REF_IN_SOURCE = /==ref:([^=\n]+?)\^([\w\-\p{L}]+)==/gu;

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
    return line.replace(REF_IN_SOURCE, (whole: string, name: string, block: string, at: number) => {
      if (code.some(([from, to]) => at >= from && at < to)) return whole;
      const next = retarget(name.trim());
      if (next === null || next === name.trim()) return whole;
      count++;
      return `==ref:${next}^${block}==`;
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
