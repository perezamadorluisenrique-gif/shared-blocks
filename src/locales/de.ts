import type { Messages } from '../i18n.ts';

const de: Messages = {
  // Commands
  'command.refreshAll': 'Alle Blöcke aktualisieren',
  'command.insertReference': 'Verweis auf einen Block einfügen',
  'command.shareSelection': 'Auswahl als Block teilen',
  'command.openDefinition': 'Den in dieser Zeile referenzierten Block öffnen',
  'command.showCacheStats': 'Cache-Statistik anzeigen',

  // Notices
  'notice.refreshed': 'Geteilte Blöcke aktualisiert',
  'notice.cacheStats.one': 'Geteilte Blöcke: 1 Block im Cache',
  'notice.cacheStats.other': 'Geteilte Blöcke: {count} Blöcke im Cache',
  'notice.noBlocks': 'Shared Blocks: Noch keine Blöcke definiert. Wähle Text aus und führe „{command}“ aus.',
  'notice.created': 'Geteilter Block „{name}“ erstellt. Verweis kopiert: {ref}',
  'notice.createdNotCopied': 'Geteilter Block „{name}“ erstellt. Verweis: {ref}',
  'notice.refsUpdated.one': 'Shared Blocks: 1 Verweis in 1 Notiz aktualisiert.',
  'notice.refsUpdated.manyInOne': 'Shared Blocks: {refs} Verweise in 1 Notiz aktualisiert.',
  'notice.refsUpdated.manyInMany': 'Shared Blocks: {refs} Verweise in {notes} Notizen aktualisiert.',
  'notice.noteNotFound': 'Shared Blocks: Notiz „{note}“ nicht gefunden.',
  'notice.blockNotFound': 'Shared Blocks: Block „{block}“ in „{note}“ nicht gefunden.',

  // Shown in place of a reference that cannot be drawn
  'error.noteNotFound': 'Notiz „{note}“ nicht gefunden',
  'error.blockNotFound': 'Block „{block}“ in „{note}“ nicht gefunden',
  'error.circular': 'Zirkelverweis: {note}^{block}',
  'error.render': 'Fehler beim Darstellen des Blocks',

  // Dialogs
  'modal.searchPlaceholder': 'Geteilte Blöcke nach Name, Notiz oder Text suchen',
  'modal.blockName': 'Blockname',
  'modal.share': 'Teilen',
  'modal.invalidName': 'Nur Buchstaben, Ziffern, _ und - verwenden, keine Leerzeichen.',
  'modal.nameTaken': 'Diese Notiz hat bereits einen Block namens „{name}“.',
};

export default de;
