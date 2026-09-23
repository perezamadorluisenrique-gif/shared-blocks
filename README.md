# Shared Blocks

[![Latest release](https://img.shields.io/github/v/release/perezamadorluisenrique-gif/shared-blocks?sort=semver)](https://github.com/perezamadorluisenrique-gif/shared-blocks/releases/latest)
[![Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=%23483699&label=downloads&query=%24%5B%22shared-blocks%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)](https://obsidian.md/plugins?id=shared-blocks)
[![CI](https://github.com/perezamadorluisenrique-gif/shared-blocks/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/perezamadorluisenrique-gif/shared-blocks/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/github/license/perezamadorluisenrique-gif/shared-blocks)](LICENSE)

Write a block of text once, in one note, and reuse it anywhere in your vault.
When you edit the original, every place that references it re-renders while you
look at it.

Everything happens locally. The plugin reads and renders notes from your vault
and nothing else: no account, no server, no telemetry, no network access of any
kind.

![Editing a shared block in one note while another note that references it twice updates on screen](https://raw.githubusercontent.com/perezamadorluisenrique-gif/shared-blocks/main/docs/live-update.gif)

_Left: the note that defines the block. Right: a note that uses it twice, in
Reading view. Editing the definition updates both copies as you type._

## How it works

**Define a block** in any note, between two markers on lines of their own:

```markdown
==share:contact==
**Support:** support@example.com
Office hours: 9:00 – 17:00 CET
==/share==
```

The name accepts letters (accented and non-Latin included), digits, `_` and `-`.
A block with an empty body is ignored, so a half-written block reports itself as
missing instead of quietly rendering nothing.

**Reference it** from any other note:

```markdown
==ref:Company handbook^contact==
```

`Company handbook` is the note holding the definition — the same link text you
would put in `[[ ]]`, so a bare name, a subfolder path, or anything Obsidian can
resolve from the note you are writing in. `contact` is the block name.

The reference renders the block's markdown in place, styled as a quoted block.
Edit the definition and every reference on screen updates, without reopening the
note.

References can be nested: a shared block may itself contain a reference to
another one. A cycle is detected and reported in place rather than hanging.

## Commands

| Command | What it does |
|---|---|
| Refresh all blocks | Rescans the whole vault and re-renders every reference on screen |
| Show cache stats | Reports how many blocks are currently cached |

You should not normally need the refresh command; it is there for when a block
goes stale after an edit made outside Obsidian.

## Performance

Opening a vault costs nothing: there is no scan at startup. A block is read the
first time a reference asks for one, and edits are coalesced rather than handled
per keystroke. The manual refresh scans in chunks, yielding between them, so a
large vault does not freeze the window.

## Limitations

- References render in Reading view and in rendered sections of Live Preview.
  The raw `==ref:…==` text is what you see while you are editing that line.
- The markers use Obsidian's highlight syntax, so a block definition shows as a
  highlighted line in its source note.
- Blocks are matched by note path and block name. Renaming a note is handled;
  renaming a *block* means updating the references yourself.

## Installing

In Obsidian, open Settings -> Community plugins -> Browse, search for Shared
Blocks, then install and enable it.

To install it by hand instead, copy `main.js`, `manifest.json` and
`styles.css` into `<vault>/.obsidian/plugins/shared-blocks/` and enable the plugin in
**Settings → Community plugins**.

## Development

```bash
npm install
npm run dev     # esbuild in watch mode
npm run build   # type-check, then a production bundle
npm test        # unit tests for the parsing and cache logic
```

Tests run on plain Node with no extra dependency — Node strips the types itself
from 22.18 onward, which is what `engines` asks for. They cover `src/blocks.ts`,
the pure half of the plugin: block parsing, reference parsing, cache keys, and
which blocks changed between two reads of a note. `main.ts` is the only file
that touches the vault, the metadata cache or the DOM.

## More plugins by Siulved54

| Plugin | What it does | Source |
| --- | --- | --- |
| [Text Case and Cleanup](https://obsidian.md/plugins?id=text-format) | Change the case of a selection without touching code, URLs or task boxes, and repair prose pasted out of a PDF. | [text-format](https://github.com/perezamadorluisenrique-gif/text-format) |
| [Typography as You Type](https://obsidian.md/plugins?id=typography-as-you-type) | Curly quotes, dashes and ellipses as you type, kept out of code and maths, with Backspace to take one back. | [smart-typography-plugin](https://github.com/perezamadorluisenrique-gif/smart-typography-plugin) |

Both are in the community directory: Settings -> Community plugins -> Browse,
then search for the name.

## License

MIT. See [LICENSE](LICENSE).
