# Changelog

The release workflow uses the section named after the version being released
as the release description, so every version needs one. `npm version <x.y.z>`
renames the `Unreleased` heading below to that version.

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
