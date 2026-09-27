import {
  App,
  Component,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  FuzzyMatch,
  FuzzySuggestModal,
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
  MarkdownRenderer,
  Modal,
  Notice,
  Plugin,
  Setting,
  TFile,
} from 'obsidian';

import {
  blockCacheKey,
  blockNameFromKey,
  changedBlockNames,
  isValidBlockName,
  keyBelongsToFile,
  namesPath,
  parseBlocks,
  parseRef,
  refQueryAt,
  rekey,
  retargetRefs,
  suggestBlockName,
  wrapAsBlock,
} from './src/blocks';

/** Notes scanned per chunk during a full refresh, before yielding. */
const SCAN_CHUNK_SIZE = 50;

/** Trailing delay for coalescing rapid `modify` events, in milliseconds. */
const RESCAN_DELAY = 250;

/** Characters of a block's body shown next to it in a suggestion. */
const PREVIEW_LENGTH = 80;

/** One block defined somewhere in the vault. */
interface BlockEntry {
  file: TFile;
  name: string;
  body: string;
}

export default class SharedBlocksPlugin extends Plugin {
  /** `path::block` to block content, filled in lazily as blocks are needed. */
  private blockCache: Map<string, string> = new Map();
  /** Every reference currently on screen, so edits can be pushed to them. */
  private liveRefs: Set<SharedBlockRef> = new Set();
  /** Notes modified since the last rescan, and the timer that will drain them. */
  private dirtyPaths: Set<string> = new Set();
  private rescanTimer: number | null = null;
  /**
   * The first vault scan, started the first time something needs the list
   * of every block (autocomplete or the insert command). After it, the
   * modify and create handlers keep the cache complete.
   */
  private fullScan: Promise<void> | null = null;

  onload() {
    // No vault-wide scan here on purpose. Blocks are read the first time a
    // reference asks for one, so opening Obsidian costs nothing regardless
    // of how big the vault is.

    this.registerMarkdownPostProcessor((el, ctx) => this.processElement(el, ctx));

    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          this.markDirty(file.path);
        }
      })
    );

    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          this.markDirty(file.path);
        }
      })
    );

    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        if (file instanceof TFile && file.extension === 'md') {
          this.movePathInCache(oldPath, file.path);
          void this.updateRefsAfterRename(file, oldPath).then(() => this.refreshRefs(null));
        }
      })
    );

    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          this.dropPathFromCache(file.path);
          void this.refreshRefs(null);
        }
      })
    );

    this.addCommand({
      id: 'refresh-all-blocks',
      name: 'Refresh all blocks',
      icon: 'refresh-cw',
      callback: async () => {
        await this.scanVault();
        await this.refreshRefs(null);
        new Notice('Shared blocks refreshed');
      },
    });

    this.registerEditorSuggest(new RefSuggest(this.app, this));

    this.addCommand({
      id: 'insert-reference',
      name: 'Insert reference to a block',
      icon: 'text-quote',
      editorCallback: (editor, ctx) => {
        const sourcePath = ctx.file?.path ?? '';
        void this.allBlocks().then((blocks) => {
          if (blocks.length === 0) {
            new Notice('Shared Blocks: no blocks defined yet. Select some text and run "Share selection as a block".');
            return;
          }
          new BlockPicker(this.app, blocks, (entry) => {
            editor.replaceSelection(this.refText(entry, sourcePath));
          }).open();
        });
      },
    });

    this.addCommand({
      id: 'share-selection',
      name: 'Share selection as a block',
      icon: 'square-plus',
      editorCheckCallback: (checking, editor, ctx) => {
        const file = ctx.file;
        if (!file || editor.getSelection().trim() === '') return false;
        if (!checking) this.shareSelection(editor, file);
        return true;
      },
    });

    this.addCommand({
      id: 'show-cache-stats',
      name: 'Show cache stats',
      icon: 'info',
      callback: () => {
        new Notice(`Shared blocks: ${this.blockCache.size} blocks in cache`);
      },
    });
  }

  onunload() {
    if (this.rescanTimer !== null) {
      window.clearTimeout(this.rescanTimer);
      this.rescanTimer = null;
    }
  }

  // ── Finding and inserting blocks ───────────────────────────────────────

  /** Every block in the vault, scanning it the first time this is asked. */
  async allBlocks(): Promise<BlockEntry[]> {
    if (this.fullScan === null) this.fullScan = this.scanVault();
    await this.fullScan;

    const entries: BlockEntry[] = [];
    for (const [key, body] of this.blockCache) {
      const path = key.slice(0, key.length - blockNameFromKey(key).length - 2);
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) entries.push({ file, name: blockNameFromKey(key), body });
    }
    entries.sort((a, b) => a.file.path.localeCompare(b.file.path) || a.name.localeCompare(b.name));
    return entries;
  }

  /** The link text a note in `sourcePath` would use for the entry's note. */
  linkText(file: TFile, sourcePath: string): string {
    return this.app.metadataCache.fileToLinktext(file, sourcePath, true);
  }

  refText(entry: BlockEntry, sourcePath: string): string {
    return `==ref:${this.linkText(entry.file, sourcePath)}^${entry.name}==`;
  }

  /**
   * Wraps the selection in block markers, after asking for a name, and
   * copies a reference to it so it can be pasted straight into another note.
   */
  private shareSelection(editor: Editor, file: TFile): void {
    const from = editor.getCursor('from');
    const to = editor.getCursor('to');
    const selection = editor.getRange(from, to);
    const taken = new Set(parseBlocks(editor.getValue()).keys());

    new BlockNameModal(this.app, suggestBlockName(selection), taken, (name) => {
      const before = editor.getRange({ line: from.line, ch: 0 }, from);
      const after = editor.getRange(to, { line: to.line, ch: editor.getLine(to.line).length });
      editor.transaction({
        changes: [{ from, to, text: wrapAsBlock(before, selection, after, name) }],
      });

      const ref = `==ref:${file.basename}^${name}==`;
      navigator.clipboard.writeText(ref).then(
        () => new Notice(`Shared block "${name}" created. Reference copied: ${ref}`),
        () => new Notice(`Shared block "${name}" created. Reference: ${ref}`),
      );
    }).open();
  }

  // ── Reference bookkeeping ──────────────────────────────────────────────

  registerRef(ref: SharedBlockRef): void {
    this.liveRefs.add(ref);
  }

  unregisterRef(ref: SharedBlockRef): void {
    this.liveRefs.delete(ref);
  }

  /**
   * Re-renders the references affected by a change.
   *
   * `changedKeys` of null means "anything could have moved" (a rename, a
   * delete, a manual refresh). Unresolved references are always retried:
   * they may point at a note or block that has just appeared.
   */
  private async refreshRefs(changedKeys: Set<string> | null): Promise<void> {
    const work: Promise<void>[] = [];

    for (const ref of this.liveRefs) {
      const key = ref.resolvedKey;
      if (changedKeys === null || key === null || changedKeys.has(key)) {
        work.push(ref.render());
      }
    }

    await Promise.all(work);
  }

  // ── Cache ──────────────────────────────────────────────────────────────

  /**
   * Queues a note for rescanning. Obsidian fires `modify` while the user
   * types, so the work is coalesced rather than run per keystroke.
   */
  private markDirty(path: string): void {
    this.dirtyPaths.add(path);

    if (this.rescanTimer !== null) {
      window.clearTimeout(this.rescanTimer);
    }

    this.rescanTimer = window.setTimeout(() => {
      this.rescanTimer = null;
      void this.drainDirtyPaths();
    }, RESCAN_DELAY);
  }

  private async drainDirtyPaths(): Promise<void> {
    const paths = Array.from(this.dirtyPaths);
    this.dirtyPaths.clear();

    const changedKeys = new Set<string>();
    for (const path of paths) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) continue;

      for (const key of await this.scanFile(file)) {
        changedKeys.add(key);
      }
    }

    if (changedKeys.size > 0) {
      await this.refreshRefs(changedKeys);
    }
  }

  /**
   * Reads one note and updates its blocks in the cache.
   * Returns the keys whose content actually changed.
   */
  private async scanFile(file: TFile): Promise<string[]> {
    let content: string;
    try {
      // cachedRead, not read: the content is only ever displayed.
      content = await this.app.vault.cachedRead(file);
    } catch (e) {
      console.error(`Shared Blocks: error scanning ${file.path}`, e);
      return [];
    }

    const before = new Map<string, string>();
    for (const [key, value] of this.blockCache) {
      if (keyBelongsToFile(key, file.path)) {
        before.set(blockNameFromKey(key), value);
        this.blockCache.delete(key);
      }
    }

    const after = parseBlocks(content);
    for (const [name, body] of after) {
      this.blockCache.set(blockCacheKey(file.path, name), body);
    }

    return changedBlockNames(before, after).map((name) =>
      blockCacheKey(file.path, name)
    );
  }

  /** Scans the whole vault in chunks, yielding so the UI stays responsive. */
  private async scanVault(): Promise<void> {
    this.blockCache.clear();
    const files = this.app.vault.getMarkdownFiles();

    for (let i = 0; i < files.length; i += SCAN_CHUNK_SIZE) {
      for (const file of files.slice(i, i + SCAN_CHUNK_SIZE)) {
        await this.scanFile(file);
      }
      await yieldToUi();
    }
  }

  private dropPathFromCache(path: string): void {
    for (const key of Array.from(this.blockCache.keys())) {
      if (keyBelongsToFile(key, path)) {
        this.blockCache.delete(key);
      }
    }
  }

  private movePathInCache(oldPath: string, newPath: string): void {
    for (const [key, value] of Array.from(this.blockCache)) {
      if (keyBelongsToFile(key, oldPath)) {
        this.blockCache.delete(key);
        this.blockCache.set(rekey(key, newPath), value);
      }
    }
  }

  /**
   * Rewrites `==ref:Old name^block==` to the note's new name in every note
   * that pointed at it, as Obsidian does for ordinary links. Without this a
   * rename left every reference reporting "Note not found".
   *
   * A reference is only rewritten when its name matched the old path and no
   * longer finds a note, so a reference that happens to share the name with
   * another note is left pointing at that one.
   */
  private async updateRefsAfterRename(file: TFile, oldPath: string): Promise<void> {
    // A note that defines no block cannot be the target of a reference.
    if (parseBlocks(await this.app.vault.cachedRead(file)).size === 0) return;

    let refs = 0;
    let notes = 0;
    for (const source of this.app.vault.getMarkdownFiles()) {
      if (!(await this.app.vault.cachedRead(source)).includes('==ref:')) continue;

      const retarget = (noteName: string): string | null => {
        if (!namesPath(noteName, oldPath)) return null;
        const dest = this.app.metadataCache.getFirstLinkpathDest(noteName, source.path);
        if (dest !== null && dest !== file) return null;
        return this.app.metadataCache.fileToLinktext(file, source.path, true);
      };

      let changed = 0;
      await this.app.vault.process(source, (data) => {
        const result = retargetRefs(data, retarget);
        changed = result.count;
        return result.count > 0 ? result.text : data;
      });
      if (changed > 0) {
        refs += changed;
        notes++;
      }
    }

    if (refs > 0) {
      new Notice(`Shared Blocks: updated ${refs} ${refs === 1 ? 'reference' : 'references'} in ${notes} ${notes === 1 ? 'note' : 'notes'}.`);
    }
  }

  /** The cached content of a block, reading the note if it isn't cached yet. */
  async lookupBlock(file: TFile, blockName: string): Promise<string | undefined> {
    const key = blockCacheKey(file.path, blockName);

    const cached = this.blockCache.get(key);
    if (cached !== undefined) return cached;

    await this.scanFile(file);
    return this.blockCache.get(key);
  }

  // ── Rendering ──────────────────────────────────────────────────────────

  private processElement(el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    Array.from(el.querySelectorAll('mark')).forEach((mark) => {
      const ref = parseRef(mark.textContent ?? '');
      if (!ref) return;

      const holder = createSpan({ cls: 'sb-ref' });
      mark.replaceWith(holder);

      // addChild ties the reference to the lifetime of the rendered note:
      // when the note is closed, onunload runs and everything the reference
      // rendered is released with it.
      ctx.addChild(
        new SharedBlockRef(holder, this, ref.noteName, ref.blockName, ctx.sourcePath)
      );
    });
  }
}

/**
 * One `ref:Note^block` on screen.
 *
 * Being a MarkdownRenderChild is what makes live updates safe: the plugin
 * keeps a handle on it to re-render when the source block changes, and
 * Obsidian unloads it (dropping that handle, and everything nested inside)
 * as soon as the note leaves the screen.
 */
class SharedBlockRef extends MarkdownRenderChild {
  /** The cache key this reference resolved to, or null while unresolved. */
  resolvedKey: string | null = null;
  /** Identifies the newest render, so an overtaken one can bow out. */
  private renderToken = 0;
  /**
   * Owns whatever the last successful render produced, nested references
   * included. Dropping it unloads all of that in one go, which is what
   * keeps repeated live updates from piling up.
   */
  private contentChild: Component | null = null;

  constructor(
    containerEl: HTMLElement,
    private plugin: SharedBlocksPlugin,
    private noteName: string,
    private blockName: string,
    private sourcePath: string,
  ) {
    super(containerEl);
  }

  onload(): void {
    this.plugin.registerRef(this);
    this.showLoading();
    void this.render();
  }

  onunload(): void {
    this.plugin.unregisterRef(this);
  }

  async render(): Promise<void> {
    // Renders can overlap: a live update may arrive while the previous one
    // is still awaiting. Only the newest is allowed to touch the DOM.
    const token = ++this.renderToken;

    const file = this.plugin.app.metadataCache.getFirstLinkpathDest(
      this.noteName,
      this.sourcePath,
    );

    if (!file) {
      this.resolve(null);
      this.showError(`Note "${this.noteName}" not found`);
      return;
    }

    const content = await this.plugin.lookupBlock(file, this.blockName);
    if (token !== this.renderToken) return;

    if (content === undefined) {
      this.resolve(null);
      this.showError(`Block "${this.blockName}" not found in "${this.noteName}"`);
      return;
    }

    const key = blockCacheKey(file.path, this.blockName);
    this.resolve(key);

    if (this.hasAncestorRef(key)) {
      this.showError(`Circular reference: ${this.noteName}^${this.blockName}`);
      return;
    }

    // Build the new content alongside the old, hidden, and swap only once
    // it is complete: a reference that is already showing something never
    // blinks empty while it updates. It has to be attached while rendering
    // so that nested references can see their ancestors.
    const previousChild = this.contentChild;
    const child = new Component();
    this.addChild(child);

    const rendered = this.containerEl.createDiv({
      cls: 'sb-block-content sb-pending',
    });

    try {
      await MarkdownRenderer.render(
        this.plugin.app,
        content,
        rendered,
        file.path,
        child,
      );
    } catch (e) {
      console.error('Shared Blocks: render error', e);
      this.removeChild(child);
      rendered.remove();
      if (token === this.renderToken) this.showError('Error rendering block');
      return;
    }

    if (token !== this.renderToken) {
      this.removeChild(child);
      rendered.remove();
      return;
    }

    for (const el of Array.from(this.containerEl.children)) {
      if (el !== rendered) el.remove();
    }
    if (previousChild) this.removeChild(previousChild);

    this.contentChild = child;
    rendered.removeClass('sb-pending');
  }

  /** Records the block this reference points at, for cycle detection. */
  private resolve(key: string | null): void {
    this.resolvedKey = key;

    if (key === null) {
      delete this.containerEl.dataset.sbKey;
    } else {
      this.containerEl.dataset.sbKey = key;
    }
  }

  /**
   * True when this block is already being rendered somewhere above this
   * reference, which means following it would recurse forever. Walking the
   * DOM rather than a shared set is what lets two references to the same
   * block render side by side without one accusing the other of a cycle.
   */
  private hasAncestorRef(key: string): boolean {
    let el = this.containerEl.parentElement;

    while (el) {
      if (el.hasClass('sb-ref') && el.dataset.sbKey === key) return true;
      el = el.parentElement;
    }

    return false;
  }

  /** Empties the reference and unloads whatever it was showing. */
  private clearContent(): void {
    if (this.contentChild) {
      this.removeChild(this.contentChild);
      this.contentChild = null;
    }
    this.containerEl.empty();
  }

  private showLoading(): void {
    this.clearContent();
    this.containerEl.createSpan({ cls: 'sb-loading', text: '\u27f3' });
  }

  private showError(message: string): void {
    this.clearContent();
    this.containerEl.createSpan({ cls: 'sb-error', text: `\u26a0 ${message}` });
  }
}

/** A block shown in a list: its name, its note, and the start of its text. */
function renderEntry(entry: BlockEntry, el: HTMLElement): void {
  el.createDiv({ text: entry.name, cls: 'sb-suggest-name' });
  const preview = entry.body.replace(/\s+/g, ' ');
  el.createDiv({
    text: `${entry.file.basename} · ${preview.length > PREVIEW_LENGTH ? preview.slice(0, PREVIEW_LENGTH) + '…' : preview}`,
    cls: 'sb-suggest-note',
  });
}

/** Search every block by name, note and text; picking one inserts a reference. */
class BlockPicker extends FuzzySuggestModal<BlockEntry> {
  constructor(
    app: App,
    private blocks: BlockEntry[],
    private onChoose: (entry: BlockEntry) => void,
  ) {
    super(app);
    this.setPlaceholder('Search shared blocks by name, note or text');
  }

  getItems(): BlockEntry[] {
    return this.blocks;
  }

  getItemText(entry: BlockEntry): string {
    return `${entry.name} ${entry.file.path} ${entry.body}`;
  }

  renderSuggestion(match: FuzzyMatch<BlockEntry>, el: HTMLElement): void {
    renderEntry(match.item, el);
  }

  onChooseItem(entry: BlockEntry): void {
    this.onChoose(entry);
  }
}

/** Asks for the name of a new block, refusing names that can't be used. */
class BlockNameModal extends Modal {
  constructor(
    app: App,
    private name: string,
    private taken: Set<string>,
    private onSubmit: (name: string) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText('Share selection as a block');
    const problem = this.contentEl.createDiv({ cls: 'sb-name-problem' });
    const submit = () => {
      const name = this.name.trim();
      if (!isValidBlockName(name)) {
        problem.setText('Use letters, digits, _ and - only, with no spaces.');
      } else if (this.taken.has(name)) {
        problem.setText(`This note already has a block named "${name}".`);
      } else {
        this.close();
        this.onSubmit(name);
      }
    };

    new Setting(this.contentEl).setName('Block name').addText((text) => {
      text.setValue(this.name).onChange((value) => {
        this.name = value;
        problem.setText('');
      });
      text.inputEl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          submit();
        }
      });
      window.setTimeout(() => text.inputEl.select(), 0);
    });
    new Setting(this.contentEl).addButton((button) => button.setButtonText('Share').setCta().onClick(submit));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

/**
 * Completes a reference as it is typed: after `==ref:` it offers the notes
 * that define blocks, and after `^` the blocks of that note.
 */
class RefSuggest extends EditorSuggest<BlockEntry> {
  constructor(
    app: App,
    private plugin: SharedBlocksPlugin,
  ) {
    super(app);
  }

  onTrigger(cursor: EditorPosition, editor: Editor): EditorSuggestTriggerInfo | null {
    const query = refQueryAt(editor.getLine(cursor.line).slice(0, cursor.ch));
    if (query === null) return null;
    return {
      start: { line: cursor.line, ch: query.start },
      end: cursor,
      query: editor.getLine(cursor.line).slice(query.start, cursor.ch),
    };
  }

  async getSuggestions(context: EditorSuggestContext): Promise<BlockEntry[]> {
    const line = context.editor.getLine(context.start.line).slice(0, context.end.ch);
    const query = refQueryAt(line);
    if (query === null) return [];
    const sourcePath = context.file?.path ?? '';
    const blocks = await this.plugin.allBlocks();

    if (query.stage === 'note') {
      // One entry per note, the first of its blocks standing in for it.
      const needle = query.query.toLowerCase();
      const seen = new Set<string>();
      return blocks.filter((entry) => {
        if (seen.has(entry.file.path)) return false;
        seen.add(entry.file.path);
        return entry.file.path.toLowerCase().includes(needle);
      });
    }

    const file = this.app.metadataCache.getFirstLinkpathDest(query.noteName, sourcePath);
    const needle = query.query.toLowerCase();
    return blocks.filter((entry) => entry.file === file && entry.name.toLowerCase().includes(needle));
  }

  renderSuggestion(entry: BlockEntry, el: HTMLElement): void {
    const context = this.context;
    const line = context ? context.editor.getLine(context.start.line).slice(0, context.end.ch) : '';
    if (refQueryAt(line)?.stage === 'note') {
      el.createDiv({ text: entry.file.basename, cls: 'sb-suggest-name' });
      el.createDiv({ text: entry.file.path, cls: 'sb-suggest-note' });
    } else {
      renderEntry(entry, el);
    }
  }

  selectSuggestion(entry: BlockEntry): void {
    const context = this.context;
    if (!context) return;
    const { editor, start, end } = context;
    const line = editor.getLine(start.line);
    const stage = refQueryAt(line.slice(0, end.ch))?.stage;
    const sourcePath = context.file?.path ?? '';
    // Whatever of the reference is already typed after the cursor is replaced too.
    const rest = line.slice(end.ch);
    const tail = /^[^\s=]*(==)?/.exec(rest)?.[0] ?? '';
    const to = { line: end.line, ch: end.ch + tail.length };

    if (stage === 'note') {
      const text = `${this.plugin.linkText(entry.file, sourcePath)}^`;
      editor.replaceRange(text, start, to);
      editor.setCursor({ line: start.line, ch: start.ch + text.length });
    } else {
      const text = `${entry.name}==`;
      editor.replaceRange(text, start, to);
      editor.setCursor({ line: start.line, ch: start.ch + text.length });
    }
  }
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}
