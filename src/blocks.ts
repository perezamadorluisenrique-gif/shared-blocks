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
 * non-Latin block names are accepted.
 */
const BLOCK_DEF_SOURCE = /^==share:([\w\-\p{L}]+)==\n([\s\S]*?)\n^==\/share==$/;

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
 */
export function parseBlocks(content: string): Map<string, string> {
  const blocks = new Map<string, string>();
  const regex = new RegExp(BLOCK_DEF_SOURCE, 'gmu');

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
