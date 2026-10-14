// The source of the message keys and the fallback language. Every other file in
// this folder must have exactly these keys and the same {placeholders}; the
// build fails on a missing or extra key and `tests/i18n.test.ts` checks the rest.
// Not here: the `==ref:Note^block==` syntax and the block names, which are text
// the user writes in notes.
const en = {
  // Commands
  'command.refreshAll': 'Refresh all blocks',
  'command.insertReference': 'Insert reference to a block',
  'command.shareSelection': 'Share selection as a block',
  'command.openDefinition': 'Open the block referenced on this line',
  'command.showCacheStats': 'Show cache stats',

  // Notices
  'notice.refreshed': 'Shared blocks refreshed',
  'notice.cacheStats.one': 'Shared blocks: 1 block in cache',
  'notice.cacheStats.other': 'Shared blocks: {count} blocks in cache',
  'notice.noBlocks': 'Shared Blocks: no blocks defined yet. Select some text and run "{command}".',
  'notice.created': 'Shared block "{name}" created. Reference copied: {ref}',
  'notice.createdNotCopied': 'Shared block "{name}" created. Reference: {ref}',
  'notice.refsUpdated.one': 'Shared Blocks: updated 1 reference in 1 note.',
  'notice.refsUpdated.manyInOne': 'Shared Blocks: updated {refs} references in 1 note.',
  'notice.refsUpdated.manyInMany': 'Shared Blocks: updated {refs} references in {notes} notes.',
  'notice.noteNotFound': 'Shared Blocks: note "{note}" not found.',
  'notice.blockNotFound': 'Shared Blocks: block "{block}" not found in "{note}".',

  // Shown in place of a reference that cannot be drawn
  'error.noteNotFound': 'Note "{note}" not found',
  'error.blockNotFound': 'Block "{block}" not found in "{note}"',
  'error.circular': 'Circular reference: {note}^{block}',
  'error.render': 'Error rendering block',

  // Dialogs
  'modal.searchPlaceholder': 'Search shared blocks by name, note or text',
  'modal.blockName': 'Block name',
  'modal.share': 'Share',
  'modal.invalidName': 'Use letters, digits, _ and - only, with no spaces.',
  'modal.nameTaken': 'This note already has a block named "{name}".',
} as const;

export default en;
