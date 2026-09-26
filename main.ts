import {
  Component,
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
  MarkdownRenderer,
  Notice,
  Plugin,
  TFile,
} from 'obsidian';

import {
  blockCacheKey,
  blockNameFromKey,
  changedBlockNames,
  keyBelongsToFile,
  parseBlocks,
  parseRef,
  rekey,
} from './src/blocks';

/** Notes scanned per chunk during a full refresh, before yielding. */
const SCAN_CHUNK_SIZE = 50;

/** Trailing delay for coalescing rapid `modify` events, in milliseconds. */
const RESCAN_DELAY = 250;

export default class SharedBlocksPlugin extends Plugin {
  /** `path::block` to block content, filled in lazily as blocks are needed. */
  private blockCache: Map<string, string> = new Map();
  /** Every reference currently on screen, so edits can be pushed to them. */
  private liveRefs: Set<SharedBlockRef> = new Set();
  /** Notes modified since the last rescan, and the timer that will drain them. */
  private dirtyPaths: Set<string> = new Set();
  private rescanTimer: number | null = null;

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
          void this.refreshRefs(null);
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

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}
