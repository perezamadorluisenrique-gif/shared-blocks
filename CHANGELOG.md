# Changelog

The release workflow uses the section named after the version being released
as the release description, so every version needs one. `npm version <x.y.z>`
renames the `Unreleased` heading below to that version.

## Unreleased

- **Autocomplete for references.** Typing `==ref:` suggests the notes that
  define blocks; after the `^` it suggests that note's blocks and closes the
  reference when you pick one.
- **Share selection as a block**: wraps the selected text in block markers
  after asking for a name (letters, digits, `_` and `-`), and copies a
  reference to it so it can be pasted straight into another note.
- **Insert reference to a block**: a searchable list of every block in the
  vault, with the start of each block's text, that inserts a reference.

## 0.2.3

- Renaming or moving a note that defines shared blocks now updates every
  `==ref:Old name^block==` that pointed at it, as Obsidian does for ordinary
  links. Before, every reference to it reported "Note not found" until it
  was edited by hand. References inside code blocks and inline code are
  left alone, and a notice says how many were updated.

## 0.2.2

- Both commands have an icon, so they show what they do instead of a
  question mark when added to the mobile toolbar.

## 0.2.1

- Blocks defined in a note with Windows line endings are found. A note saved
  by another editor, or checked out by git on Windows, keeps `\r\n` line
  endings, and every reference to a block in it reported the block as
  missing.
- Spaces or a tab left after `==share:name==` or `==/share==` no longer hide
  the block. They are invisible in the editor, so the block looked correct
  and still reported itself as missing.

## 0.2.0

- The two command IDs no longer repeat the plugin ID, which Obsidian adds
  itself. **If you had assigned a hotkey to either command you will need to
  assign it again.**
- Replaced the `builtin-modules` build dependency with Node's own
  `module.builtinModules`. The plugin itself is unaffected.
- Added linting and a CI workflow to the build, and release assets now carry a
  GitHub build provenance attestation.

## 0.1.0

First release.

Write a block once, between `==share:name==` and `==/share==`, and reference it
anywhere in the vault with `ref:Note name^name` in a code block. Edit the
source and every reference on screen re-renders as you type.

Block names accept accented and non-Latin characters. Nothing leaves the
vault, and no note is read until a reference asks for it.
