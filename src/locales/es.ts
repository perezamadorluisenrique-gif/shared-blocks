import type { Messages } from '../i18n.ts';

const es: Messages = {
  // Commands
  'command.refreshAll': 'Actualizar todos los bloques',
  'command.insertReference': 'Insertar referencia a un bloque',
  'command.shareSelection': 'Compartir la selección como bloque',
  'command.openDefinition': 'Abrir el bloque al que hace referencia esta línea',
  'command.showCacheStats': 'Mostrar estadísticas de la caché',

  // Notices
  'notice.refreshed': 'Bloques compartidos actualizados',
  'notice.cacheStats.one': 'Bloques compartidos: 1 bloque en la caché',
  'notice.cacheStats.other': 'Bloques compartidos: {count} bloques en la caché',
  'notice.noBlocks': 'Shared Blocks: aún no hay bloques definidos. Selecciona texto y ejecuta «{command}».',
  'notice.created': 'Bloque compartido «{name}» creado. Referencia copiada: {ref}',
  'notice.createdNotCopied': 'Bloque compartido «{name}» creado. Referencia: {ref}',
  'notice.refsUpdated.one': 'Shared Blocks: se actualizó 1 referencia en 1 nota.',
  'notice.refsUpdated.manyInOne': 'Shared Blocks: se actualizaron {refs} referencias en 1 nota.',
  'notice.refsUpdated.manyInMany': 'Shared Blocks: se actualizaron {refs} referencias en {notes} notas.',
  'notice.noteNotFound': 'Shared Blocks: no se encontró la nota «{note}».',
  'notice.blockNotFound': 'Shared Blocks: no se encontró el bloque «{block}» en «{note}».',

  // Shown in place of a reference that cannot be drawn
  'error.noteNotFound': 'No se encontró la nota «{note}»',
  'error.blockNotFound': 'No se encontró el bloque «{block}» en «{note}»',
  'error.circular': 'Referencia circular: {note}^{block}',
  'error.render': 'Error al representar el bloque',

  // Dialogs
  'modal.searchPlaceholder': 'Buscar bloques compartidos por nombre, nota o texto',
  'modal.blockName': 'Nombre del bloque',
  'modal.share': 'Compartir',
  'modal.invalidName': 'Usa solo letras, dígitos, _ y -, sin espacios.',
  'modal.nameTaken': 'Esta nota ya tiene un bloque llamado «{name}».',
};

export default es;
